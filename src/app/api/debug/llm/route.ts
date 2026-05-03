import { NextResponse } from "next/server";
import { llmCall, llmBackendInfo } from "@/lib/extract/llm";

export async function GET() {
  const backend = llmBackendInfo();
  try {
    const out = await llmCall({
      system: "You are a tester. Output only the word PONG and nothing else.",
      userMessage: "ping",
      maxTokens: 50,
      model: "extract",
    });
    return NextResponse.json({ backend, ok: true, output: out });
  } catch (e) {
    return NextResponse.json({
      backend,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
