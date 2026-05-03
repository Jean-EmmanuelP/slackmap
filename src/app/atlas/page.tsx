import { redirect } from "next/navigation";
import { db, listChannels } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { Nav } from "@/components/Nav";
import { AtlasView } from "@/components/AtlasView";
import { AtlasToolbar } from "@/components/AtlasToolbar";
import { MiningProgress } from "@/components/MiningProgress";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AtlasPage({
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

  const channels = await listChannels(workspace.id as string);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-zinc-900 flex flex-col">
      <Nav workspaceName={workspace.slack_team_name as string} workspaceId={workspace.id as string} />
      <PageHeader
        title="Channel atlas"
        subtitle="What each Slack channel is actually used for, inferred from observed activity. Click a channel to mine its purpose, contributors, and message volume."
        count={{ value: channels.filter((c) => !c.archived).length, label: "channels" }}
      />
      <LiveStatus
        status={workspace.backfill_status as "pending" | "running" | "ready" | "failed"}
        progress={workspace.backfill_progress as number}
        total={workspace.backfill_total as number}
        lastEventAt={workspace.last_event_received_at as string | null}
      />
      <MiningProgress workspaceId={workspace.id as string} />
      <AtlasToolbar workspaceId={workspace.id as string} />
      {channels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          No channels yet. Connect Slack to populate.
        </div>
      ) : (
        <AtlasView
          channels={channels}
          teamDomain={(workspace.slack_team_domain as string | null) ?? null}
          workspaceId={workspace.id as string}
        />
      )}
    </div>
  );
}
