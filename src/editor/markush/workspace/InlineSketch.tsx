import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import type { Molecule } from "@structura/core/types"
import type { SiteKind } from "@structura/markush"
import { sketchedPiece } from "@structura/engine"
import { Button } from "@/components/ui/button"
import { SketchPad } from "../SketchPad.tsx"

/**
 * The sketch pad opened inside a variable's card: drawing a new alternative, or changing a
 * drawn one (`initial`). Nothing reaches the drawing until 添加 / 保存 hands the piece back.
 */
export function InlineSketch({
  name,
  kind,
  initial,
  onSave,
  onCancel,
}: {
  name: string
  /** Where the variable sits, which says how many sites the piece takes. */
  kind: SiteKind
  initial?: { molecule: Molecule; alsoAt?: number[] }
  onSave: (piece: Molecule, alsoAt: number[]) => void
  onCancel: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState<{ mol: Molecule; sites: number[] } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const change = useCallback((mol: Molecule, sites: number[]) => {
    setDrawn({ mol, sites })
    setProblem(null)
  }, [])

  // Bring the opened pad into view within the board (the canvas view is not touched).
  useEffect(() => {
    boxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [])

  function save() {
    if (!drawn) return
    const result = sketchedPiece(drawn.mol, drawn.sites, kind)
    if ("problem" in result) setProblem(result.problem)
    else onSave(result.piece, result.alsoAt)
  }

  /** Keys typed in the pad are the pad's: none reaches the formula's canvas. Escape closes it. */
  function keepKeys(event: KeyboardEvent) {
    event.stopPropagation()
    if (event.key === "Escape") onCancel()
  }

  return (
    <div ref={boxRef} className="rounded-md border border-[#cfe0f6] bg-[#f8fbff] p-3" onKeyDown={keepKeys} onKeyUp={(event) => event.stopPropagation()} data-testid="inline-sketch">
      <div className="mb-1 text-[13px] font-medium text-[#333]">{initial ? `修改 ${name} 的候选项` : `给 ${name} 画一个候选项`}</div>
      <p className="mb-2 text-[#666]">画出结构，再用“◎ 设位点”点原子，标出它接到通式上的位置（蓝圈，可以设多个）。不用画 *。</p>
      <SketchPad initial={initial} kind={kind} onChange={change} />
      {problem && <p className="mt-1.5 text-[#b26a00]">{problem}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button size="sm" onClick={save} disabled={!drawn || drawn.mol.atoms.length === 0}>
          {initial ? "保存" : `添加到 ${name}`}
        </Button>
      </div>
    </div>
  )
}
