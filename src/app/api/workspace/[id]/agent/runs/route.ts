import { NextRequest, NextResponse } from "next/server";
import { listAgentRuns, type AgentRun } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam
    ? (statusParam.split(",").map((s) => s.trim()).filter(Boolean) as AgentRun["status"][])
    : (["pending"] as AgentRun["status"][]);
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  try {
    const runs = await listAgentRuns(id, { status, limit });
    return NextResponse.json({ runs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
