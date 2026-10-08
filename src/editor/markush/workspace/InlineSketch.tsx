import { useCallback, useState, type KeyboardEvent } from "react"
import type { Molecule } from "@structura/core/types"
import type { SiteKind } from "@structura/markush"
import { sketchedPiece } from "@structura/engine"
import { Button } from "@/components/ui/button"
import { SketchPad } from "../SketchPad.tsx"
import { PaneHeader } from "./PaneHeader.tsx"

/**
 * The sketch pad taking over the variables pane: drawing a new alternative, or changing a
 * drawn one (`initial`), with the whole height to draw in. Nothing reaches the drawing until
 * 添加 / 保存 hands the piece back; 返回 or Escape leaves it.
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
  const [drawn, setDrawn] = useState<{ mol: Molecule; sites: number[] } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const change = useCallback((mol: Molecule, sites: number[]) => {
    setDrawn({ mol, sites })
    setProblem(null)
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
    <div className="flex h-full min-h-0 flex-col text-[12px]" onKeyDown={keepKeys} onKeyUp={(event) => event.stopPropagation()} data-testid="inline-sketch">
      <PaneHeader title={initial ? `修改 ${name} 的候选项` : `给 ${name} 画一个候选项`}>
        <button className="order-first -ml-1 rounded-sm px-1.5 py-0.5 text-[#1a73e8] hover:bg-[#eef3fb]" onClick={onCancel} title="返回变量（Esc）">
          ← 返回
        </button>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" onClick={save} disabled={!drawn || drawn.mol.atoms.length === 0}>
            {initial ? "保存" : `添加到 ${name}`}
          </Button>
        </span>
      </PaneHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {problem && <p className="rounded-sm bg-[#fff4d6] px-2 py-1 text-[#8a5a00]">{problem}</p>}
        <SketchPad initial={initial} kind={kind} onChange={change} fill />
      </div>
    </div>
  )
}
