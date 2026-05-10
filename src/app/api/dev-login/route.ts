import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// Dev-only shortcut: skip Supabase email auth (no provider configured locally)
// by setting the `ws` cookie directly to the BeStrong workspace and bouncing
// to /home. Looks up the workspace by slack_team_domain so it works on both
// local and remote Supabase. Returns 404 in production.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // Try case-insensitive match against name OR domain so we don't care
  // whether prod has "bestrong", "Bestrong", "BeStrong", etc.
  const { data: list, error } = await db()
    .from("workspaces")
    .select("id, slack_team_name, slack_team_domain");

  if (error) {
    return NextResponse.json(
      { error: "DB error", detail: error.message },
      { status: 500 },
    );
  }
  const match = (list ?? []).find((w) => {
    const name = String(w.slack_team_name ?? "").toLowerCase();
    const domain = String(w.slack_team_domain ?? "").toLowerCase();
    return name.includes("bestrong") || domain.includes("bestrong");
  });
  if (!match) {
    return NextResponse.json(
      {
        error: "BeStrong workspace not found",
        available: (list ?? []).map((w) => ({
          id: w.id,
          name: w.slack_team_name,
          domain: w.slack_team_domain,
        })),
        hint: "Hit /api/dev-login?ws=<id> with the right id, or rename a workspace to include 'bestrong'.",
      },
      { status: 404 },
    );
  }

  // Allow ?ws= override to log into any specific workspace.
  const override = req.nextUrl.searchParams.get("ws");
  const wsId = override || (match.id as string);
  const url = new URL(`/home?ws=${wsId}`, req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set("ws", wsId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
