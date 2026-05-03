import { inngest, type MineChannelRequestedData } from "./client";
import {
  getWorkspace,
  getChannel,
  setChannelMining,
  updateChannel,
  upsertGlossary,
  bumpPersonActivity,
} from "@/lib/db";
import { fetchMessagesSince, sixMonthsAgoTs, slackUserOrBotClient } from "@/lib/slack";
import { extractChannelPurpose } from "@/lib/extract/channel-purpose";
import { extractAcronymCandidates, llmDefineTerms } from "@/lib/extract/glossary";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

function computeMetrics(messages: Array<{ user?: string; ts: string }>) {
  const users = new Set<string>();
  let lastTs = "0";
  for (const m of messages) {
    if (m.user) users.add(m.user);
    if (m.ts && m.ts > lastTs) lastTs = m.ts;
  }
  return {
    message_count_6mo: messages.length,
    unique_contributors: users.size,
    last_message_at: lastTs !== "0" ? new Date(parseFloat(lastTs) * 1000).toISOString() : null,
  };
}

// Mine ONE channel: join (if public) → fetch 6mo messages → extract purpose +
// glossary. Triggered by the UI via the "Mine this channel" button.
export const mineChannel = inngest.createFunction(
  {
    id: "mine-channel",
    concurrency: { limit: 3 },
    triggers: [{ event: "channel/mine.requested" }],
  },
  async ({ event, step, logger }) => {
    const { workspaceId, channelDbId } = event.data as MineChannelRequestedData;

    const ws = await step.run("load-ws", () => getWorkspace(workspaceId));
    const ch = await step.run("load-channel", () => getChannel(channelDbId));
    if (!ch) {
      logger.warn(`channel ${channelDbId} not found`);
      return { skipped: true };
    }

    await step.run("mark-running", () =>
      setChannelMining(channelDbId, { mining_status: "running", mining_error: null }),
    );

    const { client: slack, isUserToken } = slackUserOrBotClient(ws);

    // Bot mode: bot must be in the channel — self-join publics. User-token
    // mode: no join needed (silent, sees everything user sees).
    if (!isUserToken && !ch.is_private) {
      await step.run("join", async () => {
        await slack.conversations
          .join({ channel: ch.slack_channel_id })
          .catch((e) => logger.warn(`join failed for ${ch.name}: ${e?.data?.error ?? e?.message}`));
      });
    }

    const oldest = sixMonthsAgoTs();

    const messages = await step.run("fetch-messages", async () => {
      return fetchMessagesSince(slack, ch.slack_channel_id, oldest, 10).catch(async (err) => {
        const errStr = err?.data?.error ?? err?.message ?? "unknown";
        await setChannelMining(channelDbId, {
          mining_status: "failed",
          mining_error: `fetch: ${errStr}`,
          mining_last_run_at: new Date().toISOString(),
        });
        throw new Error(errStr);
      });
    });

    const metrics = computeMetrics(messages);
    await step.run("update-metrics", () => updateChannel(channelDbId, metrics));

    // Roll up per-user message counts so we can build /people profiles later.
    await step.run("update-people-activity", async () => {
      const perUser = new Map<string, { count: number; lastTs: string }>();
      for (const m of messages) {
        if (!m.user) continue;
        const existing = perUser.get(m.user) ?? { count: 0, lastTs: "0" };
        existing.count += 1;
        if (m.ts > existing.lastTs) existing.lastTs = m.ts;
        perUser.set(m.user, existing);
      }
      for (const [userId, agg] of perUser.entries()) {
        await bumpPersonActivity(workspaceId, userId, ch.slack_channel_id, agg.count, agg.lastTs);
      }
    });

    if (messages.length >= 5) {
      const apiKey = await loadWorkspaceApiKey(workspaceId);

      await step.run("extract-purpose", async () => {
        const purpose = await extractChannelPurpose(ch.name, messages, apiKey).catch(() => null);
        if (purpose) await updateChannel(channelDbId, { purpose_extracted: purpose });
      });

      await step.run("extract-glossary", async () => {
        const candidates = extractAcronymCandidates(messages);
        if (candidates.length === 0) return;
        const entries = await llmDefineTerms(candidates, ch.slack_channel_id, apiKey).catch(() => []);
        if (entries.length > 0) await upsertGlossary(workspaceId, entries);
      });
    }

    await step.run("mark-done", () =>
      setChannelMining(channelDbId, {
        mining_status: "done",
        mining_last_run_at: new Date().toISOString(),
        mining_error: null,
      }),
    );

    return {
      channelDbId,
      channelName: ch.name,
      messageCount: messages.length,
    };
  },
);
