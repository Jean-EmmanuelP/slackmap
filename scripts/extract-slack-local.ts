// Local Slack extraction → sync to PROD Supabase via REST.
// Uses the local `claude` CLI for LLM calls (OAuth, no API key, free).
// Reads the encrypted Slack bot/user token from prod DB and decrypts locally
// so we can hit the Slack API with the same identity the prod app would.
//
// Usage:
//   pnpm tsx scripts/extract-slack-local.ts
//
// Env (.env.prod.local):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   ENCRYPTION_KEY        (same as prod Vercel — required to decrypt tokens)
//   WORKSPACE_ID          target workspace UUID

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

import { WebClient } from "@slack/web-api";
import { createDecipheriv, createHash } from "node:crypto";
import { fetchMessagesSince, sixMonthsAgoTs } from "../src/lib/slack";
import { extractChannelPurpose } from "../src/lib/extract/channel-purpose";
import { extractAcronymCandidates, llmDefineTerms } from "../src/lib/extract/glossary";
import { extractSkillsFromChannel, extractSkillsForPerson } from "../src/lib/extract/skills";
import { extractPerson } from "../src/lib/extract/people";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const SUPABASE_URL = req("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = req("SUPABASE_SERVICE_KEY");
const ENCRYPTION_KEY = req("ENCRYPTION_KEY");
const WORKSPACE_ID = req("WORKSPACE_ID");

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function decryptLocal(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const key = createHash("sha256").update(ENCRYPTION_KEY).digest();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

async function rest(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path.replace(/^\//, "")}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "content-type": "application/json",
  };
  if (method !== "GET") headers["Prefer"] = "return=representation";
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function selectOne<T>(table: string, query: Record<string, string>): Promise<T | null> {
  const res = await rest("GET", table, undefined, query);
  if (!res.ok) {
    console.error(`  ! select ${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

async function selectMany<T>(table: string, query: Record<string, string>): Promise<T[]> {
  const res = await rest("GET", table, undefined, query);
  if (!res.ok) {
    console.error(`  ! select ${table}: ${res.status}`);
    return [];
  }
  return (await res.json()) as T[];
}

async function update(table: string, query: Record<string, string>, body: unknown): Promise<void> {
  const res = await rest("PATCH", table, body, query);
  if (!res.ok) console.error(`  ! update ${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function insert(table: string, body: unknown): Promise<boolean> {
  const res = await rest("POST", table, body);
  if (!res.ok) {
    console.error(`  ! insert ${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return false;
  }
  return true;
}

type Workspace = {
  id: string;
  slack_team_name: string;
  slack_team_domain: string | null;
  slack_team_icon_url: string | null;
  encrypted_bot_token: string;
  encrypted_user_token: string | null;
};

type Channel = {
  id: string;
  workspace_id: string;
  slack_channel_id: string;
  name: string;
  is_private: boolean;
  archived: boolean;
  message_count_6mo?: number | null;
};

type SkillIn = {
  type: "process" | "policy" | "decision" | "escalation";
  domain?: string | null;
  slug: string;
  title: string;
  trigger: string;
  steps_md: string;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet?: string; url?: string }>;
};

async function upsertSkill(s: SkillIn) {
  const now = new Date().toISOString();
  const existing = await selectOne<{ id: string; source_count: number; citations: SkillIn["citations"] }>(
    "skills",
    {
      select: "id,source_count,citations",
      workspace_id: `eq.${WORKSPACE_ID}`,
      slug: `eq.${s.slug}`,
    },
  );
  if (existing) {
    const seenTs = new Set((existing.citations ?? []).map((c) => c.ts));
    const merged = [...(existing.citations ?? [])];
    for (const c of s.citations) if (!seenTs.has(c.ts)) merged.push(c), seenTs.add(c.ts);
    const newCount = (existing.source_count ?? 0) + 1;
    const confidence = Math.min(0.99, 0.4 + 0.1 * Math.log2(newCount + 1));
    await update(
      "skills",
      { id: `eq.${existing.id}` },
      {
        title: s.title,
        domain: s.domain ?? null,
        trigger: s.trigger,
        steps_md: s.steps_md,
        decision_criteria: s.decision_criteria,
        escalation: s.escalation,
        citations: merged,
        source: "slack",
        source_count: newCount,
        confidence,
        last_observed_at: now,
        updated_at: now,
      },
    );
  } else {
    const ok = await insert("skills", {
      workspace_id: WORKSPACE_ID,
      type: s.type,
      domain: s.domain ?? null,
      slug: s.slug,
      title: s.title,
      trigger: s.trigger,
      steps_md: s.steps_md,
      decision_criteria: s.decision_criteria,
      escalation: s.escalation,
      citations: s.citations,
      source: "slack",
      source_count: 1,
      confidence: 0.5,
      first_observed_at: now,
      last_observed_at: now,
      status: "draft",
    });
    if (ok) console.log(`  + skill: ${s.slug}`);
  }
}

async function upsertGlossary(
  entries: Array<{ term: string; definition: string; category: string | null; first_seen_channel_id?: string; first_seen_ts?: string }>,
) {
  for (const e of entries) {
    const existing = await selectOne<{ id: string; occurrences: number }>("glossary_entries", {
      select: "id,occurrences",
      workspace_id: `eq.${WORKSPACE_ID}`,
      term: `eq.${e.term}`,
    });
    if (existing) {
      await update(
        "glossary_entries",
        { id: `eq.${existing.id}` },
        {
          definition: e.definition,
          category: e.category,
          occurrences: existing.occurrences + 1,
          last_seen_at: new Date().toISOString(),
        },
      );
    } else {
      const ok = await insert("glossary_entries", {
        workspace_id: WORKSPACE_ID,
        term: e.term,
        definition: e.definition,
        category: e.category,
        first_seen_channel_id: e.first_seen_channel_id ?? null,
        first_seen_ts: e.first_seen_ts ?? null,
        occurrences: 1,
        source: "slack",
      });
      if (ok) console.log(`  + term: ${e.term}`);
    }
  }
}

// Levenshtein distance, capped early once we exceed the threshold.
function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function firstThreeWords(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function dedupSkills(skills: SkillIn[]): SkillIn[] {
  // Group by similarity. Each group keeps the "best" skill and unions citations.
  type Group = { keep: SkillIn; members: SkillIn[] };
  const groups: Group[] = [];

  function similar(a: SkillIn, b: SkillIn): boolean {
    if (a.slug === b.slug) return true;
    if (levenshtein(a.slug, b.slug, 3) <= 3) return true;
    const aw = firstThreeWords(a.title);
    const bw = firstThreeWords(b.title);
    if (aw && aw === bw) return true;
    return false;
  }

  // A skill is "better" if it has more citations (proxy for evidence). Tie:
  // prefer the longer steps_md (more detail).
  function score(s: SkillIn): number {
    return s.citations.length * 100 + (s.steps_md?.length ?? 0);
  }

  for (const s of skills) {
    const group = groups.find((g) => similar(g.keep, s) || g.members.some((m) => similar(m, s)));
    if (!group) {
      groups.push({ keep: s, members: [s] });
      continue;
    }
    group.members.push(s);
    if (score(s) > score(group.keep)) group.keep = s;
  }

  // Merge citations across each group.
  return groups.map((g) => {
    const seen = new Set<string>();
    const merged: SkillIn["citations"] = [];
    for (const m of g.members) {
      for (const c of m.citations) {
        const key = `${c.channel_id}:${c.ts}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(c);
      }
    }
    return { ...g.keep, citations: merged };
  });
}

async function main() {
  process.env.LLM_BACKEND = "cli";
  delete process.env.ANTHROPIC_API_KEY;

  console.log("[setup] fetching workspace + channels…");
  const ws = await selectOne<Workspace>("workspaces", {
    select:
      "id,slack_team_name,slack_team_domain,slack_team_icon_url,encrypted_bot_token,encrypted_user_token",
    id: `eq.${WORKSPACE_ID}`,
  });
  if (!ws) throw new Error("workspace not found");

  // Prefer user token (silent — no joins, sees private channels the user is in).
  const token = ws.encrypted_user_token
    ? decryptLocal(ws.encrypted_user_token)
    : decryptLocal(ws.encrypted_bot_token);
  const isUserToken = !!ws.encrypted_user_token;
  const slack = new WebClient(token);
  console.log(`[setup] using ${isUserToken ? "user" : "bot"} token for ${ws.slack_team_name}`);

  // Backfill the team icon if missing.
  if (!ws.slack_team_icon_url) {
    try {
      const info = await slack.team.info();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const team = info.team as any;
      const iconUrl = team?.icon && !team.icon.image_default ? team.icon.image_132 ?? team.icon.image_88 : null;
      const domain = team?.domain ?? null;
      if (iconUrl || domain) {
        await update(
          "workspaces",
          { id: `eq.${WORKSPACE_ID}` },
          { slack_team_icon_url: iconUrl, slack_team_domain: domain, updated_at: new Date().toISOString() },
        );
        console.log(`[setup] icon=${!!iconUrl} domain=${domain}`);
      }
    } catch (e) {
      console.warn(`[setup] team.info failed: ${(e as Error).message}`);
    }
  }

  // Pick top public channels by activity to mine. Default cap = 30, override
  // via SLACK_CHANNEL_CAP env (e.g. SLACK_CHANNEL_CAP=2 for fast smoke tests).
  const DEFAULT_CHANNEL_CAP = 30;
  const envCap = parseInt(process.env.SLACK_CHANNEL_CAP ?? "", 10);
  const CHANNEL_CAP = Number.isFinite(envCap) && envCap > 0 ? envCap : DEFAULT_CHANNEL_CAP;
  const channels = await selectMany<Channel>("channels", {
    select: "id,workspace_id,slack_channel_id,name,is_private,archived,message_count_6mo",
    workspace_id: `eq.${WORKSPACE_ID}`,
    archived: "eq.false",
    is_private: "eq.false",
    order: "message_count_6mo.desc.nullslast",
    limit: "60",
  });
  console.log(`[setup] ${channels.length} candidate channels (cap=${CHANNEL_CAP})`);

  const oldest = sixMonthsAgoTs();
  type ActivityKey = string;
  const personActivity = new Map<
    ActivityKey,
    { user: string; channel: string; count: number; lastTs: string }
  >();
  const userProfiles = new Map<
    string,
    {
      slack_user_id: string;
      display_name: string | null;
      real_name: string | null;
      title: string | null;
      email: string | null;
      avatar_url: string | null;
      is_bot: boolean;
      deleted: boolean;
      sample_messages: string[];
      channels: Map<string, { count: number; name: string; purpose: string | null }>;
      total: number;
    }
  >();

  // Track top messages per channel for skill + glossary extraction.
  let totalSkills = 0;
  let totalTerms = 0;

  // Collect all channel-extracted skills in memory so we can run a final dedup
  // pass before upserting (collapses near-duplicate slugs across channels).
  const collectedSkills: SkillIn[] = [];

  const channelLimit = Math.min(channels.length, CHANNEL_CAP);
  for (let i = 0; i < channelLimit; i++) {
    const ch = channels[i];
    console.log(`\n[ch ${i + 1}/${channelLimit}] #${ch.name}`);
    let messages: Array<{ ts: string; user?: string; text?: string }>;
    try {
      messages = await fetchMessagesSince(slack, ch.slack_channel_id, oldest, 10);
    } catch (e) {
      console.warn(`  ! fetch: ${(e as Error).message}`);
      await update(
        "channels",
        { id: `eq.${ch.id}` },
        { mining_status: "failed", mining_error: (e as Error).message.slice(0, 200) },
      );
      continue;
    }
    console.log(`  ${messages.length} messages`);

    if (messages.length < 5) {
      await update(
        "channels",
        { id: `eq.${ch.id}` },
        {
          mining_status: "done",
          mining_enabled: true,
          mining_last_run_at: new Date().toISOString(),
          message_count_6mo: messages.length,
        },
      );
      continue;
    }

    // 1) Channel purpose
    let purpose: string | null = null;
    try {
      purpose = await extractChannelPurpose(ch.name, messages);
    } catch (e) {
      console.warn(`  ! purpose: ${(e as Error).message}`);
    }

    // 2) Glossary
    const candidates = extractAcronymCandidates(messages);
    if (candidates.length > 0) {
      try {
        const defined = await llmDefineTerms(candidates, ch.slack_channel_id);
        if (defined.length > 0) {
          await upsertGlossary(
            defined.map((d) => ({
              term: d.term,
              definition: d.definition,
              category: d.category ?? null,
              first_seen_channel_id: d.first_seen_channel_id ?? ch.slack_channel_id,
              first_seen_ts: d.first_seen_ts ?? messages[messages.length - 1]?.ts,
            })),
          );
          totalTerms += defined.length;
        }
      } catch (e) {
        console.warn(`  ! glossary: ${(e as Error).message}`);
      }
    }

    // 3) Skills (procedural) — collect now, dedup + upsert at the end.
    try {
      const skills = await extractSkillsFromChannel(ch.slack_channel_id, ch.name, messages);
      for (const s of skills) {
        collectedSkills.push({ ...s, domain: s.domain ?? null });
      }
      totalSkills += skills.length;
      console.log(`  ${skills.length} skills`);
    } catch (e) {
      console.warn(`  ! skills: ${(e as Error).message}`);
    }

    // 4) Compute per-user activity for this channel (for /people later).
    const seenUsers = new Set<string>();
    for (const m of messages) {
      if (!m.user) continue;
      seenUsers.add(m.user);
      const k: ActivityKey = `${m.user}:${ch.slack_channel_id}`;
      const cur = personActivity.get(k) ?? { user: m.user, channel: ch.slack_channel_id, count: 0, lastTs: "0" };
      cur.count++;
      if (m.ts > cur.lastTs) cur.lastTs = m.ts;
      personActivity.set(k, cur);
    }
    const lastTs = messages[0]?.ts;
    const lastIso = lastTs ? new Date(parseFloat(lastTs) * 1000).toISOString() : null;

    await update(
      "channels",
      { id: `eq.${ch.id}` },
      {
        purpose_extracted: purpose,
        message_count_6mo: messages.length,
        unique_contributors: seenUsers.size,
        last_message_at: lastIso,
        mining_enabled: true,
        mining_status: "done",
        mining_last_run_at: new Date().toISOString(),
        mining_error: null,
        updated_at: new Date().toISOString(),
      },
    );

    // 5) Cache user samples for /people extraction below.
    for (const m of messages) {
      if (!m.user || !m.text) continue;
      const u = userProfiles.get(m.user) ?? {
        slack_user_id: m.user,
        display_name: null,
        real_name: null,
        title: null,
        email: null,
        avatar_url: null,
        is_bot: false,
        deleted: false,
        sample_messages: [] as string[],
        channels: new Map<string, { count: number; name: string; purpose: string | null }>(),
        total: 0,
      };
      u.total++;
      if (u.sample_messages.length < 30) u.sample_messages.push(m.text);
      const cAgg = u.channels.get(ch.slack_channel_id) ?? { count: 0, name: ch.name, purpose: purpose };
      cAgg.count++;
      cAgg.purpose = purpose;
      u.channels.set(ch.slack_channel_id, cAgg);
      userProfiles.set(m.user, u);
    }
  }

  // Dedup channel-extracted skills before upserting. Two skills are merged if
  // (a) Levenshtein(slug,slug) < 4, OR (b) they share their first 3 title words.
  // The highest-confidence (proxied by source_count, then citation count) wins;
  // citations from the merged skills are unioned in.
  console.log(`\n[skills] dedup pass on ${collectedSkills.length} candidates…`);
  const dedupedSkills = dedupSkills(collectedSkills);
  console.log(
    `[skills] ${collectedSkills.length} → ${dedupedSkills.length} after dedup (${
      collectedSkills.length - dedupedSkills.length
    } merged)`,
  );
  for (const s of dedupedSkills) {
    await upsertSkill(s);
  }

  // Persist people_activity rollups
  console.log("\n[activity] persisting people_activity…");
  for (const v of personActivity.values()) {
    const existing = await selectOne<{ message_count: number }>("people_activity", {
      select: "message_count",
      workspace_id: `eq.${WORKSPACE_ID}`,
      slack_user_id: `eq.${v.user}`,
      slack_channel_id: `eq.${v.channel}`,
    });
    if (existing) {
      await update(
        "people_activity",
        {
          workspace_id: `eq.${WORKSPACE_ID}`,
          slack_user_id: `eq.${v.user}`,
          slack_channel_id: `eq.${v.channel}`,
        },
        { message_count: v.count, last_message_ts: v.lastTs, updated_at: new Date().toISOString() },
      );
    } else {
      await insert("people_activity", {
        workspace_id: WORKSPACE_ID,
        slack_user_id: v.user,
        slack_channel_id: v.channel,
        message_count: v.count,
        last_message_ts: v.lastTs,
      });
    }
  }

  // /people extraction — top 20 most active users
  console.log("\n[people] extracting profiles…");
  const ranked = Array.from(userProfiles.values())
    .filter((u) => u.total >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  let peopleCount = 0;
  let personSkillsCount = 0;
  for (const u of ranked) {
    let profile: typeof u | null = u;
    try {
      const r = await slack.users.info({ user: u.slack_user_id });
      if (r.user) {
        profile = {
          ...u,
          display_name: r.user.profile?.display_name || r.user.name || null,
          real_name: r.user.profile?.real_name || r.user.real_name || null,
          title: r.user.profile?.title || null,
          email: r.user.profile?.email || null,
          avatar_url: r.user.profile?.image_72 || null,
          is_bot: !!r.user.is_bot,
          deleted: !!r.user.deleted,
        };
      }
    } catch {
      // skip user info failure, still try to extract
    }
    if (!profile || profile.is_bot || profile.deleted) continue;

    const topChannels = Array.from(profile.channels.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let extracted: { role: string | null; summary: string | null; tools: string[]; expertise: string[] };
    try {
      extracted = await extractPerson({
        display_name: profile.display_name,
        real_name: profile.real_name,
        title: profile.title,
        topChannels: topChannels.map((c) => ({ name: c.name, purpose: c.purpose, count: c.count })),
        sampleMessages: profile.sample_messages,
        totalMessages: profile.total,
      });
    } catch (e) {
      console.warn(`  ! person ${profile.slack_user_id}: ${(e as Error).message}`);
      continue;
    }

    const existing = await selectOne<{ id: string }>("people", {
      select: "id",
      workspace_id: `eq.${WORKSPACE_ID}`,
      slack_user_id: `eq.${profile.slack_user_id}`,
    });
    const row = {
      workspace_id: WORKSPACE_ID,
      slack_user_id: profile.slack_user_id,
      display_name: profile.display_name,
      real_name: profile.real_name,
      title: profile.title,
      email: profile.email,
      avatar_url: profile.avatar_url,
      is_bot: false,
      is_deleted: false,
      role_extracted: extracted.role,
      summary: extracted.summary,
      tools: extracted.tools,
      expertise: extracted.expertise,
      top_channels: topChannels.map((c) => ({
        slack_channel_id: [...profile.channels.entries()].find(([, v]) => v === c)?.[0],
        name: c.name,
        count: c.count,
      })),
      message_count: profile.total,
      confidence: Math.min(0.99, 0.4 + 0.1 * Math.log2(profile.total + 1)),
      status: "draft",
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await update("people", { id: `eq.${existing.id}` }, row);
    } else {
      await insert("people", row);
    }
    peopleCount++;
    console.log(`  ${profile.display_name ?? profile.slack_user_id} (${extracted.role ?? "?"})`);

    // Person → skills
    if (extracted.role) {
      try {
        const personSkills = await extractSkillsForPerson({
          displayName: profile.display_name ?? profile.real_name ?? profile.slack_user_id,
          role: extracted.role,
          summary: extracted.summary,
          tools: extracted.tools,
          expertise: extracted.expertise,
          topChannels: topChannels.map((c) => ({ name: c.name, purpose: c.purpose })),
        });
        for (const s of personSkills) {
          await upsertSkill({ ...s, domain: s.domain ?? null });
        }
        personSkillsCount += personSkills.length;
      } catch {
        // Person-derived skills are bonus; ignore failures.
      }
    }
  }

  await update("workspaces", { id: `eq.${WORKSPACE_ID}` }, { backfill_status: "ready" });

  console.log(
    `\n✅ Done. channels=${channels.length}, channel_skills=${totalSkills}, person_skills=${personSkillsCount}, glossary=${totalTerms}, people=${peopleCount}`,
  );
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
