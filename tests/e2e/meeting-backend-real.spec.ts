import { expect, test } from "@playwright/test";

import {
  createBackendTestComposition,
  resetBackendTestFirestore,
  seedBackendActionBooking,
} from "../helpers/backend-test-composition";
import { nextWeekdayDate } from "./fixtures";

const actionRequest = (suffix: string) => ({
  type: "meeting_request" as const,
  identity: { email: `${suffix}@example.com`, name: `E2E ${suffix}`, phone: "+15555550100" },
  idempotencyKey: crypto.randomUUID(),
  locale: "en",
  meeting: { date: nextWeekdayDate(), time: "10:00", timezone: "America/Argentina/Buenos_Aires" },
  origin: "contact" as const,
  proposalMetadata: { originVersion: "e2e-v1", proposalVersion: "1", submittedAt: new Date().toISOString() },
  reason: "project" as const,
});

test.describe("@backend real route and Firestore emulator", () => {
  test.beforeEach(async () => {
    await resetBackendTestFirestore();
  });

  test.afterEach(async () => {
    await resetBackendTestFirestore();
  });

  test("submits a meeting request through the browser and persists it through the real backend", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Schedule a call" }).click();
    const modal = page.getByRole("dialog", { name: "Schedule a call" });
    await modal.getByLabel("Name").fill("Backend Visitor");
    await modal.getByLabel("Email").fill("backend-visitor@example.com");
    await modal.getByLabel("WhatsApp / Phone").fill("5491112345678");
    await modal.getByLabel("Call reason").selectOption("project");
    await modal.getByRole("button", { name: "Choose date and time" }).click();
    const dateTimeModal = page.getByRole("dialog", { name: "Choose a date and time" });
    const availabilityResponsePromise = page.waitForResponse((response) => response.url().includes("/api/availability?") && response.request().method() === "GET");
    await dateTimeModal.getByRole("button", { name: nextWeekdayDate() }).click();
    const availabilityResponse = await availabilityResponsePromise;
    const availability = await availabilityResponse.json() as {
      slots: Array<{ available: boolean; time: string }>;
      success: boolean;
    };
    const selectedSlot = availability.slots[0];

    expect(availability.success).toBe(true);
    expect(selectedSlot).toMatchObject({ available: true });
    await dateTimeModal.getByRole("button", { name: selectedSlot!.time }).click();
    await dateTimeModal.getByRole("button", { name: "Confirm time" }).click();

    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/meeting") && response.request().method() === "POST");
    await modal.getByRole("button", { name: "Confirm request" }).click();
    const response = await responsePromise;
    const body = await response.json() as { meetingId: string; success: boolean };

    expect(response.status()).toBe(201);
    expect(body.success).toBe(true);
    await expect(modal.getByRole("heading", { name: "Meeting request sent successfully" })).toBeVisible();
    await expect.poll(async () => (await createBackendTestComposition().bookingRepository.findById(body.meetingId))?.status).toBe("requested");
  });

  test("submits contact and service leads through the real route with only Resend mocked", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact form");
    await contact.getByLabel("Email").fill("backend-contact@example.com");
    await contact.getByLabel("Message").fill("A real route lead test.");
    await contact.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("I received your message. I will get back to you soon.");

    await page.getByRole("button", { name: "Request" }).nth(1).click();
    const modal = page.getByRole("dialog", { name: "Landing / Business Website" });
    await modal.getByLabel("Name").fill("Backend Service");
    await modal.getByLabel("Email").fill("backend-service@example.com");
    await modal.getByLabel("WhatsApp / Phone").fill("5491112345678");
    await modal.getByRole("radio", { name: "Brand / company" }).check();
    await modal.getByLabel("Brand / company name").fill("Backend Labs");
    await modal.getByRole("button", { name: "Send request" }).click();
    await expect(modal.getByRole("heading", { name: "Request sent" })).toBeVisible();
  });

  test("consumes confirm, decline, and propose action tokens through real browser action routes", async ({ page }) => {
    const confirm = await seedBackendActionBooking(actionRequest("confirm"));
    await page.goto(`/meetings/${confirm.booking.id}/confirm#t=${confirm.tokens.confirm}`);
    await page.getByRole("button", { name: "Confirm meeting" }).click();
    await expect(page.getByRole("status")).toContainText("The action was completed successfully.");
    await expect.poll(async () => (await createBackendTestComposition().bookingRepository.findById(confirm.booking.id))?.status).toBe("owner_confirmed");

    const decline = await seedBackendActionBooking(actionRequest("decline"));
    await page.goto(`/meetings/${decline.booking.id}/decline#t=${decline.tokens.decline}`);
    const declineResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/meetings/${decline.booking.id}/decline`)
      && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Decline meeting" }).click();
    const declineResponse = await declineResponsePromise;
    const declineBody = await declineResponse.json() as {
      emailDeliveryStatus: "completed" | "failed" | "pending";
      status: string;
      success: boolean;
    };

    expect(declineResponse.status()).toBe(200);
    expect(declineBody).toMatchObject({ emailDeliveryStatus: "completed", status: "ok", success: true });
    await expect(page.getByRole("status")).toContainText("The action was completed successfully.");
    await expect.poll(async () => (await createBackendTestComposition().bookingRepository.findById(decline.booking.id))?.status).toBe("declined");

    const propose = await seedBackendActionBooking(actionRequest("propose"));
    await page.goto(`/meetings/${propose.booking.id}/propose#t=${propose.tokens.propose}`);
    const proposalAvailabilityResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/availability?") && response.request().method() === "GET",
    );
    await page.getByRole("button", { name: nextWeekdayDate() }).click();
    const proposalAvailability = await proposalAvailabilityResponsePromise.then(async (response) => response.json() as Promise<{
      slots: Array<{ available: boolean; time: string }>;
      success: boolean;
    }>);
    const alternativeSlot = proposalAvailability.slots.find((slot) => slot.available && slot.time !== "10:00");

    expect(proposalAvailability.success).toBe(true);
    expect(alternativeSlot).toBeDefined();
    await page.getByRole("button", { name: alternativeSlot!.time }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("status")).toContainText("The new proposal was sent successfully.");
    await expect.poll(async () => (await createBackendTestComposition().bookingRepository.findById(propose.booking.id))?.status).toBe("reschedule_proposed");
  });
});
