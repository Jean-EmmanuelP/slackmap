import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Logout = clear the `ws` cookie AND sign the Supabase user out so the
// sidebar and middleware no longer report a logged-in user. Does NOT revoke
// Slack OAuth tokens — workspace data + tokens stay in the DB. To fully
// disconnect Slack, uninstall the Slack App from the workspace.
export async function POST() {
  try {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  } catch (e) {
    console.warn("supabase signOut failed", (e as Error).message);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ws", "", { maxAge: 0, path: "/" });
  return res;
}
