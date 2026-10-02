import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { askClaude, CLAUDE_MODEL } from "./claude.ts"
import { askOpenAI, OPENAI_MODEL } from "./openai.ts"
import { KEY_HINT } from "./check.ts"
import type { FillRequest, FillResult } from "./types.ts"

/**
 * Where the server's settings come from: environment variables, or .env.local through
 * Vite's loadEnv. AI_PROVIDER picks "anthropic" or "openai"; left out, OpenAI is used when
 * only OPENAI_API_KEY is set, Claude otherwise.
 */
export type AiEnv = {
  AI_PROVIDER?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_BASE_URL?: string
  OPENAI_API_KEY?: string
  /** Any server speaking the OpenAI Responses API. */
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
}

export type Provider = { name: string; model: string; ask: (request: FillRequest) => Promise<FillResult> }

/** The provider the settings ask for; its client is made on first use. */
export function providerFrom(env: AiEnv): Provider | { error: string } {
  const choice = env.AI_PROVIDER?.trim().toLowerCase() || (env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY ? "openai" : "anthropic")
  if (choice === "openai") {
    const model = env.OPENAI_MODEL?.trim() || OPENAI_MODEL
    let client: OpenAI | null = null
    return {
      name: "openai",
      model,
      ask: async (request) => {
        try {
          client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY || undefined, baseURL: env.OPENAI_BASE_URL || undefined })
        } catch {
          // The SDK refuses to start without a key.
          return { ok: false, error: `服务器上没有设置 OPENAI_API_KEY。${KEY_HINT}` }
        }
        return askOpenAI(client, request, model)
      },
    }
  }
  if (choice === "anthropic") {
    let client: Anthropic | null = null
    return {
      name: "anthropic",
      model: CLAUDE_MODEL,
      ask: (request) => askClaude((client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || undefined, baseURL: env.ANTHROPIC_BASE_URL || undefined })), request),
    }
  }
  return { error: `AI_PROVIDER 只能是 anthropic 或 openai，不是 "${env.AI_PROVIDER}"` }
}
