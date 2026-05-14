// /audit — the killer Runbook OS audit page.
//
// Single input. Single button. The agent does the rest.
// Output: a ranked list of endpoints the customer's dev team should build
// to automate their support queue.

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AuditPanel } from "@/components/AuditPanel";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";
import { currentLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;
  if (!ws) redirect("/");

  const sessionUser = await getSessionUser();
  const currentUserId = sessionUser?.id ?? null;

  const { data: workspaceRaw } = await db()
    .from("workspaces")
    .select("*")
    .eq("id", ws)
    .maybeSingle();
  const workspace = workspaceRaw as Record<string, unknown> | null;
  if (!workspace) redirect("/");
  if (currentUserId && !(await userCanRead(workspace.id as string, currentUserId))) {
    redirect("/no-workspace");
  }

  const workspaceLang = (workspace.display_language as string | null) ?? "en";
  const lang = await currentLang(workspaceLang);

  // Last audit run + proposed endpoints (if any) for the workspace
  const [lastAudit, endpoints] = await Promise.all([
    db()
      .from("audit_runs")
      .select("id, report, status, created_at, completed_at")
      .eq("workspace_id", workspace.id as string)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db()
      .from("customer_endpoints")
      .select("*")
      .eq("workspace_id", workspace.id as string)
      .order("estimated_ticket_coverage", { ascending: false }),
  ]);

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
      <AuditPanel
        workspaceId={workspace.id as string}
        lang={lang}
        lastReport={(lastAudit?.data?.report as unknown) ?? null}
        lastAuditAt={(lastAudit?.data?.created_at as string | null) ?? null}
        endpoints={(endpoints?.data as unknown[]) ?? []}
      />
    </WorkspaceShell>
  );
}
