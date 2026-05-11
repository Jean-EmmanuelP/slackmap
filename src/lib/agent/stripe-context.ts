// Stripe pre-fetch layer for the support co-pilot.
//
// When a ticket smells like billing/subscription/refund, AND the workspace has
// Stripe connected, AND the requester email maps to a Stripe customer, we
// pre-fetch:
//   - the customer record (delinquent? created when?)
//   - their active + recent subscriptions (status, period, cancel-at-period-end)
//   - their last few invoices (paid? open? failed? amounts?)
//
// The formatted block is injected into the drafting prompt under
// "## Stripe customer context" so Claude can cite real facts ("votre abonnement
// Pro est actif jusqu'au 12 juin, sans annulation programmée") instead of
// generic policy answers.
//
// This is the pragmatic alternative to native tool-use: pre-fetch a snapshot
// rather than let Claude loop on tool calls. Simpler, cheaper, predictable.
// Native tool-use is a v2 once we want Claude to also write actions
// (refund, cancel, retry) rather than just read.

import { StripeClient, StripeError } from "@/lib/stripe";
import type { FreshdeskTicket } from "@/lib/freshdesk";

const BILLING_KEYWORDS_FR = [
  "abonnement",
  "facture",
  "paiement",
  "prélèvement",
  "carte",
  "remboursement",
  "résili",
  "annul",
  "renouvel",
  "essai",
  "offre",
  "promo",
  "tarif",
];

const BILLING_KEYWORDS_EN = [
  "subscription",
  "invoice",
  "billing",
  "payment",
  "card",
  "refund",
  "cancel",
  "renew",
  "trial",
  "plan",
  "charge",
  "pricing",
];

const BILLING_KEYWORDS = [...BILLING_KEYWORDS_FR, ...BILLING_KEYWORDS_EN];

export function isBillingIntent(ticket: FreshdeskTicket): boolean {
  const text = `${ticket.subject ?? ""} ${ticket.description_text ?? ""}`.toLowerCase();
  return BILLING_KEYWORDS.some((kw) => text.includes(kw));
}

function unixToISO(s: number | null | undefined): string | null {
  if (!s || Number.isNaN(s)) return null;
  return new Date(s * 1000).toISOString().slice(0, 10);
}

function formatCents(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Try to fetch Stripe context for this ticket. Returns null when:
 *   - the ticket doesn't look billing-related
 *   - Stripe isn't connected
 *   - the requester email is missing
 *   - no Stripe customer matches the email (we return a hint string in that case so the agent can flag it)
 *
 * Never throws — Stripe errors are caught and converted to a hint string so
 * the cron keeps drafting on the rest of the ticket fields.
 */
export async function maybeFetchStripeContext(
  ticket: FreshdeskTicket,
  stripeEncryptedKey: string | null,
  decrypt: (encrypted: string) => string,
): Promise<string | null> {
  if (!stripeEncryptedKey) return null;
  if (!isBillingIntent(ticket)) return null;
  const email = ticket.requester?.email?.trim().toLowerCase();
  if (!email) return null;

  let stripe: StripeClient;
  try {
    stripe = new StripeClient(decrypt(stripeEncryptedKey));
  } catch {
    return null;
  }

  try {
    const customer = await stripe.getCustomerByEmail(email);
    if (!customer) {
      return `Requester email ${email} has NO matching Stripe customer. The customer may have signed up via a different email, may not yet be a paying customer, or may have been deleted. Do not promise refunds/cancellations without confirming the account first.`;
    }

    const [subs, invoices] = await Promise.all([
      stripe.listSubscriptions(customer.id).catch(() => []),
      stripe.listRecentInvoices(customer.id, 3).catch(() => []),
    ]);

    const subLines = subs.length === 0
      ? "  (no subscriptions on file)"
      : subs
          .map((s) => {
            const item = s.items.data[0];
            const price = item?.price;
            const amount = price?.unit_amount != null && price?.currency
              ? formatCents(price.unit_amount, price.currency)
              : "unknown";
            const interval = price?.recurring?.interval ?? "?";
            const periodEnd = unixToISO(s.current_period_end);
            const canceled = s.canceled_at ? `, CANCELED on ${unixToISO(s.canceled_at)}` : "";
            const willCancel = s.cancel_at_period_end ? `, WILL CANCEL at period end (${periodEnd})` : "";
            return `  - ${s.id}: status=${s.status}, ${amount}/${interval}, period ends ${periodEnd}${willCancel}${canceled}`;
          })
          .join("\n");

    const invLines = invoices.length === 0
      ? "  (no recent invoices)"
      : invoices
          .map((i) => {
            const date = unixToISO(i.created);
            const due = formatCents(i.amount_due, i.currency);
            const paid = formatCents(i.amount_paid, i.currency);
            const retry = i.next_payment_attempt
              ? `, next retry ${unixToISO(i.next_payment_attempt)}`
              : "";
            return `  - ${i.id} (${date}): status=${i.status}, due=${due}, paid=${paid}, attempts=${i.attempt_count}${retry}`;
          })
          .join("\n");

    return [
      `Stripe customer found for ${email}:`,
      `  id=${customer.id}`,
      `  name=${customer.name ?? "—"}`,
      `  delinquent=${customer.delinquent}`,
      `  signed up=${unixToISO(customer.created)}`,
      ``,
      `Subscriptions:`,
      subLines,
      ``,
      `Recent invoices:`,
      invLines,
      ``,
      `Use these facts to ground the draft. Do NOT invent amounts, dates, or status. If the customer asks about a specific charge/sub not listed here, flag it for human review.`,
    ].join("\n");
  } catch (e) {
    const msg = e instanceof StripeError ? e.message : (e as Error).message;
    return `Stripe lookup failed for ${email}: ${msg}. Draft without Stripe context — do NOT promise actions on the account.`;
  }
}
