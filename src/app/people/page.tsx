import { redirect } from "next/navigation";
import { db, listPeople } from "@/lib/db";
import { LiveStatus } from "@/components/LiveStatus";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { PeopleTable } from "@/components/PeopleTable";
import { MiningProgress } from "@/components/MiningProgress";
import { PageHeader } from "@/components/PageHeader";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";
import { currentLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
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
      "id, slack_team_name, slack_team_domain, slack_team_icon_url, backfill_status, backfill_progress, backfill_total, last_event_received_at, display_language, freshdesk_domain, stripe_key_set_at",
    )
    .eq("id", ws)
    .maybeSingle();
  if (!workspace) redirect("/");

  const people = await listPeople(workspace.id as string);
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
      <PageHeader
        title="People"
        subtitle="AI-extracted profile per teammate — role, tools, expertise — inferred from observed Slack behavior."
        count={{ value: people.length, label: "profiles" }}
      />
      <LiveStatus
        status={workspace.backfill_status as "pending" | "running" | "ready" | "failed"}
        progress={workspace.backfill_progress as number}
        total={workspace.backfill_total as number}
        lastEventAt={workspace.last_event_received_at as string | null}
      />
      <MiningProgress workspaceId={workspace.id as string} />
      <PeopleTable people={people} workspaceId={workspace.id as string} lang={lang} />
    </WorkspaceShell>
  );
}
