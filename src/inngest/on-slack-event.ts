import { inngest, type SlackEventData } from "./client";
import {
  getWorkspaceBySlackTeam,
  upsertChannels,
  updateChannel,
  upsertGlossary,
  getKnownTerms,
  bumpOccurrences,
  bumpLastEventReceivedAt,
  db,
} from "@/lib/db";
import { slackClientForWorkspace } from "@/lib/slack";
import { extractAcronymCandidates, llmDefineTerms } from "@/lib/extract/glossary";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

// Narrow Slack event channel field. message.* events deliver string IDs,
// channel_created delivers an object, channel_archive a string. We accept all.
function channelIdOf(ev: SlackEventData["event"]): string | null {
  const c = ev.channel;
  if (!c) return null;
  if (typeof c === "string") return c;
  if (typeof c === "object" && "id" in c && typeof c.id === "string") return c.id;
  return null;
}

function channelObjOf(ev: SlackEventData["event"]): { id?: string; name?: string; purpose?: string } | null {
  const c = ev.channel;
  if (!c || typeof c !== "object") return null;
  return c;
}

export const onSlackEvent = inngest.createFunction(
  {
    id: "on-slack-event",
    concurrency: { limit: 5 },
    triggers: [{ event: "slack/event.received" }],
  },
  async ({ event, step, logger }) => {
    const data = event.data as SlackEventData;
    const ws = await step.run("load-ws", () => getWorkspaceBySlackTeam(data.teamId));
    if (!ws) {
      logger.warn(`No workspace for team ${data.teamId}, skipping`);
      return;
    }
    const ev = data.event;
    await step.run("bump-last-event", () => bumpLastEventReceivedAt(ws.id));

    if (ev.type === "message" && !ev.subtype && ev.text) {
      const channelId = channelIdOf(ev);
      if (!channelId) return;

      const synthetic = [{ ts: ev.ts ?? `${Date.now() / 1000}`, user: ev.user, text: ev.text }];
      // Duplicate so count >= 2 passes the regex filter; the LLM define call will
      // still skip noise terms (returns skip:true).
      const candidates = extractAcronymCandidates([...synthetic, ...synthetic]);
      if (candidates.length === 0) return;

      // Inngest steps must return JSON-serializable values. Convert Set→array.
      const knownArr = await step.run("known-terms", async () => {
        const set = await getKnownTerms(
          ws.id,
          candidates.map((c) => c.term),
        );
        return Array.from(set);
      });
      const known = new Set(knownArr);

      const newTerms = candidates.filter((c) => !known.has(c.term));
      const seenTerms = candidates.filter((c) => known.has(c.term)).map((c) => c.term);

      if (seenTerms.length > 0) {
        await step.run("bump-known", () => bumpOccurrences(ws.id, seenTerms));
      }
      if (newTerms.length > 0) {
        const apiKey = await loadWorkspaceApiKey(ws.id);
        await step.run("define-new", async () => {
          const defined = await llmDefineTerms(newTerms, channelId, apiKey).catch(() => []);
          if (defined.length > 0) {
            const stamped = defined.map((d) => ({ ...d, first_seen_ts: ev.ts ?? d.first_seen_ts }));
            await upsertGlossary(ws.id, stamped);
          }
        });
      }
      return;
    }

    if (ev.type === "channel_created") {
      const ch = channelObjOf(ev);
      if (!ch?.id || !ch?.name) return;
      await step.run("new-channel", async () => {
        await upsertChannels(ws.id, [
          {
            slack_channel_id: ch.id!,
            name: ch.name!,
            topic: null,
            purpose_native: ch.purpose ?? null,
            archived: false,
            is_private: false,
          },
        ]);
      });
      return;
    }

    if (ev.type === "channel_rename") {
      const ch = channelObjOf(ev);
      if (!ch?.id) return;
      await step.run("rename-channel", async () => {
        const slack = slackClientForWorkspace(ws.encrypted_bot_token);
        const info = await slack.conversations.info({ channel: ch.id! });
        if (info.channel?.id && info.channel?.name) {
          await upsertChannels(ws.id, [
            {
              slack_channel_id: info.channel.id,
              name: info.channel.name,
              topic: info.channel.topic?.value ?? null,
              purpose_native: info.channel.purpose?.value ?? null,
              archived: !!info.channel.is_archived,
              is_private: !!info.channel.is_private,
            },
          ]);
        }
      });
      return;
    }

    if (ev.type === "channel_archive" || ev.type === "channel_unarchive") {
      const channelId = channelIdOf(ev);
      if (!channelId) return;
      const archived = ev.type === "channel_archive";
      await step.run("archive-toggle", async () => {
        const { data: row } = await db()
          .from("channels")
          .select("id")
          .eq("workspace_id", ws.id)
          .eq("slack_channel_id", channelId)
          .maybeSingle();
        if (row?.id) await updateChannel(row.id as string, { archived });
      });
      return;
    }
  },
);
