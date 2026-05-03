import { NextRequest, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack";
import { isEventProcessed, markEventProcessed, getWorkspaceBySlackTeam } from "@/lib/db";
import { inngest } from "@/inngest/client";

// Slack requires a 200 response within 3 seconds. We verify, dedupe, enqueue,
// and return — the heavy work happens in the on-slack-event Inngest function.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-slack-signature");
  const ts = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature(rawBody, sig, ts)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: { type?: string; challenge?: string; event_id?: string; team_id?: string; event?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  // URL verification handshake (one-time when configuring the Slack App).
  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (!payload.event_id || !payload.team_id || !payload.event) {
    return new NextResponse("ok"); // ignore unknown payloads
  }

  if (await isEventProcessed(payload.event_id)) {
    return new NextResponse("ok");
  }

  const ws = await getWorkspaceBySlackTeam(payload.team_id);
  await markEventProcessed(payload.event_id, ws?.id ?? null);

  if (ws) {
    await inngest.send({
      name: "slack/event.received",
      data: {
        teamId: payload.team_id,
        eventId: payload.event_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event: payload.event as any,
      },
    });
  }

  return new NextResponse("ok");
}
