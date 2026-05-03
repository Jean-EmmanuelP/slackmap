import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data: ws } = await db().from("workspaces").select("id").eq("id", id).maybeSingle();
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await inngest.send({
    name: "workspace/people.requested",
    data: { workspaceId: id },
  });

  return NextResponse.json({ ok: true, queued: true });
}
