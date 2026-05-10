// Single source of truth for the <company_context> block injected into
// every extractor's system prompt. Returns empty string when the workspace
// hasn't run the Linkup wizard yet, so existing behaviour is preserved.

export type CompanyContextWorkspace = {
  company_name?: string | null;
  company_website?: string | null;
  company_description?: string | null;
  company_industry?: string | null;
  company_audience?: string | null;
  company_tools?: string[] | null;
  company_scope?: "worldwide" | "national" | null;
  company_country?: string | null;
  company_resolved_at?: string | null;
  output_language?: string | null;
};

export function buildCompanyContextBlock(ws: CompanyContextWorkspace | null | undefined): string {
  if (!ws?.company_resolved_at) return '';
  const lines: string[] = [];
  if (ws.company_name) lines.push(`Name: ${ws.company_name}`);
  if (ws.company_website) lines.push(`Website: ${ws.company_website}`);
  if (ws.company_description) lines.push(`What they do: ${ws.company_description}`);
  if (ws.company_industry) lines.push(`Industry: ${ws.company_industry}`);
  if (ws.company_audience) lines.push(`Audience: ${ws.company_audience}`);
  if (ws.company_scope === "national" && ws.company_country) {
    lines.push(`Operates in: ${ws.company_country} (national scope)`);
  } else if (ws.company_scope === "worldwide") {
    lines.push(`Operates in: worldwide`);
  }
  if (ws.company_tools && ws.company_tools.length > 0) {
    lines.push(`Known tools: ${ws.company_tools.join(', ')}`);
  }
  if (lines.length === 0) return '';
  return `<company_context>\n${lines.join('\n')}\n</company_context>\n\n`;
}
