import { redirect } from "next/navigation";
import { db, listGlossary } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { GlossaryTable } from "@/components/GlossaryTable";
import { MiningProgress } from "@/components/MiningProgress";
import { PageHeader } from "@/components/PageHeader";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function GlossaryPage({
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

  const entries = await listGlossary(workspace.id as string);

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
      <PageHeader
        title="Glossary"
        subtitle="Every internal acronym and product name, defined from context with a deeplink to the first thread where it appeared."
        count={{ value: entries.length, label: "terms" }}
      />
      <LiveStatus
        status={workspace.backfill_status as "pending" | "running" | "ready" | "failed"}
        progress={workspace.backfill_progress as number}
        total={workspace.backfill_total as number}
        lastEventAt={workspace.last_event_received_at as string | null}
      />
      <MiningProgress workspaceId={workspace.id as string} />
      <GlossaryTable
        entries={entries}
        teamDomain={(workspace.slack_team_domain as string | null) ?? null}
      />
    </WorkspaceShell>
  );
}
