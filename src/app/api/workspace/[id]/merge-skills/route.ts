import { NextRequest, NextResponse } from "next/server";
import { db, mergeDraftSkills } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: ws } = await db()
    .from("workspaces")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const result = await mergeDraftSkills(id, {
      info: (msg) => console.log(`[merge-api] ${msg}`),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
