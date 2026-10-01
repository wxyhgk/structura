import { useRef, useState } from "react"
import { requestFor, reviewAnswer, type FillRequest, type FillResult, type Review } from "@structura/ai"
import type { Drawing } from "@structura/core/types"
import { failure } from "@/editor/browser"

/** How the host reaches Claude: the editor hands it the request and checks what comes back. */
export type FillVariables = (request: FillRequest) => Promise<FillResult>

export type Fill = {
  status: "idle" | "reading" | "done" | "failed"
  review: Review | null
  error: string | null
  /** Sends `text` with the drawing's variables; a newer call makes an older answer moot. */
  read: (drawing: Drawing, text: string) => Promise<void>
}

/** One request at a time, through the host's `fill`, checked by reviewAnswer when it arrives. */
export function useFill(fill: FillVariables): Fill {
  const [state, setState] = useState<Omit<Fill, "read">>({ status: "idle", review: null, error: null })
  const latest = useRef(0)

  async function read(drawing: Drawing, text: string) {
    const id = ++latest.current
    setState({ status: "reading", review: null, error: null })
    const request = requestFor(drawing, text)
    let result: FillResult
    try {
      result = await fill(request)
    } catch (error) {
      result = { ok: false, error: `请求失败：${failure(error)}` }
    }
    if (id !== latest.current) return
    if (!result.ok) setState({ status: "failed", review: null, error: result.error })
    else setState({ status: "done", review: reviewAnswer(result.answer, request), error: null })
  }

  return { ...state, read }
}
