import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { BOOKING_AUDIT_ACTORS } from "./audit-events";
import type { BookingRepository, CalendarWebhookNotificationClaim } from "./booking-repository";
import { bookingRepository } from "./composition";
import { meetLogger, normalizeErrorCause } from "./logger";
import {
  GOOGLE_CALENDAR_RSVP_STATUSES,
  GOOGLE_CALENDAR_EVENT_FETCH_RESULTS,
  fetchGoogleCalendarEvent,
  isGoogleCalendarConfigured,
} from "@/lib/server/google-calendar-provider";
import { getEnv, isFirebaseConfigured } from "@/lib/server/env";

const GOOGLE_NOTIFICATION_HEADERS = {
  CHANNEL_ID: "x-goog-channel-id",
  CHANNEL_TOKEN: "x-goog-channel-token",
  MESSAGE_NUMBER: "x-goog-message-number",
  RESOURCE_ID: "x-goog-resource-id",
  RESOURCE_STATE: "x-goog-resource-state",
  RESOURCE_URI: "x-goog-resource-uri",
} as const;

const GOOGLE_RESOURCE_STATES = {
  EXISTS: "exists",
  NOT_EXISTS: "not_exists",
  SYNC: "sync",
} as const;

export const GOOGLE_CALENDAR_WEBHOOK_OUTCOMES = {
  ACCEPTED: "accepted",
  CONFIGURATION_MISSING: "configuration_missing",
  INVALID: "invalid",
  UNAUTHORIZED: "unauthorized",
  UNAVAILABLE: "unavailable",
} as const;

export type GoogleCalendarWebhookOutcome =
  (typeof GOOGLE_CALENDAR_WEBHOOK_OUTCOMES)[keyof typeof GOOGLE_CALENDAR_WEBHOOK_OUTCOMES];

interface GoogleCalendarNotification {
  channelId: string;
  messageNumber: string;
  resourceId: string;
  resourceState: string;
  resourceUri: string | null;
}

