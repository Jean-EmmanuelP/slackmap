import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slackUserOrBotClient } from "@/lib/slack";

// Debug endpoint: shows what the bot can see vs what it's a member of.
// Hit: GET /api/debug/membership/<workspaceId>
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data: ws, error } = await db()
    .from("workspaces")
    .select("id, slack_team_name, encrypted_bot_token, encrypted_user_token")
    .eq("id", id)
    .single();
  if (error || !ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { client: slack, isUserToken } = slackUserOrBotClient({
    encrypted_bot_token: ws.encrypted_bot_token as string,
    encrypted_user_token: (ws.encrypted_user_token as string | null) ?? null,
  });

  const auth = await slack.auth.test().catch((e) => ({ error: e?.data?.error ?? e?.message }));

  const allList = await slack.conversations
    .list({ types: "public_channel,private_channel", limit: 1000, exclude_archived: false })
    .catch((e) => ({ error: e?.data?.error ?? e?.message, channels: [] as { id?: string; name?: string; is_member?: boolean; is_private?: boolean }[] }));

  // users.conversations isn't on this SDK version; instead derive from list().is_member
  const memberOf = "channels" in allList
    ? {
        channels: (allList.channels ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((c: any) => c.is_member)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((c: any) => ({ id: c.id, name: c.name, is_private: c.is_private })),
      }
    : { channels: [] as { id?: string; name?: string; is_private?: boolean }[] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = auth as any;
  return NextResponse.json({
    workspace: ws.slack_team_name,
    activeToken: isUserToken ? "user" : "bot",
    discreetMode: isUserToken,
    botUser: a?.user,
    botUserId: a?.user_id,
    teamUrl: a?.url,
    visibleChannelsCount: "channels" in allList ? allList.channels?.length ?? 0 : 0,
    listError: "error" in allList ? allList.error : undefined,
    memberOf: memberOf.channels,
    memberOfCount: memberOf.channels.length,
  });
}
