import { db } from "./db";

const DEMO_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export function isDemoWorkspaceId(id: string): boolean {
  return id === DEMO_WORKSPACE_ID;
}

// Check whether a Supabase user can read a given workspace.
// Demo workspace = public. All others require workspace_members row.
export async function userCanRead(workspaceId: string, userId: string | null): Promise<boolean> {
  if (isDemoWorkspaceId(workspaceId)) return true;
  if (!userId) return false;
  const { data } = await db()
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function userIsAdmin(workspaceId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await db()
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "admin";
}

export async function listUserWorkspaces(
  userId: string,
): Promise<Array<{ id: string; slack_team_name: string; role: string }>> {
  const { data, error } = await db()
    .from("workspace_members")
    .select("role, workspaces(id, slack_team_name)")
    .eq("user_id", userId);
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).flatMap((r) => {
    const ws = r.workspaces;
    if (!ws?.id) return [];
    return [{ id: ws.id, slack_team_name: ws.slack_team_name, role: r.role }];
  });
}

export async function addMember(
  workspaceId: string,
  userId: string,
  role: "admin" | "member" = "member",
  invitedBy: string | null = null,
): Promise<void> {
  await db()
    .from("workspace_members")
    .upsert(
      { workspace_id: workspaceId, user_id: userId, role, invited_by: invitedBy },
      { onConflict: "workspace_id,user_id" },
    );
}
