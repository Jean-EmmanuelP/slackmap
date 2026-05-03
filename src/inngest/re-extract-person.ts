import { inngest, type PersonReExtractData } from "./client";
import {
  getWorkspace,
  listChannels,
  upsertPerson,
  db,
} from "@/lib/db";
import { fetchMessagesSince, sixMonthsAgoTs, slackUserOrBotClient } from "@/lib/slack";
import { extractPerson } from "@/lib/extract/people";

// Re-extract a single person's profile, optionally with a human-provided hint
// like "she's the founder" or "he's a contractor working on iOS billing only".
// The hint is treated as ground truth by the LLM.
export const reExtractPerson = inngest.createFunction(
  {
    id: "re-extract-person",
    concurrency: { limit: 3 },
    triggers: [{ event: "person/re-extract.requested" }],
  },
  async ({ event, step, logger }) => {
    const { workspaceId, slackUserId, hint } = event.data as PersonReExtractData;

    const ws = await step.run("load-ws", () => getWorkspace(workspaceId));
    const { client: slack } = slackUserOrBotClient(ws);

    // Slack profile (canonical)
    const profile = await step.run("fetch-profile", async () => {
      try {
        const res = await slack.users.info({ user: slackUserId });
        if (!res.user) return null;
        return {
          display_name: res.user.profile?.display_name || res.user.name || null,
          real_name: res.user.profile?.real_name || res.user.real_name || null,
          title: res.user.profile?.title || null,
          email: res.user.profile?.email || null,
          image_72: res.user.profile?.image_72 || null,
          is_bot: !!res.user.is_bot,
          deleted: !!res.user.deleted,
        };
      } catch (e) {
        logger.warn(`users.info failed: ${(e as Error).message}`);
        return null;
      }
    });

    if (!profile) return { error: "profile_not_found" };

    // Activity rollup
    const { data: activity } = await db()
      .from("people_activity")
      .select("slack_channel_id, message_count, last_message_ts")
      .eq("workspace_id", workspaceId)
      .eq("slack_user_id", slackUserId);

    const totalMessages = (activity ?? []).reduce(
      (a, r) => a + ((r.message_count as number) ?? 0),
      0,
    );
    const channels = await listChannels(workspaceId);
    const channelMap = new Map(channels.map((c) => [c.slack_channel_id, c]));

    const topChannels = (activity ?? [])
      .map((r) => {
        const ch = channelMap.get(r.slack_channel_id as string);
        return {
          slack_channel_id: r.slack_channel_id as string,
          name: ch?.name ?? (r.slack_channel_id as string),
          purpose: ch?.purpose_extracted ?? ch?.purpose_native ?? null,
          count: (r.message_count as number) ?? 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Re-fetch a sample of this person's messages from their top channels.
    const oldest = sixMonthsAgoTs();
    const samples: string[] = [];
    for (const tc of topChannels) {
      const msgs = await fetchMessagesSince(slack, tc.slack_channel_id, oldest, 5).catch(() => []);
      const theirs = msgs.filter((m) => m.user === slackUserId && m.text).slice(0, 10);
      for (const m of theirs) samples.push(m.text!);
      if (samples.length >= 30) break;
    }

    if (profile.is_bot || profile.deleted) {
      await upsertPerson(workspaceId, {
        slack_user_id: slackUserId,
        display_name: profile.display_name,
        real_name: profile.real_name,
        title: profile.title,
        email: profile.email,
        avatar_url: profile.image_72,
        is_bot: profile.is_bot,
        is_deleted: profile.deleted,
        message_count: totalMessages,
      });
      return { skipped: "bot_or_deleted" };
    }

    const extracted = await extractPerson({
      display_name: profile.display_name,
      real_name: profile.real_name,
      title: profile.title,
      topChannels: topChannels.map((tc) => ({
        name: tc.name,
        purpose: tc.purpose,
        count: tc.count,
      })),
      sampleMessages: samples,
      totalMessages,
      hint: hint ?? null,
    }).catch(() => ({ role: null, summary: null, tools: [], expertise: [] }));

    await upsertPerson(workspaceId, {
      slack_user_id: slackUserId,
      display_name: profile.display_name,
      real_name: profile.real_name,
      title: profile.title,
      email: profile.email,
      avatar_url: profile.image_72,
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
      message_count: totalMessages,
      confidence: Math.min(0.99, 0.4 + 0.1 * Math.log2(totalMessages + 1)),
      status: hint ? "active" : "draft",
    });

    return { ok: true, hintApplied: !!hint };
  },
);
