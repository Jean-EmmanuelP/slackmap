// Stripe REST client + agent-callable tool surface. Built on Stripe's bare REST
// API (no SDK dependency — keeps the bundle thin) with just the operations
// the support co-pilot actually needs:
//
//   getCustomerByEmail   — resolve a Freshdesk requester email to a Stripe customer
//   listSubscriptions    — get the customer's subscriptions to answer billing questions
//   listRecentInvoices   — for "where's my invoice?" / "why was I charged?" tickets
//   processRefund        — issue a refund (with optional partial amount)
//   retryPayment         — retry a failed invoice (the "relance paiement" pattern)
//
// All methods throw a structured StripeError on failure so the agent runtime
// can surface a clear message in the draft.

const API_BASE = "https://api.stripe.com/v1";

export class StripeError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
}

export type StripeCustomer = {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  delinquent: boolean;
  metadata: Record<string, string>;
};

export type StripeSubscription = {
  id: string;
  status: string; // active, past_due, canceled, ...
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  items: { data: Array<{ price: { id: string; unit_amount: number | null; currency: string; recurring?: { interval: string } | null } }> };
};

export type StripeInvoice = {
  id: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  attempt_count: number;
  next_payment_attempt: number | null;
};

export type StripeRefund = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  charge: string;
};

export class StripeClient {
  constructor(private apiKey: string) {}

  private async request<T>(method: "GET" | "POST", path: string, body?: Record<string, string | number>): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: authHeader(this.apiKey),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    if (body) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) params.set(k, String(v));
      init.body = params.toString();
    }
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let parsed: { error?: { message?: string; code?: string } } = {};
      try { parsed = JSON.parse(text); } catch {}
      throw new StripeError(
        parsed.error?.message ?? `Stripe ${res.status}`,
        res.status,
        parsed.error?.code,
      );
    }
    return (await res.json()) as T;
  }

  /** Verify the key works + return the account info. */
  async ping(): Promise<{ id: string; livemode: boolean }> {
    const acct = await this.request<{ id: string; charges_enabled: boolean }>("GET", "/account");
    // sk_live_... vs sk_test_... — the prefix is the source of truth
    return { id: acct.id, livemode: this.apiKey.startsWith("sk_live_") };
  }

  async getCustomerByEmail(email: string): Promise<StripeCustomer | null> {
    const q = encodeURIComponent(`email:"${email.replace(/"/g, '\\"')}"`);
    const res = await this.request<{ data: StripeCustomer[] }>("GET", `/customers/search?query=${q}&limit=1`);
    return res.data[0] ?? null;
  }

  async listSubscriptions(customerId: string): Promise<StripeSubscription[]> {
    const res = await this.request<{ data: StripeSubscription[] }>(
      "GET",
      `/subscriptions?customer=${customerId}&status=all&limit=10`,
    );
    return res.data;
  }

  async listRecentInvoices(customerId: string, limit = 5): Promise<StripeInvoice[]> {
    const res = await this.request<{ data: StripeInvoice[] }>(
      "GET",
      `/invoices?customer=${customerId}&limit=${limit}`,
    );
    return res.data;
  }

  /** Cancel a subscription. Default: at period end so the customer keeps access until paid period ends. */
  async cancelSubscription(subscriptionId: string, opts: { immediately?: boolean } = {}): Promise<StripeSubscription> {
    if (opts.immediately) {
      return this.request<StripeSubscription>("POST", `/subscriptions/${subscriptionId}`, {
        cancel_at_period_end: "false",
      });
    }
    return this.request<StripeSubscription>("POST", `/subscriptions/${subscriptionId}`, {
      cancel_at_period_end: "true",
    });
  }

  /**
   * Refund a charge. If chargeId is the latest charge on a subscription, this
   * is the typical "rembourse-moi le dernier paiement" workflow.
   * amount in cents; omit for full refund.
   */
  async processRefund(chargeId: string, amountCents?: number): Promise<StripeRefund> {
    const body: Record<string, string | number> = { charge: chargeId };
    if (amountCents !== undefined) body.amount = amountCents;
    return this.request<StripeRefund>("POST", "/refunds", body);
  }

  /** Retry a failed invoice. The "relance paiement" pattern — Stripe re-attempts collection. */
  async retryInvoice(invoiceId: string): Promise<StripeInvoice> {
    return this.request<StripeInvoice>("POST", `/invoices/${invoiceId}/pay`);
  }
}

/**
 * Tool schema declarations the LLM can use via tool-calling. The agent picks
 * a tool name + arguments; the runtime executes via StripeClient and feeds
 * the result back into the prompt for the final draft.
 */
export const STRIPE_TOOL_DEFINITIONS = [
  {
    name: "stripe_get_customer_by_email",
    description: "Look up a Stripe customer by their email address. Returns null if not found.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Customer email address" },
      },
      required: ["email"],
    },
  },
  {
    name: "stripe_list_subscriptions",
    description: "List a customer's subscriptions (active, past_due, canceled, etc.). Use this for any billing/subscription question.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Stripe customer id (cus_...)" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "stripe_list_recent_invoices",
    description: "Get the customer's most recent invoices, including PDF/web URLs. Use for invoice copy / why-was-I-charged questions.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        limit: { type: "number", description: "Max invoices to return (default 5)" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "stripe_cancel_subscription",
    description:
      "Cancel a subscription. Default cancels at period end (customer keeps access until paid period ends). Use immediately=true only for refund-with-cancel cases.",
    input_schema: {
      type: "object",
      properties: {
        subscription_id: { type: "string" },
        immediately: { type: "boolean", description: "Cancel right now (default: at period end)" },
      },
      required: ["subscription_id"],
    },
  },
  {
    name: "stripe_process_refund",
    description: "Refund a charge. Omit amount_cents for a full refund. Use only after confirming the refund policy applies.",
    input_schema: {
      type: "object",
      properties: {
        charge_id: { type: "string" },
        amount_cents: { type: "number", description: "Optional partial refund amount in cents" },
      },
      required: ["charge_id"],
    },
  },
  {
    name: "stripe_retry_invoice",
    description: "Retry collection on a failed invoice (the 'relance paiement' pattern). Use when payment failed and customer wants to retry.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
      },
      required: ["invoice_id"],
    },
  },
];

export async function loadWorkspaceStripeKey(workspaceId: string): Promise<string | null> {
  const { db } = await import("@/lib/db");
  const { decrypt } = await import("@/lib/crypto");
  const { data } = await db()
    .from("workspaces")
    .select("encrypted_stripe_api_key")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!data?.encrypted_stripe_api_key) return null;
  try {
    return decrypt(data.encrypted_stripe_api_key as string);
  } catch {
    return null;
  }
}
