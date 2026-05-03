// Compat layer: keep the existing parseJsonBlock helper that extractors import.
// LLM calls now go through ./llm.ts (router between API and Claude Code CLI).

export { llmCall } from "./llm";

export function parseJsonBlock<T = unknown>(text: string): T {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const firstBrace = s.search(/[{[]/);
  if (firstBrace > 0) s = s.slice(firstBrace);
  return JSON.parse(s) as T;
}
