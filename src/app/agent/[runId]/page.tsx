import { redirect } from "next/navigation";
import { db, getAgentRun } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AgentReviewer } from "@/components/AgentReviewer";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";
import { currentLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function AgentRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ ws?: string }>;
}) {
  const { runId } = await params;
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const user = await getSessionUser();
  if (user && !(await userCanRead(ws, user.id))) redirect("/no-workspace");

  const run = await getAgentRun(runId);
  if (!run || run.workspace_id !== ws) redirect(`/agent?ws=${ws}`);

  const { data: workspace } = await db()
    .from("workspaces")
    .select("id, slack_team_name, slack_team_icon_url, display_language, freshdesk_domain, stripe_key_set_at")
    .eq("id", ws)
    .maybeSingle();
  if (!workspace) redirect("/");

  const workspaceLang = (workspace.display_language as string | null) ?? "en";
  const lang = await currentLang(workspaceLang);

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
      <AgentReviewer workspaceId={workspace.id as string} run={run} lang={lang} />
    </WorkspaceShell>
  );
}
