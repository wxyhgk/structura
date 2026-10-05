import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { KEY_HINT } from "./check.ts"
import { askClaude, CLAUDE_MODEL, failure as claudeFailure } from "./claude.ts"
import { askOpenAI, failure as openaiFailure, OPENAI_MODEL } from "./openai.ts"
import { recognize, type NextAction } from "./structure/agent.ts"
import { claudeNext } from "./structure/claude.ts"
import { openaiNext } from "./structure/openai.ts"
import type { StructureRequest, StructureResult, StructureStep } from "./structure/types.ts"
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

export type Provider = {
  name: string
  model: string
  /** Variable definitions read from patent text (one call). */
  ask: (request: FillRequest) => Promise<FillResult>
  /** A structure rebuilt from a picture, step by step (an agent loop), each step reported. */
  recognize: (request: StructureRequest, onStep: (step: StructureStep) => void, signal?: AbortSignal) => Promise<StructureResult>
}

/** API errors in a turn, as the chemist should read them. */
const explained = (next: NextAction, explain: (error: unknown) => string): NextAction => async (turns) => {
  try {
    return await next(turns)
  } catch (error) {
    throw new Error(explain(error))
  }
}

/** Gateways get overloaded; a busy answer (429, 5xx) is tried again a few times before giving up. */
const RETRIES = 4

/** The provider the settings ask for; its client is made on first use. */
export function providerFrom(env: AiEnv): Provider | { error: string } {
  const choice = env.AI_PROVIDER?.trim().toLowerCase() || (env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY ? "openai" : "anthropic")
  if (choice === "openai") {
    const model = env.OPENAI_MODEL?.trim() || OPENAI_MODEL
    let client: OpenAI | null = null
    const connect = (): OpenAI | { error: string } => {
      try {
        client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY || undefined, baseURL: env.OPENAI_BASE_URL || undefined, maxRetries: RETRIES })
        return client
      } catch {
        // The SDK refuses to start without a key.
        return { error: `服务器上没有设置 OPENAI_API_KEY。${KEY_HINT}` }
      }
    }
    return {
      name: "openai",
      model,
      ask: async (request) => {
        const ready = connect()
        return "error" in ready ? { ok: false, error: ready.error } : askOpenAI(ready, request, model)
      },
      recognize: async (request, onStep, signal) => {
        const ready = connect()
        return "error" in ready ? { ok: false, error: ready.error } : recognize(request, explained(openaiNext(ready, model), openaiFailure), onStep, signal)
      },
    }
  }
  if (choice === "anthropic") {
    let client: Anthropic | null = null
    const connect = () => (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || undefined, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: RETRIES }))
    return {
      name: "anthropic",
      model: CLAUDE_MODEL,
      ask: (request) => askClaude(connect(), request),
      recognize: (request, onStep, signal) => recognize(request, explained(claudeNext(connect()), claudeFailure), onStep, signal),
    }
  }
  return { error: `AI_PROVIDER 只能是 anthropic 或 openai，不是 "${env.AI_PROVIDER}"` }
}
