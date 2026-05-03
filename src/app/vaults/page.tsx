import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { VaultsList } from "@/components/VaultsList";
import { getSessionUser } from "@/lib/supabase-server";
import { userIsAdmin, userCanRead } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function VaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const user = await getSessionUser();
  if (!user) redirect("/login");
  const canRead = await userCanRead(ws, user.id);
  if (!canRead) redirect("/");
  const isAdmin = await userIsAdmin(ws, user.id);

  const { data: workspace } = await db()
    .from("workspaces")
    .select("id, slack_team_name, slack_team_icon_url")
    .eq("id", ws)
    .maybeSingle();

  if (!workspace) redirect("/");

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
    >
      <PageHeader
        title="Vault"
        subtitle="Operational knowledge an AI agent needs to actually execute a skill: account URLs, dashboard logins, API keys, environment hints. Stored encrypted."
      />
      <VaultsList workspaceId={workspace.id as string} isAdmin={isAdmin} />
    </WorkspaceShell>
  );
}
