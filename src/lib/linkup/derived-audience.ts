// Derived audience extraction — reuses sources already fetched by the
// description step (which crawled the homepage) instead of running another
// 20-second Linkup deep search. Anthropic-only, ~3s.
//
// Falls back to a thrown error if parsing fails; caller should fall back
// to a fresh Linkup search.

import { llmCall, parseJsonBlock } from "@/lib/extract/anthropic";
import type { LinkupSource } from "@/lib/linkup";

export type DerivedAudience = {
  audience: "b2b" | "b2c" | "both";
  evidence: string;
};

export async function deriveAudienceFromSources(
  companyName: string,
  companyWebsite: string,
  sources: LinkupSource[],
  apiKey?: string,
): Promise<DerivedAudience> {
  const contextBlob = sources
    .slice(0, 5)
    .map((s) => {
      const content = (s.content ?? "").slice(0, 2000);
      return `### ${s.name || s.url}\n${s.url}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  const system =
    "You read excerpts from a company's web presence and determine its primary audience. " +
    "Output ONLY valid JSON, no prose, no code fences.";

  const userMessage =
    `Company: ${companyName}\nWebsite: ${companyWebsite}\n\n` +
    `We've already fetched these sources for this company:\n\n${contextBlob}\n\n` +
    `Question: does this company primarily serve B2B (businesses), B2C (consumers), or both?\n` +
    `Cite a short verbatim quote from the sources above as evidence (one sentence).\n\n` +
    `Output JSON only: {"audience":"b2b"|"b2c"|"both","evidence":"<quote>"}`;

  const text = await llmCall({
    system,
    userMessage,
    maxTokens: 400,
    model: "extract",
    apiKey,
  });

  const parsed = parseJsonBlock<{ audience?: string; evidence?: string }>(text);
  const audience =
    parsed.audience === "b2b" || parsed.audience === "b2c" || parsed.audience === "both"
      ? parsed.audience
      : null;
  if (!audience) {
    throw new Error(`derived-audience: invalid audience value "${parsed.audience}"`);
  }
  return {
    audience,
    evidence: parsed.evidence?.toString() ?? "",
  };
}
