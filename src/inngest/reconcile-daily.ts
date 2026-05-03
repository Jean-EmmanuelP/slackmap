import { inngest } from "./client";
import { db, listChannels, upsertChannels, updateChannel } from "@/lib/db";
import { slackUserOrBotClient, fetchMessagesSince } from "@/lib/slack";

// Daily 04:00 UTC: refetch channel list + last 24h messages per workspace,
// upsert delta. Catches anything missed by the live webhook (network blips,
// Slack delivery hiccups, races during deploy).
export const reconcileDaily = inngest.createFunction(
  {
    id: "reconcile-daily",
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step, logger }) => {
    const { data: workspaces } = await db()
      .from("workspaces")
      .select("*")
      .eq("backfill_status", "ready");

    if (!workspaces || workspaces.length === 0) return;

    for (const ws of workspaces) {
      await step.run(`reconcile-${ws.id}`, async () => {
        try {
          const { client: slack } = slackUserOrBotClient(ws);
          // Refresh channel list (catch new/renamed/archived channels).
          let cursor: string | undefined;
          const fresh: Array<{
            slack_channel_id: string;
            name: string;
            topic: string | null;
            purpose_native: string | null;
            is_private: boolean;
            archived: boolean;
          }> = [];
          for (let i = 0; i < 20; i++) {
            const res = await slack.conversations.list({
              types: "public_channel,private_channel",
              limit: 200,
              cursor,
              exclude_archived: false,
            });
            for (const c of res.channels ?? []) {
              if (!c.id || !c.name) continue;
              fresh.push({
                slack_channel_id: c.id,
                name: c.name,
                topic: c.topic?.value ?? null,
                purpose_native: c.purpose?.value ?? null,
                is_private: !!c.is_private,
                archived: !!c.is_archived,
              });
            }
            cursor = res.response_metadata?.next_cursor;
            if (!cursor) break;
          }
          await upsertChannels(ws.id, fresh);

          // Refresh metrics for top 50 channels (last 24h delta).
          const dayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000).toString();
          const channels = (await listChannels(ws.id)).slice(0, 50);
          for (const ch of channels) {
            const msgs = await fetchMessagesSince(slack, ch.slack_channel_id, dayAgo, 3).catch(
              () => [],
            );
            if (msgs.length > 0) {
              const lastTs = msgs.reduce((a, b) => (a.ts > b.ts ? a : b)).ts;
              await updateChannel(ch.id, {
                last_message_at: new Date(parseFloat(lastTs) * 1000).toISOString(),
                message_count_6mo: ch.message_count_6mo + msgs.length,
              });
            }
          }
        } catch (err) {
          logger.error(`reconcile failed for ${ws.id}`, err);
        }
      });
    }
  },
);
