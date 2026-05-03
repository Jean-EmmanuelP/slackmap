import { inngest, type PeopleExtractRequestedData } from "./client";
import {
  getWorkspace,
  listChannels,
  listActiveUsers,
  upsertPerson,
} from "@/lib/db";
import { fetchMessagesSince, sixMonthsAgoTs, slackUserOrBotClient } from "@/lib/slack";
import { extractPerson } from "@/lib/extract/people";
import { extractSkillsForPerson } from "@/lib/extract/skills";
import { upsertSkill } from "@/lib/db";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

// Extract /people profiles for every active user across mined channels.
// Triggered explicitly (button on /people) or after enough channels are mined.
export const extractPeople = inngest.createFunction(
  {
    id: "extract-people",
    concurrency: { limit: 1, key: "event.data.workspaceId" },
    triggers: [{ event: "workspace/people.requested" }],
  },
  async ({ event, step, logger }) => {
    const { workspaceId } = event.data as PeopleExtractRequestedData;
    const ws = await step.run("load-ws", () => getWorkspace(workspaceId));
    const { client: slack } = slackUserOrBotClient(ws);
    const apiKey = await loadWorkspaceApiKey(workspaceId);

    const channels = await step.run("load-channels", () => listChannels(workspaceId));
    const channelMap = new Map(channels.map((c) => [c.slack_channel_id, c]));

    const users = await step.run("list-active-users", () => listActiveUsers(workspaceId, 3));
    if (users.length === 0) {
      return { workspaceId, count: 0, note: "no active users yet — mine channels first" };
    }

    // Pre-fetch messages for each mined channel so we can build per-user samples
    // without re-fetching per user. Only mined channels (where the bot has access).
    const oldest = sixMonthsAgoTs();
    const messagesByChannel = new Map<string, Array<{ ts: string; user?: string; text?: string }>>();
    const minedChannels = channels.filter((c) => c.mining_status === "done" && !c.archived);

    for (const ch of minedChannels) {
      await step.run(`fetch-${ch.slack_channel_id}`, async () => {
        const msgs = await fetchMessagesSince(slack, ch.slack_channel_id, oldest, 5).catch(() => []);
        messagesByChannel.set(ch.slack_channel_id, msgs);
      });
    }

    // Cap to 30 most-active users per run to keep cost bounded.
    const ranked = users.sort((a, b) => b.total_messages - a.total_messages).slice(0, 30);

    let processed = 0;
    for (const u of ranked) {
      await step.run(`person-${u.slack_user_id}`, async () => {
        // Slack profile
        let profile: {
          display_name?: string;
          real_name?: string;
          title?: string;
          email?: string;
          image_72?: string;
          is_bot?: boolean;
          deleted?: boolean;
        } = {};
        try {
          const res = await slack.users.info({ user: u.slack_user_id });
          if (res.user) {
            profile = {
              display_name: res.user.profile?.display_name || res.user.name,
              real_name: res.user.profile?.real_name || res.user.real_name,
              title: res.user.profile?.title,
              email: res.user.profile?.email,
              image_72: res.user.profile?.image_72,
              is_bot: !!res.user.is_bot,
              deleted: !!res.user.deleted,
            };
          }
        } catch (e) {
          logger.warn(`users.info failed for ${u.slack_user_id}: ${(e as Error)?.message}`);
        }

        if (profile.is_bot || profile.deleted) {
          // Skip bots and deleted users for the LLM step but still persist a row.
          await upsertPerson(workspaceId, {
            slack_user_id: u.slack_user_id,
            display_name: profile.display_name ?? null,
            real_name: profile.real_name ?? null,
            title: profile.title ?? null,
            email: profile.email ?? null,
            avatar_url: profile.image_72 ?? null,
            is_bot: !!profile.is_bot,
            is_deleted: !!profile.deleted,
            message_count: u.total_messages,
          });
          return;
        }

        // Build top channels for this person, with channel purpose context.
        const topChannels = u.channels
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((c) => {
            const ch = channelMap.get(c.slack_channel_id);
            return {
              slack_channel_id: c.slack_channel_id,
              name: ch?.name ?? c.slack_channel_id,
              purpose: ch?.purpose_extracted ?? ch?.purpose_native ?? null,
              count: c.count,
            };
          });

        // Sample of this person's actual messages (across their top channels).
        const samples: string[] = [];
        for (const tc of topChannels) {
          const msgs = messagesByChannel.get(tc.slack_channel_id) ?? [];
          const theirs = msgs.filter((m) => m.user === u.slack_user_id && m.text).slice(0, 10);
          for (const m of theirs) samples.push(m.text!);
          if (samples.length >= 30) break;
        }

        const extracted = await extractPerson({
          display_name: profile.display_name ?? null,
          real_name: profile.real_name ?? null,
          title: profile.title ?? null,
          topChannels: topChannels.map((tc) => ({ name: tc.name, purpose: tc.purpose, count: tc.count })),
          sampleMessages: samples,
          totalMessages: u.total_messages,
        }, apiKey).catch(() => ({ role: null, summary: null, tools: [], expertise: [] }));

        await upsertPerson(workspaceId, {
          slack_user_id: u.slack_user_id,
          display_name: profile.display_name ?? null,
          real_name: profile.real_name ?? null,
          title: profile.title ?? null,
          email: profile.email ?? null,
          avatar_url: profile.image_72 ?? null,
          is_bot: false,
          is_deleted: false,
          role_extracted: extracted.role,
          summary: extracted.summary,
          tools: extracted.tools,
          expertise: extracted.expertise,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          top_channels: topChannels.map((tc) => ({
            slack_channel_id: tc.slack_channel_id,
            name: tc.name,
            count: tc.count,
          })) as any,
          message_count: u.total_messages,
          confidence: Math.min(0.99, 0.4 + 0.1 * Math.log2(u.total_messages + 1)),
          status: "draft",
        });

        // Generate executable skills tied to this person's role + tools.
        // Channel-based skill extraction misses informal teams; people-based
        // catches "Sarah handles refunds" → handle-refund skill.
        if (extracted.role) {
          const personSkills = await extractSkillsForPerson({
            displayName: profile.display_name ?? profile.real_name ?? u.slack_user_id,
            role: extracted.role,
            summary: extracted.summary,
            tools: extracted.tools,
            expertise: extracted.expertise,
            topChannels: topChannels.map((tc) => ({ name: tc.name, purpose: tc.purpose })),
          }, apiKey).catch(() => []);
          for (const s of personSkills) {
            await upsertSkill(workspaceId, s);
          }
        }
        processed++;
      });
    }

    // Once people are profiled, automatically kick off skills extraction so
    // procedures/policies tied to those people get materialized too.
    await step.sendEvent("trigger-skills-after-people", {
      name: "workspace/skills.requested",
      data: { workspaceId },
    });

    return { workspaceId, processed };
  },
);
