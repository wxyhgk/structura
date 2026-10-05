import { useRef, useState } from "react"
import type { StructureEvent, StructureRequest, StructureResult, StructureStep } from "@structura/ai"

/** How the host reaches the model: it sends the request and hands each event back as it comes. */
export type RecognizeStructure = (request: StructureRequest, onEvent: (event: StructureEvent) => void, signal: AbortSignal) => Promise<void>

export type Recognition = {
  status: "idle" | "running" | "done" | "failed" | "stopped"
  steps: StructureStep[]
  result: StructureResult | null
  /** Seconds since it started, while it runs. */
  started: number | null
  start: (request: StructureRequest) => void
  stop: () => void
}

/** One recognition at a time: steps arrive as they happen; stopping aborts the request (the server stops too). */
export function useRecognition(recognize: RecognizeStructure): Recognition {
  const [state, setState] = useState<Omit<Recognition, "start" | "stop">>({ status: "idle", steps: [], result: null, started: null })
  const running = useRef<AbortController | null>(null)

  function start(request: StructureRequest) {
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    setState({ status: "running", steps: [], result: null, started: Date.now() })
    const live = () => running.current === controller
    recognize(
      request,
      (event) => {
        if (!live()) return
        if (event.type === "step") setState((now) => ({ ...now, steps: [...now.steps, event.step] }))
        else setState((now) => ({ ...now, result: event.result, status: event.result.ok ? "done" : "failed", started: null }))
      },
      controller.signal,
    ).catch((error: unknown) => {
      if (!live()) return
      const stopped = controller.signal.aborted
      setState((now) => ({ ...now, status: stopped ? "stopped" : "failed", started: null, result: stopped ? now.result : { ok: false, error: error instanceof Error ? error.message : String(error) } }))
    })
  }

  function stop() {
    running.current?.abort()
    setState((now) => ({ ...now, status: "stopped", started: null }))
  }

  return { ...state, start, stop }
}
