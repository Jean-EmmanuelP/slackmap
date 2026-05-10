import { inngest, type FreshdeskExtractRequestedData } from "./client";
import {
  getWorkspace,
  getWorkspaceFreshdesk,
  setFreshdeskStatus,
  upsertSkill,
  upsertGlossary,
  db,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient, type FreshdeskAgent } from "@/lib/freshdesk";
import {
  extractSkillsFromArticles,
  extractSkillsFromTickets,
  extractGlossaryFromFreshdesk,
  groupTicketsByType,
} from "@/lib/extract/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

async function upsertFreshdeskAgent(
  workspaceId: string,
  agent: FreshdeskAgent,
  resolvedCount: number,
): Promise<void> {
  const email = agent.contact?.email?.trim().toLowerCase() ?? null;
  const name = agent.contact?.name ?? null;
  const summary =
    resolvedCount > 0
      ? `Freshdesk support agent. Last responder on ${resolvedCount} tickets in the last 90 days.`
      : `Freshdesk support agent.`;

  // Dedup pass: if a person with this email OR exact normalised name already
  // exists in the workspace (almost always a Slack-extracted user), link the
  // Freshdesk identity to that row instead of creating a 2nd profile. Same
  // human, two surfaces. Email match wins; falls back to exact name match
  // because work email and Freshdesk email often differ.
  type ExistingMatch = { id: string; tools: string[] | null; role_extracted: string | null };
  let existing: ExistingMatch | null = null;

  if (email) {
    const { data } = await db()
      .from("people")
      .select("id, tools, role_extracted")
      .eq("workspace_id", workspaceId)
      .ilike("email", email)
      .neq("slack_user_id", `freshdesk-agent-${agent.id}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      existing = {
        id: data.id as string,
        tools: data.tools as string[] | null,
        role_extracted: data.role_extracted as string | null,
      };
    }
  }

  if (!existing && name) {
    // Pull all non-freshdesk-agent rows for this workspace and match by
    // normalised display_name (lower + accents stripped + collapsed spaces).
    const norm = (s: string | null | undefined) =>
      (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
    const target = norm(name);
    if (target) {
      const { data: candidates } = await db()
        .from("people")
        .select("id, display_name, tools, role_extracted")
        .eq("workspace_id", workspaceId)
        .not("slack_user_id", "like", "freshdesk-agent-%");
      const hit = (candidates ?? []).find(
        (c) => norm(c.display_name as string | null) === target,
      );
      if (hit?.id) {
        existing = {
          id: hit.id as string,
          tools: hit.tools as string[] | null,
          role_extracted: hit.role_extracted as string | null,
        };
      }
    }
  }

  if (existing) {
    const currentTools = Array.isArray(existing.tools) ? existing.tools : [];
    const nextTools = currentTools.includes("Freshdesk")
      ? currentTools
      : [...currentTools, "Freshdesk"];
    const nextRole = existing.role_extracted ?? "Support";
    await db()
      .from("people")
      .update({
        tools: nextTools,
        role_extracted: nextRole,
        last_seen_at: agent.last_active_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  // No matching person → create the Freshdesk-only row as before.
  const slackUserId = `freshdesk-agent-${agent.id}`;
  await db()
    .from("people")
    .upsert(
      {
        workspace_id: workspaceId,
        slack_user_id: slackUserId,
        display_name: name,
        real_name: name,
        title: agent.contact?.job_title ?? null,
        email: agent.contact?.email ?? null,
        avatar_url: agent.contact?.avatar?.avatar_url ?? null,
        is_bot: false,
        is_deleted: false,
        role_extracted: "Support",
        summary,
        tools: ["Freshdesk"],
        expertise: [],
        top_channels: [],
        message_count: resolvedCount,
        confidence: 0.6,
        status: "active",
        last_seen_at: agent.last_active_at ?? new Date().toISOString(),
        first_seen_at: agent.created_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,slack_user_id" },
    );
}

// Pull Freshdesk solution articles + recent tickets, run them through the LLM
// extractor, and persist as skills + glossary entries with source='freshdesk'.
export const extractFreshdesk = inngest.createFunction(
  {
    id: "extract-freshdesk",
    concurrency: { limit: 1, key: "event.data.workspaceId" },
    triggers: [{ event: "workspace/freshdesk.requested" }],
  },
  async ({ event, step, logger }) => {
    const { workspaceId } = event.data as FreshdeskExtractRequestedData;

    const conn = await step.run("load-freshdesk-conn", () => getWorkspaceFreshdesk(workspaceId));
    if (!conn) {
      logger.warn(`No Freshdesk connection for ${workspaceId}`);
      return { skipped: true };
    }

    const ws = await step.run("load-ws", () => getWorkspace(workspaceId));

    const apiKey = decrypt(conn.encryptedKey);
    const fd = new FreshdeskClient(conn.domain, apiKey);
    const llmKey = await loadWorkspaceApiKey(workspaceId);

    await step.run("ping", async () => {
      try {
        await fd.ping();
      } catch (e) {
        await setFreshdeskStatus(workspaceId, "failed", (e as Error).message);
        throw e;
      }
    });

    await step.run("mark-running", () => setFreshdeskStatus(workspaceId, "running"));

    // 1) Solution articles → 0..3 atomic skills per article.
    const articleSkillCount = await step.run("extract-articles", async () => {
      try {
        const cats = await fd.listSolutionCategories();
        const perFolderArticles: Array<{
          folderName: string;
          article: import("@/lib/freshdesk").FreshdeskSolutionArticle;
        }> = [];
        outer: for (const cat of cats.slice(0, 5)) {
          const folders = await fd.listFoldersForCategory(cat.id);
          for (const folder of folders.slice(0, 8)) {
            const articles = await fd.listArticlesInFolder(folder.id);
            for (const article of articles.slice(0, 60)) {
              perFolderArticles.push({ folderName: folder.name, article });
              if (perFolderArticles.length >= 200) break outer;
            }
          }
        }
        const skills = await extractSkillsFromArticles(fd, llmKey, perFolderArticles, ws);
        for (const s of skills) {
          await upsertSkill(workspaceId, { ...s, source: "freshdesk" });
        }
        return skills.length;
      } catch (e) {
        logger.warn(`articles extract failed: ${(e as Error).message}`);
        return 0;
      }
    });

    // 2) Recent tickets → recurring skills/policies, batched by type.
    const ticketSkillCount = await step.run("extract-tickets", async () => {
      try {
        const tickets = await fd.listRecentTickets({ perPage: 100, pages: 3 });
        const withConvos: Array<{
          ticket: import("@/lib/freshdesk").FreshdeskTicket;
          conversations: import("@/lib/freshdesk").FreshdeskConversation[];
        }> = [];
        for (const t of tickets.slice(0, 100)) {
          const convos = await fd.getTicketConversations(t.id).catch(() => []);
          withConvos.push({ ticket: t, conversations: convos });
        }

        const byType = groupTicketsByType(withConvos);
        let total = 0;
        for (const [groupLabel, groupTickets] of byType.entries()) {
          if (groupTickets.length < 5) continue;
          const skills = await extractSkillsFromTickets(fd, llmKey, groupTickets, {
            groupLabel,
            convosPerTicket: 8,
          }, ws);
          for (const s of skills) {
            await upsertSkill(workspaceId, { ...s, source: "freshdesk" });
          }
          total += skills.length;
        }
        // Fallback: nothing groupable — run one mixed batch so we don't lose data.
        if (total === 0 && withConvos.length > 0) {
          const skills = await extractSkillsFromTickets(fd, llmKey, withConvos, {
            groupLabel: "mixed",
            convosPerTicket: 8,
          }, ws);
          for (const s of skills) {
            await upsertSkill(workspaceId, { ...s, source: "freshdesk" });
          }
          total = skills.length;
        }
        return total;
      } catch (e) {
        logger.warn(`tickets extract failed: ${(e as Error).message}`);
        return 0;
      }
    });

    // 3) Glossary across articles + ticket subjects.
    const glossaryCount = await step.run("extract-glossary", async () => {
      try {
        const cats = await fd.listSolutionCategories();
        const texts: string[] = [];
        for (const cat of cats.slice(0, 5)) {
          const folders = await fd.listFoldersForCategory(cat.id);
          for (const folder of folders.slice(0, 4)) {
            const articles = await fd.listArticlesInFolder(folder.id);
            for (const article of articles.slice(0, 8)) {
              if (article.description_text) {
                texts.push(`${article.title}\n${article.description_text}`);
              }
            }
          }
        }
        const tickets = await fd.listRecentTickets({ perPage: 50, pages: 1 });
        for (const t of tickets) {
          texts.push(`${t.subject}\n${(t.description_text ?? "").slice(0, 800)}`);
        }
        const entries = await extractGlossaryFromFreshdesk(llmKey, texts, ws);
        if (entries.length > 0) {
          await upsertGlossary(
            workspaceId,
            entries.map((e) => ({
              term: e.term,
              definition: e.definition,
              category: e.category,
              source: "freshdesk" as const,
            })),
          );
        }
        return entries.length;
      } catch (e) {
        logger.warn(`glossary extract failed: ${(e as Error).message}`);
        return 0;
      }
    });

    // 4) Agents → people rows (so /people shows multi-source brain).
    const agentCount = await step.run("extract-agents", async () => {
      try {
        const agents = await fd.listAgents({ perPage: 100, pages: 2 });
        // Approximate "last responder" counts via the recent tickets we just pulled.
        // Unlike the local script, we don't keep withConvos in scope here, so re-pull
        // a small sample for the count signal.
        const recent = await fd.listRecentTickets({ perPage: 50, pages: 1 });
        const counts = new Map<number, number>();
        for (const t of recent.slice(0, 50)) {
          const convos = await fd.getTicketConversations(t.id).catch(() => []);
          const lastAgentReply = [...convos]
            .reverse()
            .find((c) => !c.incoming && !c.private && c.user_id);
          if (lastAgentReply?.user_id) {
            counts.set(lastAgentReply.user_id, (counts.get(lastAgentReply.user_id) ?? 0) + 1);
          }
        }
        for (const agent of agents) {
          await upsertFreshdeskAgent(workspaceId, agent, counts.get(agent.id) ?? 0);
        }
        return agents.length;
      } catch (e) {
        logger.warn(`agents extract failed: ${(e as Error).message}`);
        return 0;
      }
    });

    await step.run("mark-done", () => setFreshdeskStatus(workspaceId, "done"));

    return {
      workspaceId,
      articleSkillCount,
      ticketSkillCount,
      glossaryCount,
      agentCount,
    };
  },
);
