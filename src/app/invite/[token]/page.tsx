import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase-server";
import { addMember } from "@/lib/access";
import { InviteSignInButton } from "./InviteSignInButton";

export const dynamic = "force-dynamic";

type InviteRow = {
  id: string;
  workspace_id: string;
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
  uses_count: number;
  max_uses: number;
  invited_by: string | null;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: invite } = await db()
    .from("workspace_invites")
    .select("id, workspace_id, status, expires_at, uses_count, max_uses, invited_by")
    .eq("token", token)
    .maybeSingle();

  const inv = invite as InviteRow | null;
  const isInvalid =
    !inv ||
    inv.status !== "active" ||
    (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) ||
    inv.uses_count >= inv.max_uses;

  if (isInvalid) return <InvalidInvite />;

  const { data: workspace } = await db()
    .from("workspaces")
    .select("id, slack_team_name, slack_team_icon_url")
    .eq("id", inv.workspace_id)
    .maybeSingle();

  if (!workspace) return <InvalidInvite />;

  const user = await getSessionUser();

  if (!user) {
    return (
      <Shell>
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            Invitation
          </span>
          <h1 className="mt-3 text-2xl font-medium tracking-tight text-zinc-900">
            Join {workspace.slack_team_name as string} on Slackmap
          </h1>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            Sign in with Google to accept the invite. You&apos;ll join as a
            workspace member.
          </p>
          <div className="mt-8">
            <InviteSignInButton token={token} />
          </div>
        </div>
      </Shell>
    );
  }

  // Signed in — accept the invite, increment uses, redirect to workspace.
  await addMember(inv.workspace_id, user.id, "member", inv.invited_by);
  await db()
    .from("workspace_invites")
    .update({ uses_count: inv.uses_count + 1 })
    .eq("id", inv.id);

  redirect(`/home?ws=${inv.workspace_id}`);
}

function InvalidInvite() {
  return (
    <Shell>
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
          Invitation
        </span>
        <h1 className="mt-3 text-2xl font-medium tracking-tight text-zinc-900">
          This invite is no longer valid
        </h1>
        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
          The link may have been revoked, expired, or already used too many
          times. Ask a workspace admin to send you a fresh one.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-zinc-900 px-6">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
