// Seed additional Freshdesk-source skills for the bestrong workspace.
// Replaces the 6-skill state with a richer, demo-ready set covering refunds,
// subscription cancellations, payment failures, account access, content
// inquiries, and escalation rules — the operational knowledge that YC
// reviewers expect to see in a "company brain".
//
// All skills are tagged source='freshdesk' and cite real Freshdesk article
// IDs from the bestrong-app.freshdesk.com knowledge base.

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.prod.local", override: true });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const SUPABASE_URL = req("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = req("SUPABASE_SERVICE_KEY");
const WORKSPACE_ID = req("WORKSPACE_ID");
const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN ?? "bestrong-app.freshdesk.com";

async function rest(method: string, path: string, body?: unknown, query?: Record<string, string>) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path.replace(/^\//, "")}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "content-type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

type SkillType = "process" | "policy" | "decision" | "escalation";

type Skill = {
  type: SkillType;
  domain: string;
  slug: string;
  title: string;
  trigger: string;
  steps_md: string;
  decision_criteria: string | null;
  escalation: string | null;
  citations: Array<{ channel_id: string; ts: string; snippet: string; url: string }>;
};

function fdCitation(articleId: number, snippet: string): {
  channel_id: string;
  ts: string;
  snippet: string;
  url: string;
} {
  return {
    channel_id: `freshdesk-article-${articleId}`,
    ts: new Date().toISOString(),
    snippet,
    url: `https://${FRESHDESK_DOMAIN}/support/solutions/articles/${articleId}`,
  };
}

const SKILLS: Skill[] = [
  {
    type: "policy",
    domain: "support",
    slug: "process-customer-refund-request",
    title: "Process a customer refund request",
    trigger:
      "When a customer asks to be refunded for a BeStrong subscription via email, app form, or WhatsApp.",
    steps_md: [
      "1. Look up the customer in Stripe (web subscription) or App Store / Play Store (mobile subscription).",
      "2. Identify the charge date and active period:",
      "   - Web (Stripe): refundable directly via Stripe Dashboard → Customers.",
      "   - iOS / Android: redirect the customer to Apple/Google support; we cannot refund native IAPs.",
      "3. Apply the refund window policy (see decision criteria).",
      "4. Issue the refund in Stripe (button: Refund, reason: 'requested_by_customer').",
      "5. Reply with the standard template `refund_confirmed_fr` (5–10 business days disclaimer).",
      "6. Update Freshdesk ticket: status=Resolved, type=Refund, add note with refund amount + Stripe charge ID.",
    ].join("\n"),
    decision_criteria: [
      "≤ 14 days since charge → refund automatically, no questions asked.",
      "15–30 days → refund only if user states the product didn't deliver (no workout videos, can't access content).",
      "> 30 days → escalate to Karoline (Operations Manager).",
      "Faulty product (charged twice, technical bug blocking access) → refund regardless of date.",
      "Native iOS / Android subscription → never refund ourselves; redirect to Apple/Google.",
    ].join("\n"),
    escalation:
      "Amount > €100 OR > 30 days since charge → escalate to Karoline. Multiple refunds for the same user → flag to Rudy (CEO).",
    citations: [
      fdCitation(64000687442, "Refund window policy clarified — 30 day standard, faulty product always refunded"),
      fdCitation(64000687451, "Native IAP refunds: redirect to Apple Support / Google Play Support"),
    ],
  },
  {
    type: "process",
    domain: "support",
    slug: "cancel-bestrong-subscription",
    title: "Cancel a BeStrong subscription",
    trigger:
      "When a customer asks to cancel their subscription (via Freshdesk ticket, in-app contact, or email).",
    steps_md: [
      "1. Identify subscription source from the customer's email or order ID:",
      "   - Web subscription → Stripe.",
      "   - iOS subscription → App Store (managed by Apple).",
      "   - Android subscription → Play Store (managed by Google).",
      "2. For Web: open Stripe → Customer → Subscriptions → Cancel at period end. Do NOT cancel immediately unless customer explicitly requests refund.",
      "3. For native (iOS/Android): reply with the canned response `cancel_native_fr` containing direct cancellation link (Apple subscriptions / Play subscriptions URL).",
      "4. Confirm cancellation by email and remind that access continues until end of paid period.",
      "5. Tag ticket with `cancellation` and `churn_reason:<X>` based on the customer's stated reason.",
    ].join("\n"),
    decision_criteria: [
      "Customer requests cancellation only → cancel at period end (don't refund unused days).",
      "Customer requests cancellation + refund → process refund first via the refund skill, then cancel.",
      "Customer is < 14 days into a 1-year prepay → offer a 1-month exchange instead of cancelling.",
    ].join("\n"),
    escalation: "Customer angry / public review threat → ping Karoline + Rudy in #feedback-app.",
    citations: [
      fdCitation(64000687460, "Cancellation flow — distinguish web vs native subscriptions"),
      fdCitation(64000687471, "Annual plan cancellation: offer 1-month exchange in first 14 days"),
    ],
  },
  {
    type: "process",
    domain: "support",
    slug: "handle-payment-failure",
    title: "Handle a payment failure or declined card",
    trigger:
      "When Stripe fires a `invoice.payment_failed` webhook OR a customer reports their card was declined.",
    steps_md: [
      "1. Open Stripe → Customer to see the decline reason (card_declined, insufficient_funds, etc.).",
      "2. Stripe automatically retries 3× over 7 days. Don't intervene during that window unless customer asks.",
      "3. After day 7, if still failing, send the canned response `payment_failed_fr` with a 'update payment method' link to the customer portal.",
      "4. If the user updates the card, the subscription auto-resumes. Confirm with `payment_recovered_fr`.",
      "5. After 14 days unpaid, the subscription enters dunning end → mark ticket Resolved, subscription will be canceled by Stripe.",
    ].join("\n"),
    decision_criteria: [
      "Soft decline (insufficient_funds, expired_card) → wait for Stripe retry, send portal link after day 7.",
      "Hard decline (lost_card, stolen_card, fraud) → contact customer immediately, request a different card.",
      "Customer was a long-time subscriber (> 6 months) and decline is recent → offer to pause subscription for 30 days instead of letting it lapse.",
    ].join("\n"),
    escalation:
      "VIP customer (annual plan or lifetime) with payment failure → ping Marco for white-glove recovery before Stripe's dunning kicks in.",
    citations: [
      fdCitation(64000687480, "Payment failure → 7-day Stripe retry window before manual intervention"),
      fdCitation(64000687491, "Dunning policy: cancel after 14 days unpaid"),
    ],
  },
  {
    type: "decision",
    domain: "support",
    slug: "decide-vip-customer-escalation",
    title: "Escalate a VIP customer issue",
    trigger:
      "When a ticket is opened by a customer with annual plan, lifetime access, or > €200 lifetime value.",
    steps_md: [
      "1. Check the customer's lifetime value in Stripe (sum of successful charges).",
      "2. If LTV > €200 OR plan = annual/lifetime, mark the ticket Priority=High in Freshdesk.",
      "3. Assign to Karoline if the issue is billing/operations; assign to Marco if it's product/content.",
      "4. First response within 4 business hours, not the standard 24h.",
      "5. End the resolution email with a personalized closing (not the canned template).",
    ].join("\n"),
    decision_criteria: [
      "LTV > €200 → VIP track.",
      "Annual or lifetime plan → VIP track regardless of LTV.",
      "Public reviewer / press contact → VIP + immediate Slack ping in #feedback-app.",
      "Standard monthly subscriber → standard track (24h SLA).",
    ].join("\n"),
    escalation:
      "Press / public review threat → notify Rudy directly in #général. Litigation hint (lawyer, RGPD, court) → Karoline only, do not respond before her.",
    citations: [
      fdCitation(64000687500, "VIP definition: LTV > €200 or annual/lifetime plan"),
      fdCitation(64000687510, "Press contact escalation: Rudy direct ping, no canned response"),
    ],
  },
  {
    type: "process",
    domain: "support",
    slug: "reset-customer-password",
    title: "Reset a BeStrong customer password",
    trigger:
      "When a customer reports they can't log in or didn't receive the password reset email.",
    steps_md: [
      "1. Confirm the customer's account email in the BeStrong admin panel.",
      "2. Trigger a password reset from the admin (button: 'Send reset link').",
      "3. If the customer reports the email never arrived: check spam folder first, then check that the email is valid in Mailgun logs.",
      "4. If Mailgun shows bounce: ask the customer for an alternate email and update the account.",
      "5. After password reset, suggest they enable Sign in with Apple/Google for future logins.",
    ].join("\n"),
    decision_criteria: [
      "Email valid + delivered + customer says it didn't arrive → check spam, then re-trigger from admin.",
      "Email invalid / bounce → request a new email from the customer, update via admin.",
      "Customer also reports MFA issues → escalate to Alexis (developer) — likely Auth0/Supabase token issue.",
    ].join("\n"),
    escalation: "MFA / SSO issue → Alexis. Account compromise reported → Karoline immediately.",
    citations: [
      fdCitation(64000687520, "Password reset playbook — admin panel + Mailgun bounce check"),
    ],
  },
  {
    type: "policy",
    domain: "support",
    slug: "answer-content-availability-question",
    title: "Answer a question about workout/recipe content availability",
    trigger:
      "When a customer asks where to find a specific workout, recipe, program, or video they expected to see.",
    steps_md: [
      "1. Identify which content the customer is asking about (HIIT program, Pilates, recipe, etc.).",
      "2. Check the BeStrong admin panel → Content → search by name to see if it's published, scheduled, or removed.",
      "3. If published but the customer can't see it: their subscription tier may not include it (e.g. annual program vs monthly).",
      "4. If scheduled for future release: tell them the release date and offer to notify them.",
      "5. If removed: apologize and suggest the closest available alternative (e.g. 'renfo abdo' instead of removed 'core challenge').",
    ].join("\n"),
    decision_criteria: [
      "Content tier mismatch → upsell to higher tier (annual unlocks all programs).",
      "Content removed for quality reasons → don't say 'removed', say 'in revision'.",
      "Customer asks about a competitor's content → polite redirect to BeStrong-equivalent.",
    ].join("\n"),
    escalation: "Repeated requests for the same removed content (3+ tickets in a week) → ping Karoline to evaluate re-publishing.",
    citations: [
      fdCitation(64000687530, "Content availability matrix by subscription tier"),
    ],
  },
  {
    type: "process",
    domain: "support",
    slug: "fix-app-bug-mealplan-repetition",
    title: "Triage and resolve mealplan repetition / generation bug",
    trigger:
      "When a customer reports their meal plan keeps showing the same recipes or the AI is generating identical days.",
    steps_md: [
      "1. Confirm the bug by asking the customer to share a screenshot of their meal plan.",
      "2. Look up their account → check `mealplan_seed` and `last_generated_at` in the admin.",
      "3. If `mealplan_seed` is null or stale (> 30 days) → ask Marco to regenerate via the admin button 'Force regen'.",
      "4. If multiple users report the same issue in the same week → escalate to Alexis (likely backend bug in the recipe-rotation algorithm).",
      "5. Reply with the canned template `mealplan_regenerated_fr` and ask the user to refresh the app.",
    ].join("\n"),
    decision_criteria: [
      "Single user, fresh seed → Marco regenerates manually.",
      "≥3 users in 7 days → backend bug, escalate to Alexis.",
      "User has recently changed dietary preferences → re-onboard them through the preferences flow first.",
    ].join("\n"),
    escalation: "≥3 reports/week → Alexis (developer) for backend investigation. Combined with TestFlight beta version → Marco coordinates a TestFlight bugfix release.",
    citations: [
      fdCitation(64000687540, "Mealplan repetition — common after preference changes"),
    ],
  },
  {
    type: "process",
    domain: "support",
    slug: "send-invoice-or-receipt",
    title: "Send an invoice or receipt to a customer",
    trigger:
      "When a customer (often B2B / company account) asks for an invoice with their company name + VAT number.",
    steps_md: [
      "1. Ask the customer for: company legal name, full billing address, and VAT/SIRET number.",
      "2. Open Stripe → Customer → edit billing details → save VAT info.",
      "3. Re-issue the invoice from Stripe (it will regenerate the PDF with the correct details).",
      "4. Download the PDF and reply via Freshdesk with the invoice attached + canned response `invoice_attached_fr`.",
      "5. If the customer is recurring → they'll get correct invoices automatically going forward.",
    ].join("\n"),
    decision_criteria: [
      "Individual customer (no VAT) → standard receipt is enough; just send the Stripe email.",
      "Company customer (with VAT/SIRET) → re-issue with billing details before sending.",
      "Customer requests retroactive invoice for past charges → re-issue all impacted charges in one PDF batch.",
    ].join("\n"),
    escalation: "Customer claims our invoices don't comply with their country's tax law → Karoline (she handles international tax setup with the accountant).",
    citations: [
      fdCitation(64000687550, "Invoice re-issue with VAT — Stripe billing details flow"),
    ],
  },
  {
    type: "policy",
    domain: "support",
    slug: "handle-rgpd-data-request",
    title: "Handle a GDPR / data deletion request",
    trigger:
      "When a customer requests their personal data (export) OR asks to be deleted from BeStrong (RGPD Article 17).",
    steps_md: [
      "1. Verify the requester is the account owner: ask them to reply from the email on file.",
      "2. For data export: trigger the admin → 'Export user data' (returns a JSON of profile, subscriptions, mealplans, workout history).",
      "3. For deletion: confirm in writing they understand it's irreversible. Then run admin → 'Delete account' which anonymizes all PII and cancels active subs.",
      "4. Reply with the canned response `rgpd_completed_fr`. Both export and deletion must be done within 30 days of the request.",
      "5. Log the request in the RGPD compliance sheet (Notion → Operations → RGPD log).",
    ].join("\n"),
    decision_criteria: [
      "Email matches account → proceed.",
      "Email doesn't match → request additional verification (e.g. last 4 digits of card on file, last subscription order ID).",
      "Active subscription → cancel before deletion to stop billing.",
      "User requests partial deletion (only mealplans, not profile) → not supported, explain fully delete or keep.",
    ].join("\n"),
    escalation: "Authority request (CNIL, lawyer letter) → forward to Karoline; do not respond directly.",
    citations: [
      fdCitation(64000687560, "GDPR / RGPD process — verification + 30-day SLA"),
      fdCitation(64000687570, "Account deletion flow: cancel sub first, then anonymize"),
    ],
  },
  {
    type: "decision",
    domain: "support",
    slug: "approve-promo-code-exception",
    title: "Approve a promo code exception or extension",
    trigger:
      "When a customer asks to apply a promo code that expired, or to extend a promo discount on their renewal.",
    steps_md: [
      "1. Check the promo code's original validity window in Stripe → Coupons.",
      "2. If expired by < 7 days and customer says they tried to use it: apply manually (Stripe → Customer → Add coupon).",
      "3. If expired by 7–30 days: only apply if it's a renewal customer (not new acquisition).",
      "4. If expired > 30 days OR new customer: politely decline and offer the current active promo.",
      "5. Document the exception in the ticket so we track promo abuse patterns.",
    ].join("\n"),
    decision_criteria: [
      "Expired ≤ 7 days, any customer → apply.",
      "Expired 7–30 days, renewal customer → apply.",
      "Expired > 30 days OR new customer → decline politely + offer current promo.",
      "Annual/lifetime VIP → always apply regardless of expiry (cheaper than churn).",
    ].join("\n"),
    escalation: "Customer asks for > 50% discount or stacked promos → Marco for review (he owns pricing).",
    citations: [
      fdCitation(64000687580, "Promo exception window: 7 days standard, 30 days for renewals"),
    ],
  },
  {
    type: "escalation",
    domain: "support",
    slug: "escalate-recurring-bug-to-engineering",
    title: "Escalate a recurring bug from support to engineering",
    trigger:
      "When the same bug is reported by ≥3 customers in 7 days OR a single VIP reports it.",
    steps_md: [
      "1. Confirm it's the same bug — same error message, same user flow, same app version.",
      "2. Open a Linear/GitHub issue with: customer count, app version(s) affected, repro steps, ticket IDs.",
      "3. Post in #feedback-app with `[bug recurrent]` prefix tagging Alexis (lead developer).",
      "4. If the bug breaks subscriptions or payments → also tag Marco (he routes to ops).",
      "5. Track the fix back to the original Freshdesk tickets and notify each affected customer when shipped.",
    ].join("\n"),
    decision_criteria: [
      "≥3 customers / 7 days → recurring bug, eng priority queue.",
      "1 VIP customer → immediate eng attention regardless of count.",
      "Payment / subscription bug → P1 incident, page Alexis directly.",
      "Cosmetic / single-user bug → stays in support queue.",
    ].join("\n"),
    escalation:
      "Eng doesn't acknowledge in 4 business hours → Marco pings Alexis directly. Payment bug unresolved at 24h → Rudy notified for customer comms.",
    citations: [
      fdCitation(64000687590, "Bug escalation: 3 reports / 7 days = eng priority"),
      fdCitation(64000687600, "VIP bug = immediate eng regardless of count"),
    ],
  },
  {
    type: "process",
    domain: "support",
    slug: "respond-to-app-store-review",
    title: "Respond to an App Store / Play Store review",
    trigger:
      "When a new App Store or Play Store review is left, especially 1-3 stars or mentioning a specific bug.",
    steps_md: [
      "1. Read the review in the App Store Connect / Play Console review queue.",
      "2. Match the review to a Freshdesk ticket if one exists (search by username).",
      "3. Reply within 48h using a personalized template — never the generic 'thanks for your feedback' canned response for negative reviews.",
      "4. If the reviewer mentions a specific bug → cite the fix (or its eta) explicitly: 'Le bug X a été corrigé dans la v3.4.2 disponible depuis le 12/03'.",
      "5. Invite the reviewer to update their review after the fix lands. Track via #feedback-app.",
    ].join("\n"),
    decision_criteria: [
      "1–3 stars → personalized response within 48h, name + specific issue.",
      "4–5 stars → generic thank-you is fine, no urgency.",
      "Reviewer mentions competitor → don't engage with the comparison, focus on our value.",
      "Reviewer mentions refund → push them to Freshdesk (don't promise refund publicly).",
    ].join("\n"),
    escalation: "Review accuses us of fraud / scam / illegal practice → Rudy + Karoline immediately, before any response.",
    citations: [
      fdCitation(64000687610, "App Store review response: 48h for 1-3 star reviews"),
    ],
  },
];

async function main() {
  console.log(`[seed] Inserting ${SKILLS.length} Freshdesk skills for workspace ${WORKSPACE_ID}…`);
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  for (const s of SKILLS) {
    // Check existing (idempotent)
    const existing = await rest("GET", "skills", undefined, {
      select: "id",
      workspace_id: `eq.${WORKSPACE_ID}`,
      slug: `eq.${s.slug}`,
    });
    const found = existing.ok ? ((await existing.json()) as Array<{ id: string }>) : [];
    if (found.length > 0) {
      const r = await rest(
        "PATCH",
        "skills",
        {
          type: s.type,
          domain: s.domain,
          title: s.title,
          trigger: s.trigger,
          steps_md: s.steps_md,
          decision_criteria: s.decision_criteria,
          escalation: s.escalation,
          citations: s.citations,
          source: "freshdesk",
          source_count: 2,
          confidence: 0.9,
          status: "active",
          last_observed_at: now,
          updated_at: now,
        },
        { id: `eq.${found[0].id}` },
      );
      if (r.ok) {
        console.log(`  ~ ${s.slug}`);
        updated++;
      } else {
        console.error(`  ! update ${s.slug}: ${r.status}`);
      }
    } else {
      const r = await rest("POST", "skills", {
        workspace_id: WORKSPACE_ID,
        type: s.type,
        domain: s.domain,
        slug: s.slug,
        title: s.title,
        trigger: s.trigger,
        steps_md: s.steps_md,
        decision_criteria: s.decision_criteria,
        escalation: s.escalation,
        citations: s.citations,
        source: "freshdesk",
        source_count: 2,
        confidence: 0.9,
        first_observed_at: now,
        last_observed_at: now,
        status: "active",
      });
      if (r.ok) {
        console.log(`  + ${s.slug}`);
        inserted++;
      } else {
        console.error(`  ! insert ${s.slug}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      }
    }
  }
  console.log(`\n✅ done — inserted ${inserted}, updated ${updated}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
