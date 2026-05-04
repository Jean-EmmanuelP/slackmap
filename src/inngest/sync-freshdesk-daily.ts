import { inngest } from "./client";
import {
  getWorkspaceFreshdesk,
  setFreshdeskStatus,
  upsertSkill,
  upsertGlossary,
  db,
} from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { FreshdeskClient } from "@/lib/freshdesk";
import {
  extractSkillsFromTickets,
  extractGlossaryFromFreshdesk,
  groupTicketsByType,
} from "@/lib/extract/freshdesk";
import { loadWorkspaceApiKey } from "@/lib/extract/llm";

export const syncFreshdeskDaily = inngest.createFunction(
  {
    id: "sync-freshdesk-daily",
    triggers: [{ cron: "0 5 * * *" }],
  },
  async ({ step, logger }) => {
    const { data: workspaces } = await db()
      .from("workspaces")
      .select("id, freshdesk_domain, freshdesk_connected_at")
      .not("freshdesk_domain", "is", null);

    if (!workspaces || workspaces.length === 0) return;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const ws of workspaces) {
      await step.run(`freshdesk-sync-${ws.id}`, async () => {
        try {
          const conn = await getWorkspaceFreshdesk(ws.id);
          if (!conn) return;

          const apiKey = decrypt(conn.encryptedKey);
          const fd = new FreshdeskClient(conn.domain, apiKey);

          const since = ws.freshdesk_connected_at
            ? new Date(ws.freshdesk_connected_at).toISOString()
            : oneDayAgo;

          const tickets = await fd.listTicketsUpdatedSince(since);
          if (tickets.length === 0) {
            logger.info(`Freshdesk sync: ${ws.id} — no new tickets, skipping LLM`);
            return;
          }

          const llmKey = await loadWorkspaceApiKey(ws.id);
          await setFreshdeskStatus(ws.id, "running");

          const withConvos = [];
          for (const t of tickets.slice(0, 50)) {
            const convos = await fd.getTicketConversations(t.id).catch(() => []);
            withConvos.push({ ticket: t, conversations: convos });
          }

          let skillCount = 0;
          const byType = groupTicketsByType(withConvos);
          for (const [groupLabel, groupTickets] of byType.entries()) {
            if (groupTickets.length < 3) continue;
            const skills = await extractSkillsFromTickets(fd, llmKey, groupTickets, {
              groupLabel,
              convosPerTicket: 6,
            });
            for (const s of skills) {
              await upsertSkill(ws.id, { ...s, source: "freshdesk" });
            }
            skillCount += skills.length;
          }

          const subjects = tickets.map((t) => `${t.subject}\n${(t.description_text ?? "").slice(0, 500)}`);
          const entries = await extractGlossaryFromFreshdesk(llmKey, subjects.slice(0, 30));
          if (entries.length > 0) {
            await upsertGlossary(
              ws.id,
              entries.map((e) => ({
                term: e.term,
                definition: e.definition,
                category: e.category,
                source: "freshdesk" as const,
              })),
            );
          }

          await db()
            .from("workspaces")
            .update({ freshdesk_connected_at: new Date().toISOString() })
            .eq("id", ws.id);

          await setFreshdeskStatus(ws.id, "done");
          logger.info(`Freshdesk sync: ${ws.id} — ${tickets.length} new, ${skillCount} skills, ${entries.length} glossary`);
        } catch (err) {
          logger.error(`Freshdesk sync failed for ${ws.id}: ${(err as Error).message}`);
          await setFreshdeskStatus(ws.id, "failed", (err as Error).message);
        }
      });
    }
  },
);
