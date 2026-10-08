import { useCallback, useState } from "react"
import type { Molecule } from "@structura/core/types"
import type { SiteKind } from "@structura/markush"
import { sketchedPiece } from "@structura/engine"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useOverlayMark } from "@/editor/input/overlays"
import { SketchPad } from "./SketchPad.tsx"

/**
 * Drawing one alternative of a variable in a pad of its own, instead of building it from
 * classes and labels. `initial` opens a drawn alternative for changing; nothing reaches the
 * drawing until 添加 / 保存, which hands the finished piece back.
 */
export function SketchDialog({
  name,
  kind,
  initial,
  onSave,
  onClose,
}: {
  name: string
  /** Where the variable sits, which says how many sites the piece takes. */
  kind: SiteKind
  initial?: Molecule
  onSave: (piece: Molecule) => void
  onClose: () => void
}) {
  const overlayMark = useOverlayMark()
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
    else onSave(result.piece)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent {...overlayMark} className="sm:max-w-3xl" data-testid="sketch-dialog">
        <DialogHeader>
          <DialogTitle>{initial ? `修改 ${name} 的候选项` : `给 ${name} 画一个候选项`}</DialogTitle>
          <DialogDescription>画出结构，再用“◎ 设位点”点原子，标出它接到通式上的位置（蓝圈）。不用画 *。</DialogDescription>
        </DialogHeader>
        <SketchPad initial={initial} kind={kind} onChange={change} />
        {problem && <p className="text-xs text-[#b26a00]">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!drawn || drawn.mol.atoms.length === 0}>
            {initial ? "保存" : `添加到 ${name}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
