// Bilingual display layer. The canonical row fields are always English; this
// module reads the workspace's chosen `display_language` (or a request-time
// override) and substitutes translated strings if present in the row's
// `translations` JSONB. Falls back to the English field if no translation
// exists for that field/language.

export const SUPPORTED_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
];

export type TranslationsBlob = Record<string, Record<string, string | null | undefined>>;

/**
 * Returns the display value of `row[field]` in `lang`, falling back to the
 * canonical English field when no translation is cached.
 *
 *   getDisplay(skill, 'title', 'fr')
 *     → skill.translations.fr.title || skill.title
 */
export function getDisplay<T extends Record<string, unknown>>(
  row: T & { translations?: TranslationsBlob | null },
  field: keyof T & string,
  lang: string | null | undefined,
): string | null | undefined {
  const code = (lang ?? "en").toLowerCase();
  if (code === "en") return row[field] as string | null | undefined;
  const translated = row.translations?.[code]?.[field];
  if (typeof translated === "string" && translated.trim().length > 0) {
    return translated;
  }
  return row[field] as string | null | undefined;
}

/** Returns true when this row has at least one translated field for `lang`. */
export function hasTranslation(
  row: { translations?: TranslationsBlob | null },
  lang: string,
): boolean {
  const block = row.translations?.[lang.toLowerCase()];
  if (!block) return false;
  return Object.values(block).some(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
}

export function languageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase())?.label ?? code;
}
