"use client";

import { useState } from "react";

type Counts = {
  channels: number;
  minedChannels: number;
  skills: number;
  skillsBySource: { slack: number; freshdesk: number };
  people: number;
  glossary: number;
};

type Sources = { slack: boolean; freshdesk: boolean };

const WELCOME_CARDS = [
  {
    label: "WELCOME",
    title: "Slackmap is your company brain",
    body: "Connect your tools — Slack, Freshdesk, more — and Slackmap pulls knowledge out of fragmented sources, structures it, keeps it current, and turns it into executable skills your AI agents can run.",
  },
  {
    label: "HOW IT WORKS",
    title: "Three views over the same brain",
    body: "Atlas shows what each Slack channel is actually used for. People shows AI-extracted profiles per teammate. Skills exports the procedures + policies as Claude-skill-compatible markdown.",
  },
  {
    label: "MULTI-SOURCE",
    title: "Slack first, then your stack",
    body: "Slack and Freshdesk are live. Notion, Linear, GitHub coming. Each connector enriches the same knowledge graph — skills are tagged with their source so you trace every decision back to the message or ticket that produced it.",
  },
  {
    label: "INSTALL",
    title: "Drop skills into any AI agent",
    body: "Export the skills bundle and your Claude Code, Cursor, or custom agent acts on your company's actual rules — refund thresholds, escalation paths, deploy policies — with citations to the original source.",
  },
];

