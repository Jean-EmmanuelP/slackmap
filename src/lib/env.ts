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
    get clientId() { return required("SLACK_CLIENT_ID"); },
    get clientSecret() { return required("SLACK_CLIENT_SECRET"); },
    get signingSecret() { return required("SLACK_SIGNING_SECRET"); },
    get redirectUri() { return required("SLACK_REDIRECT_URI"); },
    scopes: [
      "channels:read",
      "channels:history",
      "groups:read",
      "groups:history",
      "users:read",
      "team:read",
    ],
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
    get apiKey() { return optional("ANTHROPIC_API_KEY") ?? ""; },
  },
  supabase: {
    get url() { return required("SUPABASE_URL"); },
    get serviceKey() { return required("SUPABASE_SERVICE_KEY"); },
  },
  inngest: {
    get eventKey() { return optional("INNGEST_EVENT_KEY"); },
    get signingKey() { return optional("INNGEST_SIGNING_KEY"); },
  },
  get encryptionKey() { return required("ENCRYPTION_KEY"); },
  get appUrl() { return required("NEXT_PUBLIC_APP_URL"); },
};
