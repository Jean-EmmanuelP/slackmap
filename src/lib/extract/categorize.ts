import { llmCall, parseJsonBlock } from "./anthropic";

type Input = { slack_channel_id: string; name: string; purpose_extracted: string | null };

const SYSTEM = `You categorize Slack channels of a company into ONE of these buckets:
- "eng": engineering / dev / infra / DevOps
- "product": product, design, UX research, roadmap
- "ops": operations, finance, legal, HR, people, admin
- "support": customer support, success, account management
- "sales": sales, biz dev, partnerships, marketing
- "social": water-cooler, random, fun, social
- "announcements": company-wide announcements, news
- "other": anything that doesn't fit cleanly

Look at name + extracted purpose. Output ONLY JSON, an array same order as input:
[{"slack_channel_id":"C123","category":"eng"}, ...]`;

export type ChannelCategory = { slack_channel_id: string; category: string };

export async function llmCategorize(channels: Input[]): Promise<ChannelCategory[]> {
  if (channels.length === 0) return [];

  const out: ChannelCategory[] = [];
  for (let i = 0; i < channels.length; i += 50) {
    const batch = channels.slice(i, i + 50);
    const userMsg = batch
      .map(
        (c) =>
          `- id: ${c.slack_channel_id} | name: #${c.name} | purpose: ${c.purpose_extracted ?? "(unknown)"}`,
      )
      .join("\n");

    const text = await llmCall({
      system: SYSTEM,
      userMessage: `Categorize:\n${userMsg}`,
      maxTokens: 2048,
      model: "classify",
    });
    try {
      const parsed = parseJsonBlock<ChannelCategory[]>(text);
      out.push(...parsed.filter((p) => p.slack_channel_id && p.category));
    } catch {
      // skip batch
    }
  }
  return out;
}
