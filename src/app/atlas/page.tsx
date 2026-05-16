import { redirect } from "next/navigation";
import { db, listChannels } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AtlasView } from "@/components/AtlasView";
import { MiningProgress } from "@/components/MiningProgress";
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
      "id, slack_team_name, slack_team_domain, slack_team_icon_url, backfill_status, backfill_progress, backfill_total, last_event_received_at, freshdesk_domain, stripe_key_set_at",
    )
    .eq("id", ws)
    .maybeSingle();

  if (!workspace) redirect("/");

  // Fetch channels + per-channel skill counts in parallel. The skill count
  // turns Atlas from "table of channels" into "where the value lives" — it's
  // the metric that ties each channel to actual product output.
  const [channels, skillsResult] = await Promise.all([
    listChannels(workspace.id as string),
    db()
      .from("skills")
      .select("first_seen_channel_id")
      .eq("workspace_id", workspace.id as string),
  ]);

  // Build slack_channel_id → skill count map
  // skills.first_seen_channel_id is the channels.id (uuid), not slack_channel_id,
  // so we need to translate via the channels list.
  const channelIdToSlackId = new Map(channels.map((c) => [c.id, c.slack_channel_id]));
  const skillCountsByChannel: Record<string, number> = {};
  for (const s of skillsResult.data ?? []) {
    const slackId = channelIdToSlackId.get(s.first_seen_channel_id as string);
    if (!slackId) continue;
    skillCountsByChannel[slackId] = (skillCountsByChannel[slackId] ?? 0) + 1;
  }

  return (
    <WorkspaceShell
      workspaceName={workspace.slack_team_name as string}
      workspaceId={workspace.id as string}
      workspaceIconUrl={(workspace.slack_team_icon_url as string | null) ?? null}
      connectedTools={{
        freshdesk: !!workspace.freshdesk_domain,
        stripe: !!workspace.stripe_key_set_at,
      }}
    >
      {channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 px-8">
          <p className="text-sm">No channels yet. Connect Slack to populate the knowledge map.</p>
        </div>
      ) : (
        <>
          <LiveStatus
            status={workspace.backfill_status as "pending" | "running" | "ready" | "failed"}
            progress={workspace.backfill_progress as number}
            total={workspace.backfill_total as number}
            lastEventAt={workspace.last_event_received_at as string | null}
          />
          <MiningProgress workspaceId={workspace.id as string} />
          <AtlasView
            channels={channels}
            teamDomain={(workspace.slack_team_domain as string | null) ?? null}
            workspaceId={workspace.id as string}
            skillCountsByChannel={skillCountsByChannel}
          />
        </>
      )}
    </WorkspaceShell>
  );
}
