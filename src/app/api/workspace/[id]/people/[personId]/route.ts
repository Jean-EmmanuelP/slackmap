import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH: update status (e.g. mark as 'former'). Body: { status?: 'active'|'former'|'draft' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const { id, personId } = await params;
  const body = await req.json().catch(() => ({}));
  const allowed = ["draft", "active", "former"];

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string" && allowed.includes(body.status)) {
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("people")
    .update(patch)
    .eq("id", personId)
    .eq("workspace_id", id)
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, person: data });
}

// DELETE: hard-delete a person row. Activity rollup remains; if extract-people
// runs again, this person could reappear (use PATCH status=former for a soft
// classification that survives re-extracts).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const { id, personId } = await params;
  const { error } = await db()
    .from("people")
    .delete()
    .eq("id", personId)
    .eq("workspace_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
