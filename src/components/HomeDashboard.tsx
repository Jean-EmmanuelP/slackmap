"use client";

import { useCallback, useEffect, useState } from "react";

type Counts = {
  channels: number;
  minedChannels: number;
  skills: number;
  skillsBySource: { slack: number; freshdesk: number };
  people: number;
  glossary: number;
};

type Sources = { slack: boolean; freshdesk: boolean };

type Invite = {
  id: string;
  token: string;
  url: string;
  status: string;
  uses_count: number;
  max_uses: number;
  created_at: string;
};

const WELCOME_CARDS = [
  {
    label: "1 / Connect",
    title: "Connect your tools",
    body: "Open Atlas (left sidebar). At the top right of the page you'll find a Freshdesk button and an Anthropic key button — click each, paste your domain + key, and we start pulling. Slack is already connected.",
  },
  {
    label: "2 / Mine",
    title: "Extract knowledge from each channel",
    body: "Still on Atlas: click Mine all public channels to fan out across every channel, or click a channel row to mine just that one. We pull 6 months of history and turn it into channel purposes, a glossary, people profiles, and executable skills.",
  },
  {
    label: "3 / Export",
    title: "Drop skills into Claude Code",
    body: "Open Skills → click Export bundle (top right). Unzip into ~/.claude/skills/ and Claude Code now runs with your real refund thresholds, escalation paths, deploy rules — every step cites the Slack thread or Freshdesk ticket where it came from.",
  },
];

