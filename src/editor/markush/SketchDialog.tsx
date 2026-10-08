import { useCallback, useState } from "react"
import type { Molecule } from "@structura/core/types"
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
  linker,
  initial,
  onSave,
  onClose,
}: {
  name: string
  linker: boolean
  initial?: Molecule
  onSave: (piece: Molecule) => void
  onClose: () => void
}) {
  const overlayMark = useOverlayMark()
  const [mol, setMol] = useState<Molecule | null>(initial ?? null)
  const [problem, setProblem] = useState<string | null>(null)
  const change = useCallback((next: Molecule) => {
    setMol(next)
    setProblem(null)
  }, [])

  function save() {
    if (!mol) return
    const result = sketchedPiece(mol, { linker })
    if ("problem" in result) setProblem(result.problem)
    else onSave(result.piece)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent {...overlayMark} className="sm:max-w-2xl" data-testid="sketch-dialog">
        <DialogHeader>
          <DialogTitle>{initial ? `修改 ${name} 的候选项` : `给 ${name} 画一个候选项`}</DialogTitle>
          <DialogDescription>
            {linker
              ? "画出连接基，点“连接点 *”后再点两端的原子，标出接到通式上的两个位置。"
              : "画出这个基团。默认从第一个画的原子接到通式上；要换位置，点“连接点 *”再点那个原子（再点 * 去掉；环里的原子点两次标两个）。"}
          </DialogDescription>
        </DialogHeader>
        <SketchPad initial={initial} onChange={change} />
        {problem && <p className="text-xs text-[#b26a00]">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!mol || mol.atoms.length === 0}>
            {initial ? "保存" : `添加到 ${name}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
