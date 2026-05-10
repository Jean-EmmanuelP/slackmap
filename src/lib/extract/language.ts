// Language directive injected into every extractor's system prompt so the
// brain produces user-facing strings (titles, summaries, descriptions) in the
// workspace's chosen language. Returns an empty string for English (default
// LLM behaviour) so we don't bloat prompts when no override is needed.

const LANG_NAMES: Record<string, string> = {
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ja: "Japanese",
  zh: "Chinese (simplified)",
  ko: "Korean",
};

export function buildLanguageDirective(outputLanguage: string | null | undefined): string {
  const code = (outputLanguage ?? "en").toLowerCase();
  if (code === "en" || !code) return "";
  const name = LANG_NAMES[code] ?? code;
  return (
    `\n\nLANGUAGE: All user-facing strings you output (titles, descriptions, ` +
    `summaries, reasons, definitions) MUST be written in ${name}. ` +
    `Keep proper nouns, code identifiers, slugs, and tool names in their original form. ` +
    `JSON keys themselves stay in English; only the values change language.`
  );
}
