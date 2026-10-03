import { useEffect, useMemo, useState } from "react"
import { stepPictures } from "../figures/marks.ts"
import type { PanelSketch, TutorialStep } from "../types.ts"
import { WithKeys } from "./parts.tsx"

/** How long each step stays on screen while playing. */
const PLAY_MS = 2600

function Panel({ sketch }: { sketch: PanelSketch }) {
  return (
    <div className="w-44 shrink-0 self-center rounded-sm border border-[#d0d0d0] bg-[#f7f7f7] p-2 text-[11px]">
      <div className="mb-1 text-[10px] text-[#888]">通式变量</div>
      <div className="mb-1 font-[Arial,Helvetica,sans-serif] text-[13px] font-semibold">{sketch.name}</div>
      <div className="flex flex-wrap gap-1">
        {sketch.chips.map((chip) => (
          <span key={chip} className="rounded-sm border border-[#d0d0d0] bg-white px-1.5 py-0.5">
            {chip}
          </span>
        ))}
      </div>
      {sketch.note && <div className="mt-1 text-[#1a73e8]">{sketch.note}</div>}
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
  const button = "rounded-sm border border-[#d0d0d0] bg-white px-2 py-0.5 hover:bg-[#f0f0f0] disabled:text-[#bbb] disabled:hover:bg-white"
  return (
    <section className="mb-4 rounded-sm border border-[#d8e6f7] bg-[#f8fbff]" data-testid="tutorial">
      <header className="flex items-center gap-2 border-b border-[#d8e6f7] px-3 py-1.5">
        <span className="font-semibold text-[#1a4f8f]">跟着做：{title}</span>
        <span className="ml-auto text-[11px] text-[#5b7fa8]">
          第 {at + 1} / {steps.length} 步
        </span>
      </header>
      <div className="flex min-h-48 items-stretch gap-3 px-3 py-2">
        <div className="flex flex-1 items-center justify-center rounded-sm bg-white">
          <img src={pictures[at]} alt="" className="max-h-56 max-w-full object-contain" data-testid="tutorial-picture" />
        </div>
        {step.panel && <Panel sketch={step.panel} />}
      </div>
      <p className="min-h-10 px-3 pb-2 leading-relaxed" data-testid="tutorial-text">
        <span className="mr-1 inline-flex size-5 items-center justify-center rounded-full bg-[#1a73e8] text-[11px] font-semibold text-white">{at + 1}</span>
        <WithKeys text={step.text} />
      </p>
      <footer className="flex items-center gap-1.5 border-t border-[#d8e6f7] px-3 py-1.5 text-[12px]">
        <button className={button} disabled={at === 0} onClick={() => setAt(at - 1)}>
          上一步
        </button>
        <button className={button} disabled={at === last} onClick={() => setAt(at + 1)}>
          下一步
        </button>
        <button
          className={button}
          onClick={() => {
            if (at === last) setAt(0)
            setPlaying(!playing)
          }}
        >
          {playing ? "暂停" : at === last ? "从头播放" : "自动播放"}
        </button>
        <div className="ml-auto flex gap-1">
          {steps.map((_, index) => (
            <button
              key={index}
              className={`size-2 rounded-full ${index === at ? "bg-[#1a73e8]" : "bg-[#c5d7ee] hover:bg-[#8fb4e3]"}`}
              onClick={() => setAt(index)}
              aria-label={`第 ${index + 1} 步`}
            />
          ))}
        </div>
      </footer>
    </section>
  )
}