function getWebhookConfiguration() {
  return {
    channelId: getEnv("GOOGLE_CALENDAR_WEBHOOK_CHANNEL_ID"),
    resourceId: getEnv("GOOGLE_CALENDAR_WEBHOOK_RESOURCE_ID"),
    token: getEnv("GOOGLE_CALENDAR_WEBHOOK_TOKEN"),
  };
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getNotification(request: Request): GoogleCalendarNotification | null {
  const channelId = request.headers.get(GOOGLE_NOTIFICATION_HEADERS.CHANNEL_ID);
  const messageNumber = request.headers.get(GOOGLE_NOTIFICATION_HEADERS.MESSAGE_NUMBER);
  const resourceId = request.headers.get(GOOGLE_NOTIFICATION_HEADERS.RESOURCE_ID);
  const resourceState = request.headers.get(GOOGLE_NOTIFICATION_HEADERS.RESOURCE_STATE);

  if (!channelId || !messageNumber || !resourceId || !resourceState) return null;
  if (!/^\d+$/.test(messageNumber)) return null;
  if (!Object.values(GOOGLE_RESOURCE_STATES).includes(resourceState as "exists")) return null;

  return {
    channelId,
    messageNumber,
    resourceId,
    resourceState,
    resourceUri: request.headers.get(GOOGLE_NOTIFICATION_HEADERS.RESOURCE_URI),
  };
}

function getNotificationIdentity(notification: GoogleCalendarNotification): string {
  return createHash("sha256")
    .update(`${notification.channelId}\n${notification.resourceId}\n${notification.messageNumber}`)
    .digest("hex");
}

/** Accept event-scoped resources; acknowledge collection notifications without guessing. */
function getEventId(resourceUri: string | null): string | null {
  if (!resourceUri) return null;
  try {
    const pathname = new URL(resourceUri).pathname;
    const match = pathname.match(/\/events\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function mapVisitorRsvp(responseStatus: string | null): "confirmed" | "declined" | "owner_confirmed" | null {
  switch (responseStatus) {
    case GOOGLE_CALENDAR_RSVP_STATUSES.ACCEPTED:
      return "confirmed";
    case GOOGLE_CALENDAR_RSVP_STATUSES.DECLINED:
      return "declined";
    case GOOGLE_CALENDAR_RSVP_STATUSES.TENTATIVE:
    case GOOGLE_CALENDAR_RSVP_STATUSES.NEEDS_ACTION:
      return "owner_confirmed";
    default:
      return null;
  }
}

async function reconcileEvent(
  repository: BookingRepository,
  notificationId: string,
  eventId: string,
): Promise<void> {
  const event = await fetchGoogleCalendarEvent(eventId);
  if (event === GOOGLE_CALENDAR_EVENT_FETCH_RESULTS.NOT_FOUND) return;
  if (!event) {
    throw new Error("Calendar event could not be fetched for webhook reconciliation.");
  }
  if (event.status === "cancelled") return;

  const booking = await repository.findByCalendarEventId(event.calendarEventId);
  if (!booking) return;

  // The organizer is never a visitor RSVP source. Match only the persisted
  // visitor address, which also prevents owner-side Calendar edits from
  // changing the booking lifecycle.
  const visitorEmail = booking.identity.email.trim().toLowerCase();
  const visitorAttendee = event.attendees.find(
    (attendee) => attendee.email === visitorEmail && !attendee.organizer,
  );
  const nextStatus = mapVisitorRsvp(visitorAttendee?.responseStatus ?? null);
  if (!nextStatus || (booking.status === nextStatus && nextStatus !== "owner_confirmed")) return;

  const transition = await repository.updateStatus(booking.id, nextStatus, {
    actor: BOOKING_AUDIT_ACTORS.VISITOR,
    payload: {
      calendarEventId: event.calendarEventId,
      notificationId,
      rsvpStatus: visitorAttendee?.responseStatus ?? "unknown",
      source: "google_calendar_webhook",
    },
  });

  if (!transition.success) {
    meetLogger.warn("calendar.webhook.lifecycle_transition_ignored", {
      bookingId: booking.id,
      notificationId,
      requestedStatus: nextStatus,
    });
  }
}

export async function handleGoogleCalendarWebhook(request: Request): Promise<GoogleCalendarWebhookOutcome> {
  const configuration = getWebhookConfiguration();
  if (
    !isFirebaseConfigured() ||
    !isGoogleCalendarConfigured() ||
    !configuration.channelId ||
    !configuration.resourceId ||
    !configuration.token
  ) {
    return GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.CONFIGURATION_MISSING;
  }

  const notification = getNotification(request);
  if (!notification) return GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.INVALID;

  const providedToken = request.headers.get(GOOGLE_NOTIFICATION_HEADERS.CHANNEL_TOKEN);
  if (
    !providedToken ||
    !safeEquals(notification.channelId, configuration.channelId) ||
    !safeEquals(notification.resourceId, configuration.resourceId) ||
    !safeEquals(providedToken, configuration.token)
  ) {
    return GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.UNAUTHORIZED;
  }

  const repository = bookingRepository;
  const notificationId = getNotificationIdentity(notification);
  const claim: CalendarWebhookNotificationClaim = {
    processingOwnerNonce: crypto.randomUUID(),
    processingStartedAt: new Date().toISOString(),
  };

  let claimed = false;
  try {
    claimed = await repository.claimCalendarWebhookNotification(notificationId, claim);
    if (!claimed) return GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.ACCEPTED;

    const eventId = getEventId(notification.resourceUri);
    if (notification.resourceState === GOOGLE_RESOURCE_STATES.EXISTS && eventId) {
      await reconcileEvent(repository, notificationId, eventId);
    } else if (notification.resourceState === GOOGLE_RESOURCE_STATES.EXISTS) {
      meetLogger.warn("calendar.webhook.event_identity_unavailable", { notificationId });
    }

    const completed = await repository.completeCalendarWebhookNotification(notificationId, claim);
    if (!completed) {
      throw new Error("Calendar webhook notification claim ownership was lost before completion.");
    }
    return GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.ACCEPTED;
  } catch (error) {
    if (claimed) await repository.releaseCalendarWebhookNotification(notificationId, claim).catch(() => undefined);
    meetLogger.error("calendar.webhook.processing_failed", {
      cause: normalizeErrorCause(error),
      notificationId,
    });
    return GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.UNAVAILABLE;
  }
}
