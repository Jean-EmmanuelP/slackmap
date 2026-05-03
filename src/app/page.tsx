import { buildOAuthUrl } from "@/lib/slack";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LandingClient } from "@/components/LandingClient";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const wsCookie = cookieStore.get("ws")?.value;
  if (wsCookie) {
    const { data: existing } = await db()
      .from("workspaces")
      .select("id")
      .eq("id", wsCookie)
      .maybeSingle();
    if (existing) redirect(`/atlas?ws=${wsCookie}`);
  }

  const { error } = await searchParams;
  const state = randomBytes(16).toString("hex");
  const oauthUrl = buildOAuthUrl(state);

  return <LandingClient oauthUrl={oauthUrl} error={error} />;
}
