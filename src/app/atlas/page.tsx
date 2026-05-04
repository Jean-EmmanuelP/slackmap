import { redirect } from "next/navigation";
import { db, listChannels } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AtlasView } from "@/components/AtlasView";
import { MiningProgress } from "@/components/MiningProgress";
import { PageHeader } from "@/components/PageHeader";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const user = await getSessionUser();
  if (user && !(await userCanRead(ws, user.id))) redirect("/");

  const { data: workspace } = await db()
    .from("workspaces")
    .select(
      "id, slack_team_name, slack_team_domain, slack_team_icon_url, backfill_status, backfill_progress, backfill_total, last_event_received_at",
    )
    .eq("id", ws)
    .maybeSingle();

  if (!workspace) redirect("/");

  const channels = await listChannels(workspace.id as string);

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
    >
      <PageHeader
        title="Atlas"
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
    </WorkspaceShell>
  );
}
