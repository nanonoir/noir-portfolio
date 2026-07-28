import { createActionRouteHandler } from "@/lib/meet/action-route-handler";

export const dynamic = "force-dynamic";

const handler = createActionRouteHandler("decline");

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handler.GET(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handler.POST(request, context);
}