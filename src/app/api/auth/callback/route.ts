import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { listUserWorkspaces } from "@/lib/access";

// OAuth code-exchange endpoint. Supabase sends the user back here after a
// successful Google sign-in with a `?code=...` query param. We trade the code
// for a session (sets the auth cookies), then route the user somewhere useful.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    const reason = error ?? "missing_code";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}`, req.url),
    );
  }

  const sb = await supabaseServer();
  const { data: exchange, error: exchangeErr } = await sb.auth.exchangeCodeForSession(code);
  if (exchangeErr || !exchange?.user) {
    const msg = exchangeErr?.message ?? "exchange_failed";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  // If the OAuth flow originated from an invite page (or any other "next"),
  // honor it. Only allow same-origin paths so this can't be turned into an
  // open redirect.
  if (next && next.startsWith("/")) {
    return NextResponse.redirect(new URL(next, req.url));
  }

  const memberships = await listUserWorkspaces(exchange.user.id);
  if (memberships.length > 0) {
    return NextResponse.redirect(
      new URL(`/home?ws=${memberships[0].id}`, req.url),
    );
  }

  return NextResponse.redirect(new URL("/no-workspace", req.url));
}
