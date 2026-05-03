import { llmCall, parseJsonBlock } from "./anthropic";

type Msg = { ts: string; user?: string; text?: string };

// Common English/internet noise to filter out before sending to LLM.
const STOPWORDS = new Set([
  "OMG", "LOL", "LMAO", "BRB", "TBH", "IMO", "IMHO", "FYI", "BTW",
  "ASAP", "AKA", "AKAS", "AFAIK", "TLDR", "TL", "DR", "ETA",
  "USA", "UK", "EU", "PM", "AM", "CEO", "CTO", "CFO", "VP", "HR",
  "I", "A", "THE", "AND", "OR", "BUT", "FOR", "TO", "OF", "IN", "ON",
  "OK", "OKAY", "YES", "NO", "PR", "QA", "UI", "UX", "API", "SDK",
  "URL", "HTTP", "HTTPS", "JSON", "XML", "CSV", "PDF", "PNG", "JPG",
  "YEAH", "GUYS", "OK", "WTF", "WIP",
]);

const ACRONYM_RE = /\b[A-Z][A-Z0-9]{1,6}\b/g;

export type Candidate = {
  term: string;
  contexts: Array<{ ts: string; text: string }>;
  count: number;
};

export function extractAcronymCandidates(messages: Msg[]): Candidate[] {
  const map = new Map<string, Candidate>();
  for (const m of messages) {
    if (!m.text) continue;
    const found = m.text.match(ACRONYM_RE);
    if (!found) continue;
    for (const term of found) {
      if (STOPWORDS.has(term)) continue;
      if (term.length < 2 || term.length > 8) continue;
      const existing = map.get(term);
      if (existing) {
        existing.count += 1;
        if (existing.contexts.length < 5) {
          existing.contexts.push({ ts: m.ts, text: m.text.slice(0, 280) });
        }
      } else {
        map.set(term, {
          term,
          count: 1,
          contexts: [{ ts: m.ts, text: m.text.slice(0, 280) }],
        });
      }
    }
  }
  // Drop hapax legomena — single occurrences are usually noise.
  return Array.from(map.values()).filter((c) => c.count >= 2);
}

const DEFINE_SYSTEM = `You define internal company jargon found in Slack messages.

For each term, decide:
1. Is it actually internal jargon (a product name, internal acronym, tool, concept) — vs.
   common English / general tech / noise? If it's not internal-specific or you can't tell
   from context, set "skip": true.
2. If it IS internal jargon, write a 1-sentence definition (max 20 words) inferred from context.
3. Categorize: "product" | "acronym" | "jargon" | "tool" | "team".

Output ONLY a JSON array, one object per input term, in the same order:
[{"term":"...","skip":false,"definition":"...","category":"acronym"},...]
If skip:true, omit definition and category.`;

export type DefinedEntry = {
  term: string;
  definition: string;
  category: string;
  first_seen_channel_id: string;
  first_seen_ts: string;
  occurrences: number;
};

export async function llmDefineTerms(
  candidates: Candidate[],
  channelId: string,
): Promise<DefinedEntry[]> {
  if (candidates.length === 0) return [];

  // Cap at 30 per call to keep response size reasonable.
  const batches: Candidate[][] = [];
  for (let i = 0; i < candidates.length; i += 30) {
    batches.push(candidates.slice(i, i + 30));
  }

  const out: DefinedEntry[] = [];
  for (const batch of batches) {
    const userMsg = batch
      .map(
        (c, i) =>
          `${i + 1}. Term: "${c.term}" (seen ${c.count}x)\n` +
          `   Contexts:\n` +
          c.contexts.map((ctx) => `   - ${ctx.text}`).join("\n"),
      )
      .join("\n\n");

    const text = await llmCall({
      system: DEFINE_SYSTEM,
      userMessage: `Define these ${batch.length} terms:\n\n${userMsg}`,
      maxTokens: 2048,
      model: "extract",
    });

    let parsed: Array<{ term: string; skip?: boolean; definition?: string; category?: string }>;
    try {
      parsed = parseJsonBlock(text);
    } catch {
      continue;
    }

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const c = batch[i];
      if (!p || p.skip || !p.definition || !c) continue;
      out.push({
        term: c.term,
        definition: p.definition,
        category: p.category || "jargon",
        first_seen_channel_id: channelId,
        first_seen_ts: c.contexts[0]?.ts ?? "",
        occurrences: c.count,
      });
    }
  }
  return out;
}
