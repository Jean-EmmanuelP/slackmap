import { redirect } from "next/navigation";
import { db, listChannels, listSkills, listGlossary, listPeople } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { HomeDashboard } from "@/components/HomeDashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const { data: workspace } = await db()
    .from("workspaces")
    .select(
      "id, slack_team_name, slack_team_domain, freshdesk_domain, freshdesk_status, backfill_status, anthropic_key_set_at",
    )
    .eq("id", ws)
    .maybeSingle();

  if (!workspace) redirect("/");

  const [channels, skills, glossary, people] = await Promise.all([
    listChannels(workspace.id as string),
    listSkills(workspace.id as string),
    listGlossary(workspace.id as string),
    listPeople(workspace.id as string),
  ]);

  const counts = {
    channels: channels.filter((c) => !c.archived).length,
    minedChannels: channels.filter((c) => c.mining_status === "done").length,
    skills: skills.length,
    skillsBySource: {
      slack: skills.filter((s) => s.source === "slack").length,
      freshdesk: skills.filter((s) => s.source === "freshdesk").length,
    },
    people: people.length,
    glossary: glossary.length,
  };

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
    >
      <HomeDashboard
        workspaceId={workspace.id as string}
        workspaceName={workspace.slack_team_name as string}
        sources={{
          slack: true,
          freshdesk: !!workspace.freshdesk_domain,
        }}
        anthropicKeySet={!!workspace.anthropic_key_set_at}
        counts={counts}
      />
    </WorkspaceShell>
  );
}
