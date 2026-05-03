import { WebClient } from "@slack/web-api";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { decrypt } from "./crypto";

export function slackClientForWorkspace(encryptedBotToken: string): WebClient {
  return new WebClient(decrypt(encryptedBotToken));
}

// Discreet client: prefers the user token (silent — sees everything the user
// sees, no joining, no announcement). Falls back to bot token if user token
// isn't present (legacy installs that haven't re-OAuth'd).
export function slackUserOrBotClient(workspace: {
  encrypted_user_token: string | null;
  encrypted_bot_token: string;
}): { client: WebClient; isUserToken: boolean } {
  if (workspace.encrypted_user_token) {
    return {
      client: new WebClient(decrypt(workspace.encrypted_user_token)),
      isUserToken: true,
    };
  }
  return {
    client: new WebClient(decrypt(workspace.encrypted_bot_token)),
    isUserToken: false,
  };
}

// Slack signs requests as: v0:<timestamp>:<raw_body>, HMAC-SHA256 with signing secret.
// Reject if timestamp older than 5 minutes (replay protection).
export function verifySlackSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  if (!signature || !timestamp) return false;
  const tsNum = parseInt(timestamp, 10);
  if (Number.isNaN(tsNum)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (ageSeconds > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const computed = "v0=" + createHmac("sha256", env.slack.signingSecret).update(base).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildOAuthUrl(state: string): string {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.slack.clientId);
  url.searchParams.set("scope", env.slack.scopes.join(","));
  url.searchParams.set("user_scope", env.slack.userScopes.join(","));
  url.searchParams.set("redirect_uri", env.slack.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeOAuthCode(code: string): Promise<{
  accessToken: string;
  userAccessToken?: string;
  teamId: string;
  teamName: string;
  teamDomain?: string;
  authedUserId: string;
  authedUserName?: string;
}> {
  const client = new WebClient();
  const res = await client.oauth.v2.access({
    client_id: env.slack.clientId,
    client_secret: env.slack.clientSecret,
    code,
    redirect_uri: env.slack.redirectUri,
  });
  if (!res.ok || !res.access_token || !res.team?.id) {
    throw new Error(`OAuth exchange failed: ${JSON.stringify(res)}`);
  }
  return {
    accessToken: res.access_token,
    // The user token is only present if user_scope was requested in the
    // authorize URL AND the user consented. Used for silent mining (no joins).
    userAccessToken: res.authed_user?.access_token,
    teamId: res.team.id,
    teamName: res.team.name ?? "unknown",
    teamDomain: undefined,
    authedUserId: res.authed_user?.id ?? "unknown",
    authedUserName: undefined,
  };
}

// Pagination helper for conversations.history. Returns flat array of messages
// since `oldest` (Unix seconds string).
export async function fetchMessagesSince(
  slack: WebClient,
  channelId: string,
  oldestTs: string,
  maxPages = 20,
): Promise<Array<{ ts: string; user?: string; text?: string; subtype?: string }>> {
  const all: Array<{ ts: string; user?: string; text?: string; subtype?: string }> = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const res = await slack.conversations.history({
      channel: channelId,
      oldest: oldestTs,
      limit: 200,
      cursor,
    });
    const msgs = res.messages ?? [];
    for (const m of msgs) {
      all.push({
        ts: m.ts!,
        user: m.user,
        text: m.text,
        subtype: m.subtype,
      });
    }
    cursor = res.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return all;
}

export function sixMonthsAgoTs(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return Math.floor(d.getTime() / 1000).toString();
}

// Slack deeplink for a specific message. workspaceDomain is the team subdomain (e.g. "bestrong").
export function slackMessageLink(teamDomain: string, channelId: string, ts: string): string {
  const tsClean = ts.replace(".", "");
  return `https://${teamDomain}.slack.com/archives/${channelId}/p${tsClean}`;
}