export function HomeDashboard({
  workspaceId,
  workspaceName,
  sources,
  anthropicKeySet,
  counts,
}: {
  workspaceId: string;
  workspaceName: string;
  sources: Sources;
  anthropicKeySet: boolean;
  counts: Counts;
}) {
  const [card, setCard] = useState(0);
  const [tab, setTab] = useState<"cli" | "agent" | "api">("cli");

  return (
    <div className="flex-1 px-8 py-6 overflow-auto">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-zinc-50">
          {workspaceName}
        </h1>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-700 text-zinc-300 text-xs">
          <span className="size-1.5 rounded-full bg-zinc-500" />
          Organization
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Welcome back, your company brain is live.</p>

      <div className="mt-8 grid grid-cols-12 gap-4">
        {/* Welcome carousel */}
        <section className="col-span-12 lg:col-span-8 border border-zinc-800 p-6 min-h-[180px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 px-2 py-0.5 border border-zinc-800">
                {WELCOME_CARDS[card].label}
              </span>
              <span className="text-xs text-zinc-500">
                {card + 1}/{WELCOME_CARDS.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="https://github.com/Jean-EmmanuelP/slackmap"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1"
              >
                Docs →
              </a>
              <button
                onClick={() => setCard((c) => (c - 1 + WELCOME_CARDS.length) % WELCOME_CARDS.length)}
                className="size-7 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-100"
                aria-label="Prev"
              >
                ‹
              </button>
              <button
                onClick={() => setCard((c) => (c + 1) % WELCOME_CARDS.length)}
                className="size-7 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-100"
                aria-label="Next"
              >
                ›
              </button>
            </div>
          </div>
          <h2 className="text-xl font-medium text-zinc-100">{WELCOME_CARDS[card].title}</h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-3xl">
            {WELCOME_CARDS[card].body}
          </p>
          <div className="mt-auto pt-4 flex gap-1.5">
            {WELCOME_CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCard(i)}
                className={`h-0.5 w-8 transition-colors ${i === card ? "bg-zinc-100" : "bg-zinc-800"}`}
              />
            ))}
          </div>
        </section>

        {/* Sources panel */}
        <section className="col-span-12 lg:col-span-4 border border-zinc-800 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">
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
        <section className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800">
          <Stat label="Channels" value={counts.channels} hint={`${counts.minedChannels} mined`} />
          <Stat label="People" value={counts.people} />
          <Stat label="Skills" value={counts.skills} hint="exportable" />
          <Stat label="Glossary" value={counts.glossary} hint="terms" />
        </section>

        {/* Install / quick start */}
        <section className="col-span-12 lg:col-span-8 border border-zinc-800 p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-500 font-mono">›_</span>
            <h3 className="text-lg font-medium text-zinc-100">Use your skills in Claude Code</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Drop your extracted skills into any AI agent. They run with your company&apos;s actual rules.
          </p>

          <div className="mt-4 flex border-b border-zinc-800">
            {(["cli", "agent", "api"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs uppercase tracking-wider ${
                  tab === t
                    ? "text-zinc-100 border-b-2 border-zinc-100"
                    : "text-zinc-500 hover:text-zinc-200"
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

        {/* Right sidebar: Anthropic key + Skills bundle */}
        <section className="col-span-12 lg:col-span-4 space-y-4">
          <div className="border border-zinc-800 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">LLM key</span>
              <span
                className={`size-1.5 rounded-full ${anthropicKeySet ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </div>
            <div className="mt-2 text-sm text-zinc-200">
              {anthropicKeySet ? "Anthropic key set" : "No Anthropic key yet"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {anthropicKeySet
                ? "Skills + people extraction will run automatically when you mine channels."
                : "Add your sk-ant-... in the Atlas toolbar to enable LLM extraction."}
            </div>
          </div>

          <div className="border border-zinc-800 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Skills bundle</span>
              <a
                href={`/api/workspace/${workspaceId}/skills.zip`}
                className="text-xs text-zinc-300 hover:text-zinc-50"
              >
                Download all
              </a>
            </div>
            <div className="mt-2 text-sm text-zinc-200">
              {counts.skills} skills · ready to drop into Claude
            </div>
            <div className="mt-1 text-xs text-zinc-500">
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
          connected ? "bg-emerald-500" : comingSoon ? "bg-zinc-700" : "bg-zinc-600"
        }`}
      />
      <span className={connected ? "text-zinc-100" : "text-zinc-500"}>{name}</span>
      {connected && count !== undefined && (
        <span className="ml-auto text-xs text-zinc-500 tabular-nums">{count} skills</span>
      )}
      {comingSoon && (
        <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-600">soon</span>
      )}
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-zinc-950 px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-medium text-zinc-50 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function CliSnippet({ workspaceId }: { workspaceId: string }) {
  const cmd = `npx @slackmap/skills install ${workspaceId.slice(0, 8)}…`;
  return (
    <div>
      <p className="text-sm text-zinc-400 mb-2">Install your skills as Claude Code skills:</p>
      <Code value={cmd} />
      <p className="text-xs text-zinc-500 mt-2">
        Coming soon — for now, click <span className="text-zinc-300">Download all</span> on the right.
      </p>
    </div>
  );
}

function AgentSnippet({ workspaceId }: { workspaceId: string }) {
  const cmd = `curl -O https://slackmap.io/api/workspace/${workspaceId}/skills.zip\nunzip skills.zip -d ~/.claude/skills/`;
  return (
    <div>
      <p className="text-sm text-zinc-400 mb-2">For other coding agents (Cursor, Aider, etc.):</p>
      <Code value={cmd} />
    </div>
  );
}

function ApiSnippet({ workspaceId }: { workspaceId: string }) {
  const cmd = `GET https://slackmap.io/api/workspace/${workspaceId}/skills/<slug>\nAccept: text/markdown`;
  return (
    <div>
      <p className="text-sm text-zinc-400 mb-2">Fetch a single skill as Claude-skill markdown:</p>
      <Code value={cmd} />
    </div>
  );
}

function Code({ value }: { value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 px-4 py-3 flex items-start gap-3">
      <pre className="flex-1 text-sm text-zinc-200 whitespace-pre overflow-x-auto">{value}</pre>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="text-xs text-zinc-500 hover:text-zinc-100 px-2 py-1 border border-zinc-800"
      >
        Copy
      </button>
    </div>
  );
}
