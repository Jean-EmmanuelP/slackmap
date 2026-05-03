import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { exchangeOAuthCode } from "@/lib/slack";
import { encrypt } from "@/lib/crypto";
import { db, upsertWorkspace } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { getSessionUser } from "@/lib/supabase-server";
import { addMember } from "@/lib/access";

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

    // Best-effort: pull team icon + domain via team.info so the workspace
    // sidebar shows the customer's actual logo (not our brand mark).
    try {
      const slack = new WebClient(oauth.accessToken);
      const info = await slack.team.info();
      const team = info.team as
        | {
            domain?: string;
            icon?: { image_88?: string; image_132?: string; image_default?: boolean };
          }
        | undefined;
      const iconUrl =
        team?.icon && !team.icon.image_default
          ? team.icon.image_132 ?? team.icon.image_88 ?? null
          : null;
      const domain = team?.domain ?? null;
      if (iconUrl || domain) {
        await db()
          .from("workspaces")
          .update({
            slack_team_icon_url: iconUrl,
            slack_team_domain: domain,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ws.id);
      }
    } catch (e) {
      console.warn("team.info fetch failed", (e as Error).message);
    }

    // If the installer is also signed in to Supabase (Google), bind this
    // workspace to that user — they become the workspace admin/owner. If
    // they aren't signed in, fall back to the legacy Slack-only flow so the
    // existing UX still works.
    try {
      const user = await getSessionUser();
      if (user) {
        await addMember(ws.id, user.id, "admin");
        await db()
          .from("workspaces")
          .update({ owner_user_id: user.id, updated_at: new Date().toISOString() })
          .eq("id", ws.id)
          .is("owner_user_id", null);
      }
    } catch (e) {
      console.warn("attach session user failed", (e as Error).message);
    }

    await inngest.send({
      name: "workspace/backfill.requested",
      data: { workspaceId: ws.id },
    });

    const res = NextResponse.redirect(new URL(`/home?ws=${ws.id}`, req.url));
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
