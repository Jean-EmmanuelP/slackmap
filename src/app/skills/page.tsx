import { redirect } from "next/navigation";
import { db, listSkills, listChannels } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { SkillsTable } from "@/components/SkillsTable";
import { MiningProgress } from "@/components/MiningProgress";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const { data: workspace } = await db()
    .from("workspaces")
    .select(
      "id, slack_team_name, slack_team_domain, slack_team_icon_url, backfill_status, backfill_progress, backfill_total, last_event_received_at",
    )
    .eq("id", ws)
    .maybeSingle();

  if (!workspace) redirect("/");

  const [skills, channels] = await Promise.all([
    listSkills(workspace.id as string),
    listChannels(workspace.id as string),
  ]);
  const channelNames: Record<string, string> = {};
  for (const c of channels) channelNames[c.slack_channel_id] = c.name;

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
    >
      <PageHeader
        title="Skills"
        subtitle="Procedures, policies, and decisions extracted as Claude-skill-compatible markdown. Drop them in any AI agent and it can act with your company's rules."
        count={{ value: skills.length, label: "skills" }}
      />
      <LiveStatus
        status={workspace.backfill_status as "pending" | "running" | "ready" | "failed"}
        progress={workspace.backfill_progress as number}
        total={workspace.backfill_total as number}
        lastEventAt={workspace.last_event_received_at as string | null}
      />
      <MiningProgress workspaceId={workspace.id as string} />
      <SkillsTable
        skills={skills}
        workspaceId={workspace.id as string}
        teamDomain={(workspace.slack_team_domain as string | null) ?? null}
        channelNames={channelNames}
      />
    </WorkspaceShell>
  );
}
