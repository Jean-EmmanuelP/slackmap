import { inngest, type BackfillRequestedData } from "./client";
import {
  getWorkspace,
  upsertChannels,
  setBackfillStatus,
} from "@/lib/db";
import { slackUserOrBotClient } from "@/lib/slack";

// Initial backfill = ONLY list the workspace's channels (public + private the
// bot is invited to). Per-channel mining is triggered by the user via UI.
export const backfill = inngest.createFunction(
  {
    id: "backfill",
    concurrency: { limit: 1, key: "event.data.workspaceId" },
    triggers: [{ event: "workspace/backfill.requested" }],
  },
  async ({ event, step, logger }) => {
    const { workspaceId } = event.data as BackfillRequestedData;
    const ws = await step.run("load-workspace", () => getWorkspace(workspaceId));
    await step.run("mark-running", () =>
      setBackfillStatus(workspaceId, "running", { backfill_progress: 0, backfill_error: null }),
    );

    const { client: slack } = slackUserOrBotClient(ws);

    const channels = await step.run("list-channels", async () => {
      const all: Array<{
        slack_channel_id: string;
        name: string;
        topic: string | null;
        purpose_native: string | null;
        is_private: boolean;
        archived: boolean;
      }> = [];
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const res = await slack.conversations
          .list({
            types: "public_channel,private_channel",
            limit: 200,
            cursor,
            exclude_archived: false,
          })
          .catch((err) => {
            logger.warn(`conversations.list failed: ${err?.data?.error ?? err?.message}`);
            return { channels: [], response_metadata: { next_cursor: "" } };
          });
        for (const c of (res as { channels?: Array<{ id?: string; name?: string; topic?: { value?: string }; purpose?: { value?: string }; is_private?: boolean; is_archived?: boolean }> }).channels ?? []) {
          if (!c.id || !c.name) continue;
          all.push({
            slack_channel_id: c.id,
            name: c.name,
            topic: c.topic?.value ?? null,
            purpose_native: c.purpose?.value ?? null,
            is_private: !!c.is_private,
            archived: !!c.is_archived,
          });
        }
        cursor = (res as { response_metadata?: { next_cursor?: string } }).response_metadata?.next_cursor;
        if (!cursor) break;
      }
      const upserted = await upsertChannels(workspaceId, all);
      return upserted;
    });

    await step.run("mark-ready", () =>
      setBackfillStatus(workspaceId, "ready", { backfill_total: channels.length }),
    );

    return { workspaceId, channelCount: channels.length };
  },
);
