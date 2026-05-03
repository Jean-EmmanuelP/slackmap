import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { VaultDetail } from "@/components/VaultDetail";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanAccessVault } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");
  const access = await userCanAccessVault(id, user.id);
  if (!access.ok || !access.vault) redirect("/");

  const { data: vault } = await db()
    .from("vaults")
    .select("id, workspace_id, name, description, visibility, created_at, updated_at")
    .eq("id", id)
    .single();
  if (!vault) redirect("/");

  const { data: workspace } = await db()
    .from("workspaces")
    .select("id, slack_team_name, slack_team_icon_url")
    .eq("id", vault.workspace_id as string)
    .single();
  if (!workspace) redirect("/");

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
    >
      <PageHeader
        title={vault.name as string}
        subtitle={
          (vault.description as string | null) ??
          "Operational entries used by AI skills to actually execute procedures."
        }
      />
      <VaultDetail
        vaultId={vault.id as string}
        workspaceId={workspace.id as string}
        initialVisibility={(vault.visibility as "team" | "private") ?? "team"}
        canWrite={access.isWorkspaceAdmin || access.vaultRole === "write" || access.vaultRole === "admin"}
        canManage={access.isWorkspaceAdmin || access.vaultRole === "admin"}
      />
    </WorkspaceShell>
  );
}
