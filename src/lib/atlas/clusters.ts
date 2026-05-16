// Atlas v2 — clustering layer.
//
// Replaces the alphabetical channel list with domain-grouped clusters so the
// user reads "where the knowledge lives in your company" instead of
// "what channels exist sorted by message count".
//
// Approach: heuristic clustering on channel name keywords (fast, no LLM
// call, deterministic). LLM-based reclassification can come later if the
// heuristics miss too many channels.

import type { Channel } from "@/lib/db";

export type ClusterId =
  | "product"
  | "engineering"
  | "support"
  | "billing"
  | "marketing"
  | "ops"
  | "hr"
  | "general"
  | "dead";

export type ClusterMeta = {
  id: ClusterId;
  label: string;
  emoji: string;
  rank: number; // display order
  hint: string;
};

export const CLUSTERS: Record<ClusterId, ClusterMeta> = {
  product: {
    id: "product",
    label: "Product",
    emoji: "📦",
    rank: 1,
    hint: "Where product decisions, feedback, and design live.",
  },
  engineering: {
    id: "engineering",
    label: "Engineering",
    emoji: "🔧",
    rank: 2,
    hint: "Where bugs are tracked, fixes are discussed, deploys happen.",
  },
  support: {
    id: "support",
    label: "Support",
    emoji: "💬",
    rank: 3,
    hint: "Where customer-facing conversations and tickets flow.",
  },
  billing: {
    id: "billing",
    label: "Billing",
    emoji: "💳",
    rank: 4,
    hint: "Subscriptions, refunds, invoicing, dunning.",
  },
  marketing: {
    id: "marketing",
    label: "Marketing",
    emoji: "📣",
    rank: 5,
    hint: "Campaigns, content, social, growth.",
  },
  ops: {
    id: "ops",
    label: "Ops & Infra",
    emoji: "⚙️",
    rank: 6,
    hint: "Deployments, incidents, infrastructure, monitoring.",
  },
  hr: {
    id: "hr",
    label: "People",
    emoji: "👥",
    rank: 7,
    hint: "Hiring, HR, internal team coordination.",
  },
  general: {
    id: "general",
    label: "General / Social",
    emoji: "💭",
    rank: 8,
    hint: "Random, announcements, off-topic.",
  },
  dead: {
    id: "dead",
    label: "Dormant",
    emoji: "🪦",
    rank: 9,
    hint: "Channels with no activity in the last 60 days — value may still be archived.",
  },
};

// Heuristic patterns. Order matters — first match wins. We bias TOWARD
// product/eng/support/billing buckets so the most-actionable clusters
// catch borderline channels.
const PATTERNS: Array<{ id: ClusterId; re: RegExp }> = [
  { id: "engineering", re: /\b(bug|tech|dev|eng|code|fix|release|deploy|hotfix|infra|backend|frontend|mobile-?dev)\b/i },
  { id: "billing", re: /\b(billing|paiement|payment|subscription|abonnement|invoice|facture|stripe|refund|remboursement|dunning)\b/i },
  { id: "support", re: /\b(support|customer|client|service|helpdesk|sav|cs|aide|ticket)\b/i },
  { id: "product", re: /\b(product|produit|feedback|design|ux|ui|spec|roadmap|feature)\b/i },
  { id: "ops", re: /\b(ops|sre|incident|outage|monitoring|alert|on-?call|deploy(s|ment)?)\b/i },
  { id: "marketing", re: /\b(market|growth|content|social|campaign|brand|comm(s|unication)?|seo|ads?)\b/i },
  { id: "hr", re: /\b(hr|rh|hiring|recrut|people|team|onboard|talent|culture)\b/i },
  { id: "general", re: /\b(general|général|random|aléatoire|fun|coffee|water-?cooler|annonce|news)\b/i },
];

const DORMANT_AFTER_DAYS = 60;

export function classifyChannel(c: Channel): ClusterId {
  if (c.archived) return "dead";

  // Check activity: dormant if no message in last 60 days OR truly empty
  if (c.last_message_at) {
    const ageDays = (Date.now() - new Date(c.last_message_at).getTime()) / 86_400_000;
    if (ageDays > DORMANT_AFTER_DAYS) return "dead";
  } else if (c.message_count_6mo === 0) {
    return "dead";
  }

  // Match against keyword patterns
  const name = c.name.toLowerCase();
  for (const { id, re } of PATTERNS) {
    if (re.test(name)) return id;
  }

  // Fallback to category field if extraction tagged it
  if (c.category) {
    const cat = c.category.toLowerCase();
    if (/eng|tech|dev/.test(cat)) return "engineering";
    if (/support|customer/.test(cat)) return "support";
    if (/product|feedback/.test(cat)) return "product";
    if (/billing|payment/.test(cat)) return "billing";
    if (/market|growth/.test(cat)) return "marketing";
  }

  return "general";
}

export type ClusterBucket = {
  meta: ClusterMeta;
  channels: Channel[];
  totalMessages: number;
  totalContributors: number;
  mostRecentActivityAt: string | null;
  /** Top 3 channels by message count for the drill-down preview */
  topChannels: Channel[];
};

export function bucketize(channels: Channel[]): ClusterBucket[] {
  const map = new Map<ClusterId, Channel[]>();
  for (const c of channels) {
    const id = classifyChannel(c);
    const existing = map.get(id) ?? [];
    existing.push(c);
    map.set(id, existing);
  }

  const buckets: ClusterBucket[] = [];
  for (const [id, ch] of map.entries()) {
    const meta = CLUSTERS[id];
    const sorted = [...ch].sort((a, b) => b.message_count_6mo - a.message_count_6mo);
    const lastActivity = sorted
      .map((c) => c.last_message_at)
      .filter((d): d is string => !!d)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;
    buckets.push({
      meta,
      channels: sorted,
      totalMessages: ch.reduce((sum, c) => sum + (c.message_count_6mo ?? 0), 0),
      totalContributors: ch.reduce((sum, c) => sum + (c.unique_contributors ?? 0), 0),
      mostRecentActivityAt: lastActivity,
      topChannels: sorted.slice(0, 3),
    });
  }

  return buckets.sort((a, b) => a.meta.rank - b.meta.rank);
}

export type ClusterStats = {
  /** Total skills extracted across channels of this cluster. */
  skills_count: number;
  /** Distinct people who contributed knowledge in this cluster. */
  people_count: number;
};

/**
 * Health signal for the cluster — "active" if recent activity in the last
 * 7 days, "slowing" if 7-30 days, "dormant" beyond. Used for the dot color.
 */
export function clusterHealth(bucket: ClusterBucket): "active" | "slowing" | "dormant" {
  if (!bucket.mostRecentActivityAt) return "dormant";
  const ageDays =
    (Date.now() - new Date(bucket.mostRecentActivityAt).getTime()) / 86_400_000;
  if (ageDays <= 7) return "active";
  if (ageDays <= 30) return "slowing";
  return "dormant";
}
