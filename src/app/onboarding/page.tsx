import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CompanyOnboardingWizard } from "@/components/CompanyOnboardingWizard";
import { getSessionUser } from "@/lib/supabase-server";
import { userCanRead } from "@/lib/access";

export const dynamic = "force-dynamic";

// Standalone full-screen onboarding experience. /home redirects here when
// `company_resolved_at IS NULL`, and we redirect back to /home as soon as
// the wizard finishes.
export default async function OnboardingPage({
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

  // Already resolved → no reason to be here.
  if (workspace.company_resolved_at) {
    redirect(`/home?ws=${workspace.id as string}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)]">
      <header className="px-8 py-5 flex items-center justify-between border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          {workspace.slack_team_icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspace.slack_team_icon_url as string}
              alt=""
              className="size-6"
            />
          ) : (
            <div className="size-6 bg-zinc-900" />
          )}
          <span className="text-sm font-medium text-zinc-900">
            {workspace.slack_team_name as string}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] px-2 py-0.5 border border-zinc-300">
            Onboarding
          </span>
        </div>
        <a
          href="https://linkup.so"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-900 font-[var(--font-mono)]"
        >
          Powered by Linkup ↗
        </a>
      </header>

      <main className="flex-1 flex items-start justify-center overflow-auto">
        <CompanyOnboardingWizard
          workspaceId={workspace.id as string}
          workspaceName={workspace.slack_team_name as string}
          hasLinkupKey={!!workspace.linkup_key_set_at}
          hasPlatformFallback={!!process.env.LINKUP_API_KEY}
          initial={{
            companyName: (workspace.company_name as string | null) ?? null,
            companyWebsite: (workspace.company_website as string | null) ?? null,
            companyDescription: (workspace.company_description as string | null) ?? null,
            companyIndustry: (workspace.company_industry as string | null) ?? null,
            companyAudience: (workspace.company_audience as "b2b" | "b2c" | "both" | null) ?? null,
            companyScope: (workspace.company_scope as "worldwide" | "national" | null) ?? null,
            companyCountry: (workspace.company_country as string | null) ?? null,
            companyTools: (workspace.company_tools as string[] | null) ?? null,
            companyContext: (workspace.company_context as Record<string, unknown> | null) ?? null,
          }}
        />
      </main>
    </div>
  );
}
