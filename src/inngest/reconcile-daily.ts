import { inngest } from "./client";
import {
  db,
  listChannels,
  upsertChannels,
  updateChannel,
  mergeDraftSkills,
  upsertGlossary,
  bumpPersonActivity,
  upsertPerson,
} from "@/lib/db";
import { slackUserOrBotClient, fetchMessagesSince } from "@/lib/slack";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";
import { extractPerson } from "@/lib/extract/people";
import { extractAcronymCandidates, llmDefineTerms } from "@/lib/extract/glossary";
import { listActiveUsers } from "@/lib/db";

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

          const dayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000).toString();
          const channels = (await listChannels(ws.id)).slice(0, 50);
          const allNewMsgs: Array<{ channelId: string; msgs: any[] }> = [];

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
              allNewMsgs.push({ channelId: ch.slack_channel_id, msgs });
              for (const m of msgs as Array<{ user?: string; bot_id?: string; ts: string }>) {
                if (m.user && !m.bot_id) {
                  await bumpPersonActivity(ws.id, m.user, ch.slack_channel_id, 1, m.ts);
                }
              }
            }
          }

          const mergeResult = await mergeDraftSkills(ws.id, {
            info: (msg) => logger.info(`[merge] ${msg}`),
          });
          logger.info(`Merge result for ${ws.id}: ${mergeResult.merged} merged, ${mergeResult.promoted} promoted`);

          const llmKey = await loadWorkspaceApiKey(ws.id);
          if (llmKey && allNewMsgs.length > 0) {
            const flatMsgs = allNewMsgs.flatMap(({ msgs }) => msgs);
            if (flatMsgs.length >= 10) {
              const candidates = extractAcronymCandidates(flatMsgs);
              if (candidates.length > 0) {
                const defined = await llmDefineTerms(candidates.slice(0, 20), "daily-reconcile", llmKey, ws).catch(() => []);
                if (defined.length > 0) {
                  await upsertGlossary(
                    ws.id,
                    defined.map((d) => ({
                      term: d.term,
                      definition: d.definition,
                      category: d.category,
                      source: "slack" as const,
                    })),
                  );
                  logger.info(`Glossary: ${defined.length} new/updated terms for ${ws.id}`);
                }
              }
            }

            try {
              const activeUsers = await listActiveUsers(ws.id, 5);
              const { data: existingPeople } = await db()
                .from("people")
                .select("slack_user_id, role_extracted, confidence")
                .eq("workspace_id", ws.id)
                .neq("status", "former");

              const peopleMap = new Map(
                (existingPeople ?? []).map((p: any) => [p.slack_user_id, p]),
              );

              const channelById = new Map(channels.map((c) => [c.slack_channel_id, c]));

              for (const u of activeUsers.slice(0, 15)) {
                const existing = peopleMap.get(u.slack_user_id);
                if (existing && (existing.confidence ?? 0) >= 0.9) continue;

                const profileRes = await slack.users.info({ user: u.slack_user_id }).catch(() => null as any);
                const p = profileRes?.profile as { display_name?: string; real_name?: string; real_name_normalized?: string; title?: string; email?: string; image_72?: string } | null;

                const sampleMsgs = flatMsgs
                  .filter((m) => m.user === u.slack_user_id && m.text && m.text.length > 20)
                  .slice(0, 15)
                  .map((m) => m.text);

                if (sampleMsgs.length < 3) continue;

                const topChannels = u.channels
                  ?.slice(0, 3)
                  .map((c) => {
                    const ch = channelById.get(c.slack_channel_id);
                    return { name: ch?.name ?? c.slack_channel_id, purpose: ch?.purpose_native ?? null, count: c.count };
                  }) ?? [];

                const extracted = await extractPerson(
                  {
                    display_name: p?.display_name || p?.real_name || u.slack_user_id,
                    real_name: p?.real_name_normalized || null,
                    title: p?.title || null,
                    topChannels,
                    sampleMessages: sampleMsgs,
                    totalMessages: u.total_messages,
                  },
                  llmKey,
                  ws,
                );

                await upsertPerson(ws.id, {
                  slack_user_id: u.slack_user_id,
                  display_name: p?.display_name || p?.real_name || u.slack_user_id,
                  real_name: p?.real_name_normalized || null,
                  title: p?.title || null,
                  email: p?.email || null,
                  avatar_url: p?.image_72 || null,
                  is_bot: false,
                  role_extracted: extracted.role,
                  summary: extracted.summary,
                  tools: extracted.tools,
                  expertise: extracted.expertise,
                  confidence: existing ? Math.min(0.99, (existing.confidence ?? 0.5) + 0.1) : 0.7,
                  status: "active",
                });
              }
              logger.info(`People enrichment done for ${ws.id}`);
            } catch (err) {
              logger.error(`People enrichment failed for ${ws.id}: ${(err as Error).message}`);
            }
          }
        } catch (err) {
          logger.error(`reconcile failed for ${ws.id}`, err);
        }
      });
    }
  },
);
