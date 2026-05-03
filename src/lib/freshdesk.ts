// Freshdesk REST client. Auth = Basic with API key as username (password = "X").
// Docs: https://developers.freshdesk.com/api/

export type FreshdeskTicket = {
  id: number;
  subject: string;
  description_text: string | null;
  status: number;
  priority: number;
  type: string | null;
  source: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type FreshdeskConversation = {
  id: number;
  body_text: string | null;
  from_email: string | null;
  user_id: number | null;
  private: boolean;
  incoming: boolean;
  created_at: string;
};

export type FreshdeskSolutionArticle = {
  id: number;
  title: string;
  description_text: string | null;
  status: number;
  category_id: number;
  folder_id: number;
  tags: string[];
  hits: number;
  thumbs_up: number;
  thumbs_down: number;
  created_at: string;
  updated_at: string;
};

export type FreshdeskCategory = { id: number; name: string };
export type FreshdeskFolder = { id: number; name: string; category_id: number };

export type FreshdeskAgent = {
  id: number;
  available: boolean;
  occasional: boolean;
  signature: string | null;
  ticket_scope: number;
  type: string | null;
  group_ids: number[];
  role_ids: number[];
  skill_ids: number[];
  contact: {
    active: boolean;
    email: string | null;
    job_title: string | null;
    name: string | null;
    avatar?: { avatar_url?: string | null } | null;
  };
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:X`).toString("base64");
}

function normalizeDomain(domain: string): string {
  let d = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d.includes(".")) d = `${d}.freshdesk.com`;
  return d;
}

export class FreshdeskClient {
  constructor(
    private domain: string,
    private apiKey: string,
  ) {
    this.domain = normalizeDomain(domain);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`https://${this.domain}${path}`, {
      headers: {
        Authorization: authHeader(this.apiKey),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Freshdesk ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async ping(): Promise<{ ok: true; agentEmail?: string }> {
    const me = await this.get<{ contact?: { email?: string } }>("/api/v2/agents/me");
    return { ok: true, agentEmail: me.contact?.email };
  }

  async listSolutionCategories(): Promise<FreshdeskCategory[]> {
    return this.get<FreshdeskCategory[]>("/api/v2/solutions/categories");
  }

  async listFoldersForCategory(categoryId: number): Promise<FreshdeskFolder[]> {
    return this.get<FreshdeskFolder[]>(`/api/v2/solutions/categories/${categoryId}/folders`);
  }

  async listArticlesInFolder(folderId: number): Promise<FreshdeskSolutionArticle[]> {
    return this.get<FreshdeskSolutionArticle[]>(`/api/v2/solutions/folders/${folderId}/articles`);
  }

  async listRecentTickets(opts: { perPage?: number; pages?: number } = {}): Promise<FreshdeskTicket[]> {
    const perPage = opts.perPage ?? 100;
    const pages = opts.pages ?? 1;
    const out: FreshdeskTicket[] = [];
    for (let page = 1; page <= pages; page++) {
      const batch = await this.get<FreshdeskTicket[]>(
        `/api/v2/tickets?per_page=${perPage}&page=${page}&order_by=updated_at&order_type=desc&include=description`,
      );
      out.push(...batch);
      if (batch.length < perPage) break;
    }
    return out;
  }

  async getTicketConversations(ticketId: number): Promise<FreshdeskConversation[]> {
    return this.get<FreshdeskConversation[]>(`/api/v2/tickets/${ticketId}/conversations`);
  }

  async listAgents(opts: { perPage?: number; pages?: number } = {}): Promise<FreshdeskAgent[]> {
    const perPage = opts.perPage ?? 100;
    const pages = opts.pages ?? 2;
    const out: FreshdeskAgent[] = [];
    for (let page = 1; page <= pages; page++) {
      const batch = await this.get<FreshdeskAgent[]>(
        `/api/v2/agents?per_page=${perPage}&page=${page}`,
      );
      out.push(...batch);
      if (batch.length < perPage) break;
    }
    return out;
  }

  async listTicketsUpdatedSince(
    sinceIso: string,
    opts: { perPage?: number; pages?: number } = {},
  ): Promise<FreshdeskTicket[]> {
    const perPage = opts.perPage ?? 100;
    const pages = opts.pages ?? 3;
    const out: FreshdeskTicket[] = [];
    for (let page = 1; page <= pages; page++) {
      const batch = await this.get<FreshdeskTicket[]>(
        `/api/v2/tickets?per_page=${perPage}&page=${page}&order_by=updated_at&order_type=desc&updated_since=${encodeURIComponent(
          sinceIso,
        )}`,
      );
      out.push(...batch);
      if (batch.length < perPage) break;
    }
    return out;
  }

  ticketUrl(ticketId: number): string {
    return `https://${this.domain}/a/tickets/${ticketId}`;
  }

  articleUrl(articleId: number): string {
    return `https://${this.domain}/support/solutions/articles/${articleId}`;
  }

  get host(): string {
    return this.domain;
  }
}
