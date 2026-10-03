import { useEffect, useMemo, useState } from "react"
import { stepPictures } from "../figures/marks.ts"
import type { PanelSketch, TutorialStep } from "../types.ts"
import { WithKeys } from "./parts.tsx"

/** How long each step stays on screen while playing. */
const PLAY_MS = 2600

function Panel({ sketch }: { sketch: PanelSketch }) {
  return (
    <div className="w-44 shrink-0 self-center rounded-xl bg-white p-3 text-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="mb-1.5 text-[11px] font-medium text-[#8e8e93]">通式变量</div>
      <div className="mb-1.5 text-[14px] font-semibold">{sketch.name}</div>
      <div className="flex flex-wrap gap-1">
        {sketch.chips.map((chip) => (
          <span key={chip} className="rounded-md bg-[#f2f2f7] px-1.5 py-0.5">
            {chip}
          </span>
        ))}
      </div>
      {sketch.note && <div className="mt-1 text-[#8e8e93]">{sketch.note}</div>}
    </div>
  )
}

/**
 * A walk-through, one step at a time: what to do, and the drawing with the pointer, keys and
 * selections marked. Steps share one frame, so only what the step changes moves.
 */
export function Tutorial({ title, steps }: { title: string; steps: TutorialStep[] }) {
  const pictures = useMemo(() => stepPictures(steps).map((svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), [steps])
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const last = steps.length - 1

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => (at < last ? setAt(at + 1) : setPlaying(false)), PLAY_MS)
    return () => clearTimeout(timer)
  }, [playing, at, last])

  const step = steps[at]
  const round = "flex size-8 items-center justify-center rounded-full bg-white text-[18px] leading-none text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-[#fafafa] disabled:text-[#c7c7cc] disabled:shadow-none"
  return (
    <section className="mb-8 rounded-2xl bg-[#f5f5f7] px-6 pt-5 pb-4" data-testid="tutorial">
      <header className="flex items-baseline gap-2">
        <span className="text-[12px] font-medium text-[#8e8e93]">演示</span>
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="ml-auto text-[12px] text-[#8e8e93] tabular-nums">
          {at + 1} / {steps.length}
        </span>
      </header>
      <div className="flex min-h-56 items-center justify-center gap-6 py-4">
        <img src={pictures[at]} alt="" className="max-h-60 max-w-full object-contain" data-testid="tutorial-picture" />
        {step.panel && <Panel sketch={step.panel} />}
      </div>
      <p className="mx-auto min-h-14 max-w-[520px] text-center text-[15px] leading-7" data-testid="tutorial-text">
        <WithKeys text={step.text} />
      </p>
      <footer className="mt-2 flex items-center gap-2">
        <button className={round} disabled={at === 0} onClick={() => setAt(at - 1)} aria-label="上一步">
          ‹
        </button>
        <button className={round} disabled={at === last} onClick={() => setAt(at + 1)} aria-label="下一步">
          ›
        </button>
        <div className="mx-auto flex gap-1.5">
          {steps.map((_, index) => (
            <button
              key={index}
              className={`h-1.5 rounded-full transition-all ${index === at ? "w-4 bg-[#1d1d1f]" : "w-1.5 bg-[#c7c7cc] hover:bg-[#8e8e93]"}`}
              onClick={() => setAt(index)}
              aria-label={`第 ${index + 1} 步`}
            />
          ))}
        </div>
        <button
          className="rounded-full bg-white px-3 py-1 text-[12px] text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-[#fafafa]"
          onClick={() => {
            if (at === last) setAt(0)
            setPlaying(!playing)
          }}
        >
          {playing ? "暂停" : at === last ? "从头播放" : "自动播放"}
        </button>
      </footer>
    </section>
  )
}