export function HomeDashboard({
  workspaceId,
  workspaceName,
  sources,
  anthropicKeySet,
  counts,
  currentUserId,
  isAdmin,
}: {
  workspaceId: string;
  workspaceName: string;
  sources: Sources;
  anthropicKeySet: boolean;
  counts: Counts;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  // Mark currentUserId as intentionally read so future per-user state can use
  // it; today the dashboard only branches on isAdmin.
  void currentUserId;
  const [card, setCard] = useState(0);
  const [tab, setTab] = useState<"cli" | "agent" | "api">("cli");

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      {/* Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-zinc-900">{workspaceName}</h1>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-zinc-300 text-zinc-600 text-[11px] font-[var(--font-mono)] uppercase tracking-wider">
          Organization
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Welcome back, your company brain is live.</p>

      <div className="mt-8 grid grid-cols-12 gap-4">
        {/* Welcome carousel */}
        <section className="col-span-12 lg:col-span-8 border border-zinc-200 p-6 min-h-[200px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] px-2 py-0.5 border border-zinc-200">
                {WELCOME_CARDS[card].label}
              </span>
              <span className="text-xs text-zinc-500 font-[var(--font-mono)]">
                {card + 1}/{WELCOME_CARDS.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCard((c) => (c - 1 + WELCOME_CARDS.length) % WELCOME_CARDS.length)}
                className="size-7 border border-zinc-300 hover:border-zinc-500 text-zinc-500 hover:text-zinc-900"
                aria-label="Prev"
              >
                ‹
              </button>
              <button
                onClick={() => setCard((c) => (c + 1) % WELCOME_CARDS.length)}
                className="size-7 border border-zinc-300 hover:border-zinc-500 text-zinc-500 hover:text-zinc-900"
                aria-label="Next"
              >
                ›
              </button>
            </div>
          </div>
          <h2 className="text-xl font-medium text-zinc-900">{WELCOME_CARDS[card].title}</h2>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed max-w-3xl">
            {WELCOME_CARDS[card].body}
          </p>
          <div className="mt-auto pt-4 flex gap-1.5">
            {WELCOME_CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCard(i)}
                className={`h-0.5 w-8 transition-colors ${i === card ? "bg-zinc-900" : "bg-zinc-200"}`}
              />
            ))}
          </div>
        </section>

        {/* Sources panel */}
        <section className="col-span-12 lg:col-span-4 border border-zinc-200 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
            Connected sources
          </div>
          <ul className="space-y-2.5">
            <SourceRow name="Slack" connected={sources.slack} count={counts.skillsBySource.slack} />
            <SourceRow
              name="Freshdesk"
              connected={sources.freshdesk}
              count={counts.skillsBySource.freshdesk}
            />
            <SourceRow name="Notion" connected={false} comingSoon />
            <SourceRow name="Linear" connected={false} comingSoon />
            <SourceRow name="GitHub" connected={false} comingSoon />
          </ul>
        </section>

        {/* Counts strip */}
        <section className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200">
          <Stat label="Channels" value={counts.channels} hint={`${counts.minedChannels} mined`} />
          <Stat label="People" value={counts.people} />
          <Stat label="Skills" value={counts.skills} hint="exportable" />
          <Stat label="Glossary" value={counts.glossary} hint="terms" />
        </section>

        {isAdmin && (
          <section className="col-span-12 border border-zinc-200 p-6">
            <InviteTeammate workspaceId={workspaceId} />
          </section>
        )}

        {/* Install / quick start */}
        <section className="col-span-12 lg:col-span-8 border border-zinc-200 p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 font-[var(--font-mono)]">›_</span>
            <h3 className="text-lg font-medium text-zinc-900">Use your skills in Claude Code</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Drop your extracted skills into any AI agent. They run with your company&apos;s rules.
          </p>

          <div className="mt-4 flex border-b border-zinc-200">
            {(["cli", "agent", "api"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-[var(--font-mono)] ${
                  tab === t
                    ? "text-zinc-900 border-b-2 border-zinc-900 -mb-px"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {t === "cli" ? "CLI" : t === "agent" ? "AI Agent" : "API"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "cli" && <CliSnippet workspaceId={workspaceId} />}
            {tab === "agent" && <AgentSnippet workspaceId={workspaceId} />}
            {tab === "api" && <ApiSnippet workspaceId={workspaceId} />}
          </div>
        </section>

        {/* Right rail: LLM key + Skills bundle */}
        <section className="col-span-12 lg:col-span-4 space-y-4">
          <div className="border border-zinc-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                LLM key
              </span>
              <span
                className={`size-1.5 rounded-full ${anthropicKeySet ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </div>
            <div className="mt-2 text-sm text-zinc-900">
              {anthropicKeySet ? "Anthropic key set" : "No Anthropic key yet"}
            </div>
            <div className="mt-1 text-xs text-zinc-500 leading-relaxed">
              {anthropicKeySet
                ? "Skills + people extraction will run automatically when you mine channels."
                : "Add your sk-ant-... in the Atlas toolbar to enable LLM extraction."}
            </div>
          </div>

          <div className="border border-zinc-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
                Skills bundle
              </span>
              <a
                href={`/api/workspace/${workspaceId}/skills.zip`}
                className="text-xs text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
              >
                Download all
              </a>
            </div>
            <div className="mt-2 text-sm text-zinc-900">
              {counts.skills} skills · ready for Claude
            </div>
            <div className="mt-1 text-xs text-zinc-500 leading-relaxed">
              ~/.claude/skills/&lt;workspace&gt;/ — restart Claude Code to load.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SourceRow({
  name,
  connected,
  count,
  comingSoon,
}: {
  name: string;
  connected: boolean;
  count?: number;
  comingSoon?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`size-1.5 rounded-full ${
          connected ? "bg-emerald-500" : comingSoon ? "bg-zinc-300" : "bg-zinc-400"
        }`}
      />
      <span className={connected ? "text-zinc-900" : "text-zinc-500"}>{name}</span>
      {connected && count !== undefined && (
        <span className="ml-auto text-xs text-zinc-500 tabular-nums font-[var(--font-mono)]">
          {count} skills
        </span>
      )}
      {comingSoon && (
        <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-400 font-[var(--font-mono)]">
          soon
        </span>
      )}
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-[var(--paper)] px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-medium text-zinc-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function originUrl(): string {
  if (typeof window === "undefined") return "https://slackmap-livid.vercel.app";
  return window.location.origin;
}

function CliSnippet({ workspaceId }: { workspaceId: string }) {
  const url = `${originUrl()}/api/workspace/${workspaceId}/skills.zip`;
  // Real, copy-paste-runnable command — fetches the bundle, unzips into the
  // standard Claude Code skills directory, no npm package required.
  const cmd = `curl -fsSL "${url}" -o /tmp/slackmap-skills.zip && \\\n  unzip -oq /tmp/slackmap-skills.zip -d ~/.claude/skills/ && \\\n  echo "Installed. Restart Claude Code to load."`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">
        Install your skills as Claude Code skills. Copy + paste in your terminal:
      </p>
      <Code value={cmd} />
      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
        Each skill is a markdown file with frontmatter (`name`, `description`,
        `type`). Claude Code picks them up on next launch.
      </p>
    </div>
  );
}

function AgentSnippet({ workspaceId }: { workspaceId: string }) {
  const url = `${originUrl()}/api/workspace/${workspaceId}/skills.zip`;
  const cmd = `# Cursor / Aider / custom agents — same bundle, different folder\ncurl -fsSL "${url}" -o skills.zip && \\\n  unzip -oq skills.zip -d ./skills/`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">
        For other coding agents — drop the bundle wherever your agent loads
        skills (e.g. <code className="font-[var(--font-mono)]">./skills/</code>{" "}
        for Cursor):
      </p>
      <Code value={cmd} />
    </div>
  );
}

function ApiSnippet({ workspaceId }: { workspaceId: string }) {
  const cmd = `GET ${originUrl()}/api/workspace/${workspaceId}/skills/handle-customer-refund\nAccept: text/markdown`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">
        Fetch a single skill as Claude-skill markdown — useful when your agent
        needs just-in-time guidance:
      </p>
      <Code value={cmd} />
      <p className="text-xs text-zinc-500 mt-2">
        List all skills:{" "}
        <code className="font-[var(--font-mono)]">
          GET /api/workspace/{workspaceId.slice(0, 8)}…/skills.zip
        </code>
      </p>
    </div>
  );
}

function Code({ value }: { value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-start gap-3">
      <pre className="flex-1 text-sm text-zinc-900 whitespace-pre overflow-x-auto font-[var(--font-mono)]">
        {value}
      </pre>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 border border-zinc-200 font-[var(--font-mono)] uppercase tracking-wider"
      >
        Copy
      </button>
    </div>
  );
}

function InviteTeammate({ workspaceId }: { workspaceId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invites`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`Failed to load invites (${res.status})`);
        setInvites([]);
        return;
      }
      const json = await res.json();
      setInvites((json.invites ?? []) as Invite[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvite() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invites`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Failed to create invite (${res.status})`);
        return;
      }
      const json = await res.json();
      const url = json.url as string;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(json.invite?.id ?? "new");
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // Clipboard API can fail in non-secure contexts — fall through.
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(inviteId: string) {
    setError(null);
    const res = await fetch(
      `/api/workspace/${workspaceId}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? `Failed to revoke (${res.status})`);
      return;
    }
    await load();
  }

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copy failed");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
            Team
          </div>
          <h3 className="mt-1 text-lg font-medium text-zinc-900">
            Invite a teammate
          </h3>
          <p className="mt-1 text-sm text-zinc-500 max-w-lg leading-relaxed">
            Generate a one-click link. Anyone with this URL can join the
            workspace as a member after signing in with Google.
          </p>
        </div>
        <button
          onClick={createInvite}
          disabled={creating}
          className="shrink-0 text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50"
        >
          {creating ? "Generating…" : "Invite teammate"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>
      )}

      <div className="mt-5">
        {loading ? (
          <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
            Loading…
          </p>
        ) : invites.length === 0 ? (
          <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">
            No active invites yet.
          </p>
        ) : (
          <ul className="border border-zinc-200 divide-y divide-zinc-200">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="font-[var(--font-mono)] text-zinc-700 text-xs truncate flex-1">
                  …{inv.token.slice(-8)}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] tabular-nums">
                  {inv.uses_count}/{inv.max_uses} used
                </span>
                <button
                  onClick={() => copy(inv.url, inv.id)}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 hover:border-zinc-500 text-zinc-700 hover:text-zinc-900"
                >
                  {copiedId === inv.id ? "Copied" : "Copy link"}
                </button>
                <button
                  onClick={() => revoke(inv.id)}
                  className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 text-zinc-500 hover:text-red-700"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
