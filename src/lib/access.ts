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

export type VaultAccessRole = "read" | "write" | "admin";

// Resolve whether a user can READ a given vault.
// - team-visibility vault: any workspace_member can read
// - private vault: must have a vault_access row
// Also returns the underlying vault row + workspace admin flag so callers
// can make finer decisions (write/delete/manage-acl) without a second query.
export async function userCanAccessVault(
  vaultId: string,
  userId: string | null,
): Promise<{
  ok: boolean;
  vault: { id: string; workspace_id: string; visibility: "team" | "private" } | null;
  isWorkspaceAdmin: boolean;
  vaultRole: VaultAccessRole | null;
}> {
  if (!userId) return { ok: false, vault: null, isWorkspaceAdmin: false, vaultRole: null };
  const { data: vault } = await db()
    .from("vaults")
    .select("id, workspace_id, visibility")
    .eq("id", vaultId)
    .maybeSingle();
  if (!vault) return { ok: false, vault: null, isWorkspaceAdmin: false, vaultRole: null };
  const v = vault as { id: string; workspace_id: string; visibility: "team" | "private" };

  const isWorkspaceAdmin = await userIsAdmin(v.workspace_id, userId);

  // Look up explicit per-vault grant if any.
  const { data: grant } = await db()
    .from("vault_access")
    .select("role")
    .eq("vault_id", v.id)
    .eq("user_id", userId)
    .maybeSingle();
  const vaultRole = (grant?.role as VaultAccessRole | undefined) ?? null;

  if (v.visibility === "team") {
    const member = await userCanRead(v.workspace_id, userId);
    return { ok: member, vault: v, isWorkspaceAdmin, vaultRole };
  }
  // private: must have explicit grant OR be workspace admin
  return { ok: !!vaultRole || isWorkspaceAdmin, vault: v, isWorkspaceAdmin, vaultRole };
}
