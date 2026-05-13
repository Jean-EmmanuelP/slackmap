import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead, userIsAdmin } from "@/lib/access";
import {
  listChannels,
  getSlackContextChannelIds,
  setSlackContextChannelIds,
} from "@/lib/db";
import { suggestContextChannels } from "@/lib/agent/slack-context";

// Slack-as-context endpoints. GET returns the current selection + ranked
// auto-suggestions so the UI can render a confirmation panel. POST persists
// the user's choice (an array of slack_channel_id strings). Empty array =
// feature disabled for this workspace.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (user && !(await userCanRead(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [selected, channels] = await Promise.all([
    getSlackContextChannelIds(id),
    listChannels(id),
  ]);
  const suggestions = suggestContextChannels(channels, 8);
  return NextResponse.json({
    selected,
    suggestions,
    totalChannels: channels.length,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !(await userIsAdmin(id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: { channelIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.channelIds) || !body.channelIds.every((c) => typeof c === "string")) {
    return NextResponse.json({ error: "channelIds must be string[]" }, { status: 400 });
  }
  // Bound to 5 channels — beyond that the prompt becomes noisy + token cost
  // climbs without proportional value. The UI also enforces this.
  if (body.channelIds.length > 5) {
    return NextResponse.json({ error: "max 5 context channels" }, { status: 400 });
  }
  await setSlackContextChannelIds(id, body.channelIds as string[]);
  return NextResponse.json({ ok: true, selected: body.channelIds });
}
