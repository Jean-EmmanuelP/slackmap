// Derived description extraction — reuses sources already fetched by the
// website step (which crawled the company's web presence to pick the right
// homepage) instead of running another 25-second Linkup deep search.
// Anthropic-only, ~3s.
//
// Falls back to a thrown error if parsing fails; caller should fall back
// to a fresh Linkup search.

import { llmCall, parseJsonBlock } from "@/lib/extract/anthropic";
import type { LinkupSource } from "@/lib/linkup";

export type DerivedDescription = {
  oneLiner: string;
  industry: string;
};

export async function deriveDescriptionFromSources(
  companyName: string,
  companyWebsite: string,
  sources: LinkupSource[],
  apiKey?: string,
): Promise<DerivedDescription> {
  const contextBlob = sources
    .slice(0, 5)
    .map((s) => {
      const content = (s.content ?? "").slice(0, 2000);
      return `### ${s.name || s.url}\n${s.url}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  const system =
    "You read excerpts about a company and write a one-sentence description plus identify its primary industry. " +
    "Output ONLY valid JSON, no prose, no code fences.";

  const userMessage =
    `Company: ${companyName}\nWebsite: ${companyWebsite}\n\n` +
    `Sources we already gathered:\n\n${contextBlob}\n\n` +
    `Tasks:\n` +
    `1. Write a one-sentence description of what ${companyName} does (in present tense, concrete, no buzzwords).\n` +
    `2. Identify the primary industry in 2–5 words (e.g. "Fitness app", "B2B SaaS payroll", "E-commerce fashion").\n\n` +
    `Output JSON only: {"oneLiner":"...","industry":"..."}`;

  const text = await llmCall({
    system,
    userMessage,
    maxTokens: 500,
    model: "extract",
    apiKey,
  });

  const parsed = parseJsonBlock<{ oneLiner?: string; industry?: string }>(text);
  if (!parsed.oneLiner || !parsed.industry) {
    throw new Error("derived-description: missing oneLiner or industry");
  }
  return {
    oneLiner: parsed.oneLiner.toString(),
    industry: parsed.industry.toString(),
  };
}
