import { NextResponse } from "next/server";

// Logout = clear the `ws` cookie so the user is no longer auto-redirected to
// their workspace dashboard. This does NOT revoke the Slack OAuth tokens — the
// workspace data + tokens stay in DB. To fully disconnect, the user would
// uninstall the Slack App from their workspace.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ws", "", { maxAge: 0, path: "/" });
  return res;
}
