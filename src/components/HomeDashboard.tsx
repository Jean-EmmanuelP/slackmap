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

const CONNECTORS = [
  {
    name: "Slack",
    desc: "Channel messages, threads, files — your team's daily operating system.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
        <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
        <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
        <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
      </svg>
    ),
    connectLabel: "Connected via OAuth",
    action: "connected" as const,
  },
  {
    name: "Freshdesk",
    desc: "Support tickets, solution articles, agent profiles — your customer support brain.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.25c-1.636 0-3.087.632-4.182 1.665A9.76 9.76 0 0 0 5.04 3.3C3.12 3.3 1.5 4.2.75 5.55c.84-.54 1.89-.84 3.03-.84.96 0 1.86.21 2.64.57A5.94 5.94 0 0 0 5.55 8.7c0 1.38.54 2.64 1.41 3.57-.51.78-.81 1.71-.81 2.73 0 2.19 1.44 4.05 3.42 4.71a5.97 5.97 0 0 1-.33-1.98c0-1.32.48-2.52 1.26-3.45A5.94 5.94 0 0 0 13.8 17.1c.84 0 1.62-.18 2.34-.51A5.96 5.96 0 0 1 12 18.75c-.57 0-1.11-.09-1.62-.24.42 2.34 2.46 4.11 4.92 4.11 2.76 0 5-2.24 5-5 0-.99-.3-1.92-.81-2.7A5.97 5.97 0 0 0 21.45 9c0-1.68-.69-3.18-1.8-4.26A9.73 9.73 0 0 0 21.75 3c-2.28 0-4.35.93-5.85 2.43A5.95 5.95 0 0 0 12 2.25z" fill="#FF6B2B"/>
      </svg>
    ),
    connectLabel: "Connect Freshdesk",
    action: "atlas" as const,
  },
  {
    name: "Notion",
    desc: "Wikis, docs, meeting notes — your company's long-term memory.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#000" aria-hidden="true">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
      </svg>
    ),
    connectLabel: null,
    action: "coming_soon" as const,
  },
  {
    name: "Linear",
    desc: "Issues, projects, cycles — your product & engineering pipeline.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#5E6AD2" aria-hidden="true">
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"/>
      </svg>
    ),
    connectLabel: null,
    action: "coming_soon" as const,
  },
  {
    name: "GitHub",
    desc: "PRs, issues, discussions — your engineering decisions & context.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" fill="#24292F"/>
      </svg>
    ),
    connectLabel: null,
    action: "coming_soon" as const,
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
  void currentUserId;
  const [tab, setTab] = useState<"cli" | "agent" | "api">("cli");

  const totalEntities = counts.channels + counts.people + counts.glossary;
  const miningPct = counts.channels > 0 ? Math.round((counts.minedChannels / counts.channels) * 100) : 0;

  function connectorStatus(name: string): "connected" | "atlas" | "coming_soon" {
    if (name === "Slack" && sources.slack) return "connected";
    if (name === "Freshdesk" && sources.freshdesk) return "connected";
    if (name === "Freshdesk") return "atlas";
    return "coming_soon";
  }

  function connectorCount(name: string): number | undefined {
    if (name === "Slack") return counts.skillsBySource.slack;
    if (name === "Freshdesk") return counts.skillsBySource.freshdesk;
    return undefined;
  }

  return (
    <div className="flex-1 px-8 py-8 overflow-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-zinc-900">{workspaceName}</h1>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-zinc-300 text-zinc-600 text-[11px] font-[var(--font-mono)] uppercase tracking-wider">
          Organization
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Your company brain — connect your tools to extract knowledge.
      </p>

      <div className="mt-8 grid grid-cols-12 gap-4">
        {/* Sources — full width, the hero section */}
        <section className="col-span-12 border border-zinc-200 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-4 font-[var(--font-mono)]">
            Sources
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {CONNECTORS.map((c) => {
              const status = connectorStatus(c.name);
              const count = connectorCount(c.name);
              return (
                <div
                  key={c.name}
                  className={`border p-4 flex flex-col gap-3 ${
                    status === "connected"
                      ? "border-emerald-200 bg-emerald-50/30"
                      : status === "atlas"
                        ? "border-zinc-200 hover:border-zinc-400 cursor-pointer"
                        : "border-zinc-100 bg-zinc-50/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {c.icon}
                    <span className="text-sm font-medium text-zinc-900">{c.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed flex-1">{c.desc}</p>
                  <div className="mt-auto">
                    {status === "connected" && (
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-700 font-[var(--font-mono)]">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Connected
                        </span>
                        {count !== undefined && (
                          <span className="text-xs text-zinc-500 tabular-nums font-[var(--font-mono)]">
                            {count} skills
                          </span>
                        )}
                      </div>
                    )}
                    {status === "atlas" && (
                      <a
                        href={`/atlas?ws=${workspaceId}`}
                        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-700 font-[var(--font-mono)] hover:text-zinc-900"
                      >
                        <span className="size-1.5 rounded-full bg-zinc-400" />
                        Connect →
                      </a>
                    )}
                    {status === "coming_soon" && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400 font-[var(--font-mono)]">
                        <span className="size-1.5 rounded-full bg-zinc-300" />
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Stats strip */}
        <section className="col-span-12 grid grid-cols-2 md:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200">
          <Stat label="Channels" value={counts.channels} hint={`${counts.minedChannels} mined`} />
          <Stat label="People" value={counts.people} />
          <Stat label="Skills" value={counts.skills} hint="exportable" />
          <Stat label="Glossary" value={counts.glossary} hint="terms" />
          <Stat label="Entities" value={totalEntities} hint="mapped" />
        </section>

        {/* Mining progress */}
        <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-[var(--font-mono)]">
            Extraction progress
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                style={{ width: `${miningPct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-zinc-900 tabular-nums">{miningPct}%</span>
          </div>
          <p className="text-xs text-zinc-500">
            {counts.minedChannels} of {counts.channels} channels mined — extracting entities, relationships, and skills from each.
          </p>
        </section>

        {/* LLM key */}
        <section className="col-span-12 lg:col-span-6 border border-zinc-200 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">
              Extraction engine
            </div>
            <span className={`size-1.5 rounded-full ${anthropicKeySet ? "bg-emerald-500" : "bg-amber-500"}`} />
          </div>
          <div className="mt-2 text-sm text-zinc-900">
            {anthropicKeySet ? "Anthropic key active" : "No Anthropic key yet"}
          </div>
          <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
            {anthropicKeySet
              ? "Skills + people extraction runs automatically when you mine channels."
              : "Add your sk-ant-... key in the Atlas toolbar to enable extraction."}
          </p>
        </section>

        {/* Skills export */}
        <section className="col-span-12 lg:col-span-8 border border-zinc-200 p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 font-[var(--font-mono)]">›_</span>
            <h3 className="text-lg font-medium text-zinc-900">Use your skills in any AI agent</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Drop your extracted skills into Claude Code, Cursor, or any agent. They run with your company&apos;s rules.
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

        {/* Skills bundle */}
        <section className="col-span-12 lg:col-span-4 border border-zinc-200 p-5">
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
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] mb-2">
              What&apos;s inside
            </div>
            <ul className="space-y-1 text-xs text-zinc-600">
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-violet-400" />
                Refund procedures &amp; exceptions
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-blue-400" />
                Deploy &amp; incident playbooks
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-emerald-400" />
                Escalation paths &amp; owners
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-amber-400" />
                Implicit rules &amp; workarounds
              </li>
            </ul>
          </div>
        </section>

        {isAdmin && (
          <section className="col-span-12 border border-zinc-200 p-6">
            <InviteTeammate workspaceId={workspaceId} />
          </section>
        )}
      </div>
    </div>
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
  const cmd = `curl -fsSL "${url}" -o /tmp/slackmap-skills.zip && \\\n  unzip -oq /tmp/slackmap-skills.zip -d ~/.claude/skills/ && \\\n  echo "Installed. Restart Claude Code to load."`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">Install your skills as Claude Code skills. Copy + paste in your terminal:</p>
      <Code value={cmd} />
    </div>
  );
}

function AgentSnippet({ workspaceId }: { workspaceId: string }) {
  const url = `${originUrl()}/api/workspace/${workspaceId}/skills.zip`;
  const cmd = `# Cursor / Aider / custom agents\ncurl -fsSL "${url}" -o skills.zip && \\\n  unzip -oq skills.zip -d ./skills/`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">For other coding agents — drop the bundle wherever your agent loads skills:</p>
      <Code value={cmd} />
    </div>
  );
}

function ApiSnippet({ workspaceId }: { workspaceId: string }) {
  const cmd = `GET ${originUrl()}/api/workspace/${workspaceId}/skills/handle-customer-refund\nAccept: text/markdown`;
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">Fetch a single skill as markdown — just-in-time guidance for your agent:</p>
      <Code value={cmd} />
      <p className="text-xs text-zinc-500 mt-2">
        List all: <code className="font-[var(--font-mono)]">GET /api/workspace/{workspaceId.slice(0, 8)}…/skills.zip</code>
      </p>
    </div>
  );
}

function Code({ value }: { value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-start gap-3">
      <pre className="flex-1 text-sm text-zinc-900 whitespace-pre overflow-x-auto font-[var(--font-mono)]">{value}</pre>
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
      const res = await fetch(`/api/workspace/${workspaceId}/invites`, { cache: "no-store" });
      if (!res.ok) { setError(`Failed (${res.status})`); setInvites([]); return; }
      setInvites(((await res.json()).invites ?? []) as Invite[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  async function createInvite() {
    setCreating(true); setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invites`, { method: "POST" });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`); return; }
      const json = await res.json();
      try { await navigator.clipboard.writeText(json.url); setCopiedId(json.invite?.id ?? "new"); setTimeout(() => setCopiedId(null), 2000); } catch {}
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setCreating(false); }
  }

  async function revoke(inviteId: string) {
    setError(null);
    const res = await fetch(`/api/workspace/${workspaceId}/invites/${inviteId}`, { method: "DELETE" });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`); return; }
    await load();
  }

  async function copy(url: string, id: string) {
    try { await navigator.clipboard.writeText(url); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch (e) { setError(e instanceof Error ? e.message : "Copy failed"); }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)]">Team</div>
          <h3 className="mt-1 text-lg font-medium text-zinc-900">Invite a teammate</h3>
          <p className="mt-1 text-sm text-zinc-500 max-w-lg leading-relaxed">Generate a one-click link. Anyone with this URL can join the workspace after signing in.</p>
        </div>
        <button onClick={createInvite} disabled={creating} className="shrink-0 text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-[var(--paper)] hover:bg-zinc-800 disabled:opacity-50">
          {creating ? "Generating…" : "Invite teammate"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-700 font-[var(--font-mono)]">{error}</p>}
      <div className="mt-5">
        {loading ? (
          <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-xs text-zinc-500 font-[var(--font-mono)] uppercase tracking-wider">No active invites yet.</p>
        ) : (
          <ul className="border border-zinc-200 divide-y divide-zinc-200">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="font-[var(--font-mono)] text-zinc-700 text-xs truncate flex-1">…{inv.token.slice(-8)}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-[var(--font-mono)] tabular-nums">{inv.uses_count}/{inv.max_uses}</span>
                <button onClick={() => copy(inv.url, inv.id)} className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 border border-zinc-300 hover:border-zinc-500 text-zinc-700 hover:text-zinc-900">
                  {copiedId === inv.id ? "Copied" : "Copy link"}
                </button>
                <button onClick={() => revoke(inv.id)} className="text-[11px] uppercase tracking-wider font-[var(--font-mono)] px-2 py-1 text-zinc-500 hover:text-red-700">Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
