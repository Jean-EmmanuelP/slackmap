// Slack-as-context for the support agent. When the workspace has nominated
// one or more Slack channels (workspace.slack_context_channel_ids), we fetch
// the last ~30 messages from each at draft time and inject them into the
// prompt as "## Recent Slack context — dev/ops discussions".
//
// The goal: let the LLM cite real fix timelines and ongoing dev work when
// answering a customer ticket. Without this context the agent has no way
// to know "auth bug being fixed in tonight's deploy" and ends up escalating
// every "problème accès appli" to human review.
//
// Phase 1 (now): READ-ONLY. Fetch + inject. The agent never posts to Slack.
// Phase 2 (later, gated): the agent posts a summary of new Freshdesk tickets
// to the channel so devs are kept aware. Explicitly OFF for now.

import { WebClient } from "@slack/web-api";
import type { Channel } from "@/lib/db";

// Channel-name heuristics for auto-detection. Score boosts when the channel
// name contains any of these tokens. French + English keywords intentional —
// French companies often have channels named "bugs-fr" or "support-fr".
const CONTEXT_KEYWORDS = [
  "bug",
  "support",
  "ops",
  "fix",
  "issue",
  "incident",
  "engineering",
  "engineer",
  "dev",
  "tech",
  "hotfix",
  "release",
  "deploy",
  "outage",
  "regression",
  "qa",
  "triage",
];

export type SuggestionScore = {
  channelId: string; // slack_channel_id
  dbId: string; // internal uuid
  name: string;
  score: number;
  reasons: string[];
  messageCount: number;
  lastMessageAt: string | null;
};

/**
 * Score channels by relevance for "agent listening context". Returns the
 * top-ranked candidates with a transparent reasoning array so the user can
 * see why each was picked.
 */
export function suggestContextChannels(channels: Channel[], topN = 8): SuggestionScore[] {
  const scored: SuggestionScore[] = channels
    .filter((c) => !c.archived)
    .map((c) => {
      const name = c.name.toLowerCase();
      const reasons: string[] = [];
      let score = 0;

      // Name match — primary signal. Each matched keyword adds 10 points.
      for (const kw of CONTEXT_KEYWORDS) {
        if (name.includes(kw)) {
          score += 10;
          reasons.push(`name contains "${kw}"`);
        }
      }

      // Activity signal: heavier-traffic channels are more likely to contain
      // live ops chatter. Capped to avoid swamping the name signal.
      if (c.message_count_6mo > 0) {
        const activityBoost = Math.min(20, Math.log10(c.message_count_6mo) * 5);
        if (activityBoost >= 5) {
          score += activityBoost;
          reasons.push(`${c.message_count_6mo} msgs in last 6mo`);
        }
      }

      // Recency: channel active in the last 14 days
      if (c.last_message_at) {
        const ageDays = (Date.now() - new Date(c.last_message_at).getTime()) / 86_400_000;
        if (ageDays < 14) {
          score += 5;
          reasons.push(`active ${Math.round(ageDays)}d ago`);
        }
      }

      // Penalty for channels that look like general/social — they pollute context
      if (/(random|general|fun|annonce|coffee|hr|admin)/.test(name)) {
        score -= 8;
        reasons.push("looks general/social (penalty)");
      }

      return {
        channelId: c.slack_channel_id,
        dbId: c.id,
        name: c.name,
        score,
        reasons,
        messageCount: c.message_count_6mo,
        lastMessageAt: c.last_message_at,
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scored;
}

/**
 * Fetch the last N messages from a list of Slack channels and format them
 * as a single context block for the drafting prompt. Returns null if no
 * channels are configured or if every fetch failed.
 *
 * Failure semantics: per-channel fetch errors are swallowed (logged via the
 * caller's catch) — better to inject partial context than block drafting.
 */
export async function buildSlackContextBlock(
  slack: WebClient,
  channels: Array<{ slack_channel_id: string; name: string }>,
  messagesPerChannel = 30,
): Promise<string | null> {
  if (channels.length === 0) return null;

  const blocks: string[] = [];

  for (const c of channels) {
    try {
      const res = await slack.conversations.history({
        channel: c.slack_channel_id,
        limit: messagesPerChannel,
      });
      const messages = (res.messages ?? [])
        .filter((m) => m.type === "message" && !m.subtype && m.text)
        .reverse(); // chronological order: oldest first inside the channel

      if (messages.length === 0) continue;

      const lines = messages.map((m) => {
        const ts = m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString().slice(0, 16) : "?";
        const user = m.user ?? m.bot_id ?? "?";
        const text = (m.text ?? "").replace(/\s+/g, " ").slice(0, 400);
        return `  [${ts}] <${user}> ${text}`;
      });
      blocks.push(`### #${c.name}\n${lines.join("\n")}`);
    } catch {
      // Skip — partial context > no context. Per-channel errors caught silently.
    }
  }

  if (blocks.length === 0) return null;

  return [
    "The following is RECENT live activity from the workspace's nominated Slack channels.",
    "Use it to ground the draft in real dev/ops state — known bugs, in-progress fixes,",
    "estimated release dates, decisions made by the team. Do NOT invent facts not present here.",
    "If the channel mentions a fix is scheduled or shipped, cite it; otherwise stay honest about uncertainty.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
