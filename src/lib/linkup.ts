// Linkup SDK wrapper. Centralises the rule that every search runs at
// depth='deep' with includeSources=true. Never instantiate LinkupClient
// directly elsewhere — go through these helpers so the depth invariant
// can never be silently downgraded.

import { LinkupClient, type StructuredSource } from 'linkup-sdk';
import { getWorkspaceLinkupKey } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export type LinkupSource = StructuredSource;

export async function loadWorkspaceLinkupKey(workspaceId: string): Promise<string | undefined> {
  try {
    const enc = await getWorkspaceLinkupKey(workspaceId);
    if (!enc) return undefined;
    return decrypt(enc);
  } catch {
    return undefined;
  }
}

export function linkupClient(decryptedKey: string | undefined): LinkupClient {
  const apiKey = decryptedKey ?? process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error('No Linkup API key — set LINKUP_API_KEY or save a per-workspace key');
  }
  return new LinkupClient({ apiKey });
}

export async function linkupStructured<T = Record<string, unknown>>(
  client: LinkupClient,
  query: string,
  schema: Record<string, unknown>,
): Promise<{ data: T; sources: LinkupSource[] }> {
  const res = await client.search({
    query,
    depth: 'deep',
    outputType: 'structured',
    structuredOutputSchema: schema,
    includeSources: true,
  });
  return res as { data: T; sources: LinkupSource[] };
}

export async function linkupSourcedAnswer(client: LinkupClient, query: string) {
  return client.search({
    query,
    depth: 'deep',
    outputType: 'sourcedAnswer',
    includeInlineCitations: true,
  });
}

// Fast-depth sourced answer. Linkup's `fast` mode is a single-pass keyword
// search with no LLM interpretation — much faster than `deep` (~3s vs ~25s)
// but it only supports `outputType: 'sourcedAnswer'` and the SDK type defs
// don't expose it yet (still beta). We pass the string through with a cast.
//
// Use only for narrow factual queries (e.g. "B2B or B2C?"). For richer
// company-discovery queries, prefer the deep wrapper.
export async function linkupFastAnswer(client: LinkupClient, query: string) {
  return client.search({
    query,
    depth: 'fast' as 'deep', // beta, not in SDK types yet
    outputType: 'sourcedAnswer',
    includeInlineCitations: false,
  });
}

export async function pingLinkup(apiKey: string): Promise<{ ok: true }> {
  const client = new LinkupClient({ apiKey });
  await client.search({
    query: 'ping',
    depth: 'standard',
    outputType: 'sourcedAnswer',
  });
  return { ok: true };
}
