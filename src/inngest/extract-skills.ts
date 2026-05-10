import { inngest, type SkillsExtractRequestedData } from "./client";
import {
  getWorkspace,
  listChannels,
  upsertSkill,
  markChannelSkillsExtracted,
} from "@/lib/db";
import { fetchMessagesSince, sixMonthsAgoTs, slackUserOrBotClient } from "@/lib/slack";
import { extractSkillsFromChannel } from "@/lib/extract/skills";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

// Extract executable skills (procedures, policies, decisions) from
// eng/ops/support channels. Runs after backfill categorization, or on demand.
export const extractSkills = inngest.createFunction(
  {
    id: "extract-skills",
    concurrency: { limit: 1, key: "event.data.workspaceId" },
    triggers: [{ event: "workspace/skills.requested" }],
  },
  async ({ event, step, logger }) => {
    const { workspaceId } = event.data as SkillsExtractRequestedData;
    const ws = await step.run("load-ws", () => getWorkspace(workspaceId));
    const { client: slack } = slackUserOrBotClient(ws);
    // Do not persist the decrypted key in Inngest step state — load fresh each run.
    const apiKey = await loadWorkspaceApiKey(workspaceId);

    const allChannels = await step.run("list-channels", () => listChannels(workspaceId));

    // Skills only make sense from channels with operational discussion. Skip
    // social/announcements categories — too noisy, no procedures.
    const targetCats = new Set(["eng", "ops", "support", "product"]);
    const channels = allChannels.filter(
      (c) => !c.archived && (!c.category || targetCats.has(c.category)) && c.message_count_6mo >= 20,
    );

    const oldest = sixMonthsAgoTs();
    let totalFound = 0;

    for (const ch of channels) {
      await step.run(`skills-${ch.slack_channel_id}`, async () => {
        const messages = await fetchMessagesSince(slack, ch.slack_channel_id, oldest, 10).catch(
          (err) => {
            logger.warn(`skills fetch failed for ${ch.name}: ${err?.data?.error ?? err?.message}`);
            return [];
          },
        );
        if (messages.length < 20) return;

        const skills = await extractSkillsFromChannel(
          ch.slack_channel_id,
          ch.name,
          messages,
          apiKey,
          ws,
        ).catch((e) => {
          logger.warn(`skills LLM failed for ${ch.name}: ${e?.message}`);
          return [];
        });

        for (const s of skills) {
          await upsertSkill(workspaceId, s);
        }

        const oldestMsg = messages[messages.length - 1]?.ts ?? oldest;
        const latestMsg = messages[0]?.ts ?? oldest;
        await markChannelSkillsExtracted(
          workspaceId,
          ch.id,
          oldestMsg,
          latestMsg,
          skills.length,
        );
        totalFound += skills.length;
      });
    }

    return { workspaceId, channelsScanned: channels.length, skillsFound: totalFound };
  },
);
