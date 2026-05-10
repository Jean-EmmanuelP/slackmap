import { NextRequest, NextResponse } from "next/server";
import { finishCompanyResolution, resetCompanyResolution } from "@/lib/db";

// POST: marks the wizard as complete (sets company_resolved_at).
// DELETE: resets company_resolved_at + company_context so the user can re-run
// the wizard from scratch.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await finishCompanyResolution(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await resetCompanyResolution(id);
  return NextResponse.json({ ok: true });
}
