import { redirect } from "next/navigation";
import { db, listSkills } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { Nav } from "@/components/Nav";
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
      "id, slack_team_name, slack_team_domain, backfill_status, backfill_progress, backfill_total, last_event_received_at",
    )
    .eq("id", ws)
    .maybeSingle();

  if (!workspace) redirect("/");

  const skills = await listSkills(workspace.id as string);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-zinc-900 flex flex-col">
      <Nav workspaceName={workspace.slack_team_name as string} workspaceId={workspace.id as string} />
      <PageHeader
        title="Executable skills"
        subtitle="Procedures, policies, and decisions extracted as Claude-skill-compatible markdown. Drop them in any AI agent and it can act with your company's rules — with citations back to Slack."
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
      />
    </div>
  );
}
