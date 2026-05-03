function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  slack: {
    clientId: required("SLACK_CLIENT_ID"),
    clientSecret: required("SLACK_CLIENT_SECRET"),
    signingSecret: required("SLACK_SIGNING_SECRET"),
    redirectUri: required("SLACK_REDIRECT_URI"),
    // Bot scopes: minimal — just enough to receive Events API webhooks for
    // live updates. We DON'T mine via the bot (no conversations.join → no
    // public announcement when adding to a channel).
    scopes: [
      "channels:read",
      "channels:history",
      "groups:read",
      "groups:history",
      "users:read",
      "team:read",
    ],
    // User scopes: where the actual silent mining happens. The installing user
    // grants Slackmap to read everything they can see — no joining channels,
    // no public bot announcement. Same trust model as Glean / Spinach.
    userScopes: [
      "channels:read",
      "channels:history",
      "groups:read",
      "groups:history",
      "users:read",
      "team:read",
    ],
  },
  anthropic: {
    // Optional: if not set or set to a placeholder, the LLM router falls back
    // to the local `claude` CLI (lib/extract/llm.ts).
    apiKey: optional("ANTHROPIC_API_KEY") ?? "",
  },
  supabase: {
    url: required("SUPABASE_URL"),
    serviceKey: required("SUPABASE_SERVICE_KEY"),
  },
  inngest: {
    eventKey: optional("INNGEST_EVENT_KEY"),
    signingKey: optional("INNGEST_SIGNING_KEY"),
  },
  encryptionKey: required("ENCRYPTION_KEY"),
  appUrl: required("NEXT_PUBLIC_APP_URL"),
};
