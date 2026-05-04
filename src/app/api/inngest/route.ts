import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { backfill } from "@/inngest/backfill";
import { onSlackEvent } from "@/inngest/on-slack-event";
import { reconcileDaily } from "@/inngest/reconcile-daily";
import { extractSkills } from "@/inngest/extract-skills";
import { mineChannel } from "@/inngest/mine-channel";
import { extractPeople } from "@/inngest/extract-people";
import { reExtractPerson } from "@/inngest/re-extract-person";
import { extractFreshdesk } from "@/inngest/extract-freshdesk";
import { syncFreshdeskDaily } from "@/inngest/sync-freshdesk-daily";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    backfill,
    onSlackEvent,
    reconcileDaily,
    extractSkills,
    mineChannel,
    extractPeople,
    reExtractPerson,
    extractFreshdesk,
    syncFreshdeskDaily,
  ],
});
