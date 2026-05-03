import { NextRequest, NextResponse } from "next/server";
import { exchangeOAuthCode } from "@/lib/slack";
import { encrypt } from "@/lib/crypto";
import { upsertWorkspace } from "@/lib/db";
import { inngest } from "@/inngest/client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error ?? "no_code")}`, req.url));
  }

  try {
    const oauth = await exchangeOAuthCode(code);
    const ws = await upsertWorkspace({
      slackTeamId: oauth.teamId,
      slackTeamName: oauth.teamName,
      encryptedBotToken: encrypt(oauth.accessToken),
      encryptedUserToken: oauth.userAccessToken ? encrypt(oauth.userAccessToken) : null,
      installedBySlackUserId: oauth.authedUserId,
      installedBySlackUserName: oauth.authedUserName,
    });

    await inngest.send({
      name: "workspace/backfill.requested",
      data: { workspaceId: ws.id },
    });

    const res = NextResponse.redirect(new URL(`/atlas?ws=${ws.id}`, req.url));
    // Set a non-httpOnly cookie so the client can read which workspace is active.
    // For v0 with a single user testing on Bestrong, that's enough auth.
    // Multi-user requires real auth (Supabase Auth or NextAuth); v1 work.
    res.cookies.set("ws", ws.id, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("OAuth error", err);
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(msg)}`, req.url));
  }
}
