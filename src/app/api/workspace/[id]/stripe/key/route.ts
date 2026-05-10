import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { StripeClient } from "@/lib/stripe";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await db()
    .from("workspaces")
    .select("stripe_key_set_at, stripe_account_id, stripe_livemode")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    keySet: !!data.stripe_key_set_at,
    keySetAt: data.stripe_key_set_at,
    accountId: data.stripe_account_id,
    livemode: data.stripe_livemode,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const apiKey = (body?.apiKey ?? "").toString().trim();
  if (!apiKey || !apiKey.startsWith("sk_")) {
    return NextResponse.json(
      { error: "invalid_key", detail: "Stripe secret keys start with sk_live_ or sk_test_" },
      { status: 400 },
    );
  }

  let pong;
  try {
    pong = await new StripeClient(apiKey).ping();
  } catch (e) {
    return NextResponse.json(
      { error: "stripe_auth_failed", detail: (e as Error).message },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await db()
    .from("workspaces")
    .update({
      encrypted_stripe_api_key: encrypt(apiKey),
      stripe_key_set_at: now,
      stripe_account_id: pong.id,
      stripe_livemode: pong.livemode,
      updated_at: now,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "save_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accountId: pong.id, livemode: pong.livemode });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db()
    .from("workspaces")
    .update({
      encrypted_stripe_api_key: null,
      stripe_key_set_at: null,
      stripe_account_id: null,
      stripe_livemode: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
