// LLM router: dispatch extraction calls to either the Anthropic API or the
// Claude Code CLI. Auto-detects backend by call-time options + env.
//
// Resolution order for the API key (when calling with `apiKey` opts):
//   1. opts.apiKey (set by callers that loaded a per-workspace key)
//   2. process.env.ANTHROPIC_API_KEY
//   3. fallback to `claude` CLI (uses your Claude Code OAuth session)

import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspaceAnthropicKey } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function loadWorkspaceApiKey(workspaceId: string): Promise<string | undefined> {
  try {
    const enc = await getWorkspaceAnthropicKey(workspaceId);
    if (!enc) return undefined;
    const plain = decrypt(enc);
    return plain.startsWith("sk-ant-") ? plain : undefined;
  } catch {
    return undefined;
  }
}

export type LlmCallOptions = {
  system: string;
  userMessage: string;
  maxTokens?: number;
  model?: "extract" | "classify";
  /** Per-workspace API key (decrypted from DB). Beats env. */
  apiKey?: string;
};

const MODEL_NAMES = {
  api: {
    extract: "claude-sonnet-4-6",
    classify: "claude-haiku-4-5-20251001",
  },
  cli: {
    extract: "sonnet",
    classify: "haiku",
  },
} as const;

function resolveApiKey(opts: LlmCallOptions): string | null {
  if (opts.apiKey && opts.apiKey.startsWith("sk-ant-")) return opts.apiKey;
  const envKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (envKey.startsWith("sk-ant-")) return envKey;
  return null;
}

function pickBackend(opts: LlmCallOptions): "api" | "cli" {
  if (process.env.LLM_BACKEND === "cli") return "cli";
  if (process.env.LLM_BACKEND === "api") return "api";
  return resolveApiKey(opts) ? "api" : "cli";
}

export async function llmCall(opts: LlmCallOptions): Promise<string> {
  const backend = pickBackend(opts);
  const modelKey = opts.model ?? "extract";
  const maxTokens = opts.maxTokens ?? 4096;

  if (backend === "api") {
    const key = resolveApiKey(opts);
    if (!key) throw new Error("API backend selected but no valid key found");
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL_NAMES.api[modelKey],
      max_tokens: maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.userMessage }],
    });
    for (const block of res.content) {
      if (block.type === "text") return block.text;
    }
    return "";
  }

  return await callClaudeCli({
    system: opts.system,
    userMessage: opts.userMessage,
    model: MODEL_NAMES.cli[modelKey],
  });
}

function callClaudeCli({
  system,
  userMessage,
  model,
}: {
  system: string;
  userMessage: string;
  model: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--model",
      model,
      "--output-format",
      "text",
      "--no-session-persistence",
      "--disable-slash-commands",
      "--append-system-prompt",
      system,
    ];

    // Pass through the parent env so the CLI can find OAuth credentials in
    // ~/.claude. Don't set CLAUDE_CODE_SIMPLE — that requires ANTHROPIC_API_KEY.
    const child = spawn("claude", args, { env: process.env });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude CLI timed out after 90s`));
    }, 90_000);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${stderr.slice(-500)}`));
        return;
      }
      resolve(stdout.trim());
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.stdin.write(userMessage);
    child.stdin.end();
  });
}

export function llmBackendInfo(opts: LlmCallOptions = { system: "", userMessage: "" }): {
  backend: "api" | "cli";
  reason: string;
} {
  const backend = pickBackend(opts);
  if (backend === "api") {
    const key = resolveApiKey(opts);
    return {
      backend: "api",
      reason: opts.apiKey ? "per-workspace API key" : key ? "ANTHROPIC_API_KEY env" : "??",
    };
  }
  return {
    backend: "cli",
    reason: process.env.LLM_BACKEND === "cli" ? "LLM_BACKEND=cli" : "no API key, falling back to claude CLI",
  };
}
