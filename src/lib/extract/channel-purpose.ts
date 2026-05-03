import { llmCall } from "./llm";

type Msg = { user?: string; text?: string };

const SYSTEM = `You analyze a sample of Slack messages from a single channel and write ONE
sentence (max 25 words, no quotes) describing what the channel is actually used for in practice.
- Focus on observed behavior, not the channel name.
- Be specific. "discussions about engineering" is bad. "Daily standups, blockers, and PR reviews
  for the backend team" is good.
- If too sparse to tell, say "Not enough activity to characterize".
- Output the sentence and nothing else. No prefix, no markdown.`;

export async function extractChannelPurpose(channelName: string, messages: Msg[]): Promise<string> {
  const sample = messages
    .filter((m) => m.text && m.text.length > 0)
    .slice(0, 100)
    .map((m) => `- ${m.text!.replace(/\s+/g, " ").slice(0, 280)}`)
    .join("\n");

  if (sample.length < 50) return "Not enough activity to characterize";

  return (
    await llmCall({
      system: SYSTEM,
      userMessage: `Channel name: #${channelName}\n\nRecent messages:\n${sample}`,
      maxTokens: 120,
      model: "extract",
    })
  ).trim();
}
