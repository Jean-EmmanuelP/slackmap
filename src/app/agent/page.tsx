import { redirect } from "next/navigation";
import { db, listAgentRuns } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AgentQueue } from "@/components/AgentQueue";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";
import { currentLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

// Co-pilot inbox: every Freshdesk ticket the agent has drafted a reply for,
// awaiting human review. Click into a row to open the composer.
export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string; status?: string }>;
}) {
  const { ws, status } = await searchParams;
  if (!ws) redirect("/");

  const user = await getSessionUser();
  if (user && !(await userCanRead(ws, user.id))) redirect("/no-workspace");

  const { data: workspace } = await db()
    .from("workspaces")
    .select(
      "id, slack_team_name, slack_team_icon_url, display_language, freshdesk_domain, stripe_key_set_at",
    )
    .eq("id", ws)
    .maybeSingle();
  if (!workspace) redirect("/");

  const workspaceLang = (workspace.display_language as string | null) ?? "en";
  const lang = await currentLang(workspaceLang);

  const statusFilter = status === "all"
    ? (["pending", "sent", "rejected", "failed"] as const)
    : status === "sent"
      ? (["sent"] as const)
      : status === "rejected"
        ? (["rejected"] as const)
        : (["pending"] as const);

  const runs = await listAgentRuns(workspace.id as string, {
    status: [...statusFilter],
    limit: 100,
  });

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
      workspaceLang={workspaceLang}
      connectedTools={{
        freshdesk: !!workspace.freshdesk_domain,
        stripe: !!workspace.stripe_key_set_at,
      }}
    >
      <AgentQueue
        workspaceId={workspace.id as string}
        runs={runs}
        currentStatus={statusFilter[0]}
        freshdeskConnected={!!workspace.freshdesk_domain}
        lang={lang}
      />
    </WorkspaceShell>
  );
}
