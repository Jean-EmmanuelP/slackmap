import { redirect } from "next/navigation";
import { db, listPeople } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { Nav } from "@/components/Nav";
import { PeopleTable } from "@/components/PeopleTable";
import { MiningProgress } from "@/components/MiningProgress";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
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

  const people = await listPeople(workspace.id as string);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-zinc-900 flex flex-col">
      <Nav workspaceName={workspace.slack_team_name as string} workspaceId={workspace.id as string} />
      <PageHeader
        title="People"
        subtitle="AI-extracted profile per teammate — role, tools, expertise — inferred from observed Slack behavior. Click a person to see their top channels and re-extract with corrective context."
        count={{ value: people.length, label: "profiles" }}
      />
      <LiveStatus
        status={workspace.backfill_status as "pending" | "running" | "ready" | "failed"}
        progress={workspace.backfill_progress as number}
        total={workspace.backfill_total as number}
        lastEventAt={workspace.last_event_received_at as string | null}
      />
      <MiningProgress workspaceId={workspace.id as string} />
      <PeopleTable people={people} workspaceId={workspace.id as string} />
    </div>
  );
}
