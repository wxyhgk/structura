import type OpenAI from "openai"
import { failure, type Effort } from "./openai.ts"
import { SYSTEM_PROMPT, userMessage } from "./prompt.ts"
import { ANSWER_SCHEMA } from "./schema.ts"
import { firstObject } from "./structure/json.ts"
import type { FillAnswer, FillRequest, FillResult } from "./types.ts"

/**
 * askOpenAI for servers offering only Chat Completions (OPENAI_API=chat): the schema goes in
 * the prompt instead of being enforced, and the answer is streamed so a long think does not
 * time out.
 */
export async function askChat(client: OpenAI, request: FillRequest, model: string, effort?: Effort): Promise<FillResult> {
  try {
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      max_tokens: 32000,
      ...(effort ? { reasoning_effort: effort } : {}),
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nAnswer with only one JSON object matching this schema:\n${JSON.stringify(ANSWER_SCHEMA)}` },
        { role: "user", content: userMessage(request) },
      ],
    })
    let text = ""
    let finish: string | null = null
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? ""
      finish = chunk.choices[0]?.finish_reason ?? finish
    }
    if (finish === "length") return { ok: false, error: "回答太长被截断了，请分几段粘贴。" }
    try {
      return { ok: true, answer: firstObject(text) as FillAnswer }
    } catch {
      return { ok: false, error: `${model} 的回答不是有效的 JSON。` }
    }
  } catch (error) {
    return { ok: false, error: failure(error) }
  }
}
