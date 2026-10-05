import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { askChat } from "./chat.ts"
import { KEY_HINT } from "./check.ts"
import { askClaude, CLAUDE_MODEL, failure as claudeFailure } from "./claude.ts"
import { askOpenAI, failure as openaiFailure, OPENAI_MODEL, type Effort } from "./openai.ts"
import { recognize, type Ask } from "./structure/agent.ts"
import { chatAsk } from "./structure/chat.ts"
import { claudeAsk } from "./structure/claude.ts"
import { openaiAsk } from "./structure/openai.ts"
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
  /** low, medium or high: how hard a reasoning model thinks. Left out: high for filling, medium for pictures. */
  OPENAI_REASONING_EFFORT?: string
  /** "responses" (the default) or "chat", for servers offering only Chat Completions. */
  OPENAI_API?: string
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
const explained = (ask: Ask, explain: (error: unknown) => string): Ask => async (turns, format) => {
  try {
    return await ask(turns, format)
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
    const asked = env.OPENAI_REASONING_EFFORT?.trim().toLowerCase()
    const effort = asked === "low" || asked === "medium" || asked === "high" ? (asked as Effort) : undefined
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
        return "error" in ready ? { ok: false, error: ready.error } : (env.OPENAI_API?.trim().toLowerCase() === "chat" ? askChat : askOpenAI)(ready, request, model, effort ?? "high")
      },
      recognize: async (request, onStep, signal) => {
        const ready = connect()
        return "error" in ready ? { ok: false, error: ready.error } : recognize(request, explained((env.OPENAI_API?.trim().toLowerCase() === "chat" ? chatAsk : openaiAsk)(ready, model, effort ?? "medium"), openaiFailure), onStep, signal)
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
      recognize: (request, onStep, signal) => recognize(request, explained(claudeAsk(connect()), claudeFailure), onStep, signal),
    }
  }
  return { error: `AI_PROVIDER 只能是 anthropic 或 openai，不是 "${env.AI_PROVIDER}"` }
}
