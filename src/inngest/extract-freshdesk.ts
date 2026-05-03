import { inngest, type FreshdeskExtractRequestedData } from "./client";
import {
  getWorkspaceFreshdesk,
  setFreshdeskStatus,
  upsertSkill,
  upsertGlossary,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import {
  extractSkillsFromArticles,
  extractSkillsFromTickets,
  extractGlossaryFromFreshdesk,
} from "@/lib/extract/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

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

    // 1) Solution articles → one skill per article (when applicable).
    const articleSkillCount = await step.run("extract-articles", async () => {
      try {
        const cats = await fd.listSolutionCategories();
        const perFolderArticles: Array<{
          folderName: string;
          article: import("@/lib/freshdesk").FreshdeskSolutionArticle;
        }> = [];
        for (const cat of cats.slice(0, 5)) {
          const folders = await fd.listFoldersForCategory(cat.id);
          for (const folder of folders.slice(0, 8)) {
            const articles = await fd.listArticlesInFolder(folder.id);
            for (const article of articles.slice(0, 12)) {
              perFolderArticles.push({ folderName: folder.name, article });
            }
          }
        }
        const skills = await extractSkillsFromArticles(fd, llmKey, perFolderArticles);
        for (const s of skills) {
          await upsertSkill(workspaceId, { ...s, source: "freshdesk" });
        }
        return skills.length;
      } catch (e) {
        logger.warn(`articles extract failed: ${(e as Error).message}`);
        return 0;
      }
    });

    // 2) Recent tickets → recurring skills/policies.
    const ticketSkillCount = await step.run("extract-tickets", async () => {
      try {
        const tickets = await fd.listRecentTickets({ perPage: 100, pages: 2 });
        const withConvos: Array<{
          ticket: import("@/lib/freshdesk").FreshdeskTicket;
          conversations: import("@/lib/freshdesk").FreshdeskConversation[];
        }> = [];
        for (const t of tickets.slice(0, 30)) {
          const convos = await fd.getTicketConversations(t.id).catch(() => []);
          withConvos.push({ ticket: t, conversations: convos });
        }
        const skills = await extractSkillsFromTickets(fd, llmKey, withConvos);
        for (const s of skills) {
          await upsertSkill(workspaceId, { ...s, source: "freshdesk" });
        }
        return skills.length;
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
        const entries = await extractGlossaryFromFreshdesk(llmKey, texts);
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

    await step.run("mark-done", () => setFreshdeskStatus(workspaceId, "done"));

    return {
      workspaceId,
      articleSkillCount,
      ticketSkillCount,
      glossaryCount,
    };
  },
);
