import { NextResponse } from "next/server";
import { z } from "zod";

const ERROR_RESPONSE = {
  success: false,
  error: "MEETING_ERROR",
  message: "No se pudo solicitar la reunión",
} as const;

const meetingScheduleSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const identityFields = {
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  message: z.string().trim().max(500).optional(),
};

const contactMeetingSchema = z.object({
  type: z.literal("meeting_request"),
  origin: z.literal("Contacto"),
  reason: z.string().trim().min(1),
  ...identityFields,
  meeting: meetingScheduleSchema,
});

const serviceMeetingSchema = z.object({
  type: z.literal("meeting_request"),
  origin: z.literal("Solicitud de servicio"),
  relatedService: z.string().trim().min(1),
  ...identityFields,
  company: z.string().trim().optional(),
  meeting: meetingScheduleSchema,
  previousRequest: z.object({
    service: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()),
  }),
});

const customSoftwareMeetingSchema = z.object({
  type: z.literal("meeting_request"),
  origin: z.literal("Software a medida"),
  relatedService: z.literal("Software a medida"),
  ...identityFields,
  company: z.string().trim().optional(),
  meeting: meetingScheduleSchema,
  previousRequest: z.object({
    reason: z.literal("Software a medida"),
    details: z.object({
      projectIdea: z.string().optional(),
      currentProblem: z.string().optional(),
      priority: z.string().optional(),
      budget: z.string().optional(),
    }),
  }),
});

const meetingRequestSchema = z.union([
  contactMeetingSchema,
  serviceMeetingSchema,
  customSoftwareMeetingSchema,
]);

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(ERROR_RESPONSE, { status: 400 });
  }

  const result = meetingRequestSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json(ERROR_RESPONSE, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    meetingId: `meet_${crypto.randomUUID().slice(0, 8)}`,
    status: "requested",
    message: "Solicitud recibida",
  });
}
