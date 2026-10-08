import { useState } from "react"
import { alternativesFromText } from "@structura/markush"
import type { RingClosure, Variable } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { Button } from "@/components/ui/button"
import { closureText } from "./describe.ts"

const FIELD = "h-6 rounded-sm border border-[#d0d0d0] bg-white px-1 text-[12px] outline-none focus:border-[#1a73e8]"

/**
 * "R1 and R2, together with the atoms they are attached to, form a ring": which pairs may
 * close, and into what rings, written the way a claim writes them ((CH2)3-4, OCH2O, CH=CHCH=CH).
 */
export function ClosuresSection({ closures, variables, run, heading = true }: { closures: RingClosure[] | undefined; variables: Record<string, Variable> | undefined; run: Run; /** Whether to show its own grey heading (off where a tab already names it). */ heading?: boolean }) {
  const names = Object.keys(variables ?? {})
  const [open, setOpen] = useState(false)
  const [a, setA] = useState(names[0] ?? "")
  const [b, setB] = useState(names[1] ?? "")
  const [text, setText] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  if (names.length < 2) return null

  function add() {
    const { add: typed, rejected } = alternativesFromText(text)
    const rings = typed.filter((item) => item.kind === "fragment")
    if (rejected.length > 0 || rings.length !== typed.length || rings.length === 0) return setProblem(`看不懂：${[...rejected, ...typed.filter((item) => item.kind !== "fragment").map(() => "单个原子")].join("、") || "没有环"}。写法如 (CH2)3-4、OCH2O、CH=CHCH=CH`)
    if (!run([{ op: "set_ring_closure", closure: { a, b, ring: rings } }], { keepSelection: true })) return setProblem("这条成环用不了")
    setProblem(null)
    setOpen(false)
    setText("")
  }

  return (
    <div data-testid="closures">
      {heading && <div className="border-b border-[#e0e0e0] bg-[#f0f0f0] px-3 py-1 text-[11px] text-[#777]">成环</div>}
      <div className="space-y-1 px-3 py-2">
        {(closures ?? []).map((closure) => (
          <div key={`${closure.a}+${closure.b}`} className="flex items-start gap-1 text-[12px] text-[#333]" data-testid="closure">
            <span className="flex-1">{closureText(closure)}</span>
            <button
              type="button"
              className="text-[#999] hover:text-[#d1242f]"
              aria-label="删除这条成环"
              onClick={() => run([{ op: "remove_ring_closure", a: closure.a, b: closure.b }], { keepSelection: true })}
            >
              ×
            </button>
          </div>
        ))}
        {!open ? (
          <button type="button" className="text-[11px] text-[#1a73e8] hover:underline" onClick={() => setOpen(true)}>
            + 两个变量可以一起成环
          </button>
        ) : (
          <div className="space-y-1.5 rounded-sm border border-[#e0e0e0] bg-white p-2 text-[12px]">
            <div className="flex items-center gap-1">
              <select className={FIELD} value={a} onChange={(event) => setA(event.target.value)} aria-label="成环的第一个变量">
                {names.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <span className="text-[#888]">与</span>
              <select className={FIELD} value={b} onChange={(event) => setB(event.target.value)} aria-label="成环的第二个变量">
                {names.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <span className="text-[#888]">一起成</span>
            </div>
            <input
              className={`${FIELD} w-full`}
              placeholder="(CH2)3-4, OCH2O, CH=CHCH=CH"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && add()}
              aria-label="能成的环"
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" className="h-6" disabled={!text.trim() || a === b} onClick={add}>
                添加
              </Button>
              <Button size="sm" variant="ghost" className="h-6" onClick={() => setOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        )}
        {problem && <p className="text-[11px] text-[#d1242f]">{problem}</p>}
      </div>
    </div>
  )
}
