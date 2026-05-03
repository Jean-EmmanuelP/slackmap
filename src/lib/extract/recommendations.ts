import { llmCall, parseJsonBlock } from "./anthropic";
import type { Channel, Person } from "../db";

export type RecommendationType =
  | "rename_channel"
  | "split_channel"
  | "merge_channels"
  | "archive_channel"
  | "create_channel"
  | "add_person_to_channel"
  | "people_pairing"
  | "process_gap";

export type ExtractedRec = {
  type: RecommendationType;
  title: string;
  rationale: string;
  suggested_action: string;
  target_channels: string[]; // slack_channel_ids
  target_people: string[]; // slack_user_ids
};

const SYSTEM = `You are a senior org-design consultant analyzing a Slack workspace
to recommend reorganizations. Be FACTUAL — every recommendation must be grounded
in observable evidence from the channel purposes / people roles given.

Generate up to 8 recommendations across these types:
- "rename_channel": channel name doesn't match its observed purpose
- "split_channel": channel handles too many distinct topics — split it
- "merge_channels": two+ channels overlap heavily — merge them
- "archive_channel": channel is dormant or redundant
- "create_channel": frequent topic discussed across many channels but no dedicated home
- "add_person_to_channel": person's expertise matches a channel they're not in
- "process_gap": observed pattern that should become a documented process

Output ONLY a JSON array of recs:
[
  {
    "type": "split_channel",
    "title": "Split #foo into #foo-X and #foo-Y",
    "rationale": "Concrete explanation citing observed activity (1-3 sentences)",
    "suggested_action": "Create #foo-X for X, #foo-Y for Y, archive #foo when migrated",
    "target_channels": ["C123"],
    "target_people": []
  }
]

Hard rules:
- Don't fabricate. If you can't justify with the data given, skip the rec.
- Prioritize HIGH-IMPACT recommendations (clarity for newcomers, reduces context-switching).
- Don't recommend trivial renames. Only if name actively misleads.
- Use Slack channel IDs (Cxxxxx) and user IDs (Uxxxxx), not display names.`;

export async function extractRecommendations(
  channels: Channel[],
  people: Person[],
): Promise<ExtractedRec[]> {
  if (channels.length === 0) return [];

  const channelsBlock = channels
    .filter((c) => !c.archived)
    .slice(0, 60)
    .map(
      (c) =>
        `- id=${c.slack_channel_id} | name=#${c.name}${c.is_private ? " 🔒" : ""}` +
        ` | category=${c.category ?? "?"}` +
        ` | msgs=${c.message_count_6mo}` +
        ` | purpose: ${c.purpose_extracted ?? c.purpose_native ?? "(unknown)"}`,
    )
    .join("\n");

  const peopleBlock = people
    .filter((p) => p.role_extracted)
    .slice(0, 30)
    .map(
      (p) =>
        `- id=${p.slack_user_id} | ${p.display_name ?? p.real_name ?? "?"}` +
        ` | role=${p.role_extracted}` +
        ` | tools=[${p.tools.slice(0, 5).join(", ")}]` +
        ` | expertise=[${p.expertise.slice(0, 4).join(", ")}]`,
    )
    .join("\n");

  const userMsg = `Channels (${channels.length} total):\n${channelsBlock}\n\nPeople (${people.length} total):\n${peopleBlock}\n\nGenerate up to 8 reorganization recommendations.`;

  const text = await llmCall({
    system: SYSTEM,
    userMessage: userMsg,
    maxTokens: 4096,
    model: "extract",
  });

  try {
    const parsed = parseJsonBlock<ExtractedRec[]>(text);
    return parsed.filter((r) => r.type && r.title && r.rationale).slice(0, 12);
  } catch {
    return [];
  }
}
