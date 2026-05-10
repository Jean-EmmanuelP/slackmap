// Server-side helper to resolve the current display language. Order:
//   1. Per-session cookie (`slackmap.lang`) set by the client toggle
//   2. Workspace's display_language column (team default)
//   3. Fallback to "en"
//
// Use in server components: `const lang = await currentLang(workspace.display_language);`

import { cookies } from "next/headers";

const COOKIE = "slackmap.lang";

export async function currentLang(workspaceDefault: string | null | undefined): Promise<string> {
  try {
    const c = (await cookies()).get(COOKIE)?.value;
    if (c && /^[a-z]{2,8}$/i.test(c)) return c.toLowerCase();
  } catch {
    // headers() / cookies() unavailable in some contexts — fall through.
  }
  return (workspaceDefault ?? "en").toLowerCase();
}
