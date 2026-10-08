import { useCallback, useState, type KeyboardEvent } from "react"
import type { Molecule } from "@structura/core/types"
import type { SiteKind } from "@structura/markush"
import { sketchedPiece } from "@structura/engine"
import { Button } from "../../../components/ui/button.tsx"
import { SaveTemplateForm } from "../../templates/SaveTemplateForm.tsx"
import type { Templates } from "../../templates/useTemplates.ts"
import { SketchPad } from "../SketchPad.tsx"
import { PaneHeader } from "./PaneHeader.tsx"

type Piece = { molecule: Molecule; alsoAt: number[] }

/**
 * The sketch pad taking over the variables pane: drawing a new alternative, or changing a
 * drawn one (`initial`), with the whole height to draw in. Nothing reaches the drawing until
 * 添加 / 保存 hands the piece back; 返回 or Escape leaves it. With `templates`, 存为模板…
 * keeps the piece, with its sites, as one of the user's templates (the pad stays open).
 */
export function InlineSketch({
  name,
  kind,
  initial,
  title,
  saveLabel,
  templates,
  onSave,
  onCancel,
}: {
  name: string
  /** Where the variable sits, which says how many sites the piece takes. */
  kind: SiteKind
  initial?: { molecule: Molecule; alsoAt?: number[] }
  /** The header, when not drawing for a variable (changing a template). */
  title?: string
  /** The save button, likewise. */
  saveLabel?: string
  /** The library 存为模板… saves into; without it the button is not shown. */
  templates?: Templates
  /** Takes the piece; a promise that fails keeps the pad open with the reason. */
  onSave: (piece: Molecule, alsoAt: number[]) => void | Promise<void>
  onCancel: () => void
}) {
  const [drawn, setDrawn] = useState<{ mol: Molecule; sites: number[] } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  /** The piece being saved as a template, while its form is open. */
  const [keeping, setKeeping] = useState<Piece | null>(null)
  /** What saving it as a template did, until the next try. */
  const [kept, setKept] = useState<string | null>(null)
  const change = useCallback((mol: Molecule, sites: number[]) => {
    setDrawn({ mol, sites })
    setProblem(null)
  }, [])
  const empty = !drawn || drawn.mol.atoms.length === 0

  /** The piece as drawn, with its sites; null (and the reason shown) when it will not do. */
  function piece(): Piece | null {
    if (!drawn) return null
    const result = sketchedPiece(drawn.mol, drawn.sites, kind)
    if ("problem" in result) {
      setProblem(result.problem)
      return null
    }
    return { molecule: result.piece, alsoAt: result.alsoAt }
  }

  async function save() {
    const done = piece()
    if (!done) return
    try {
      await onSave(done.molecule, done.alsoAt)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    }
  }

  function keep() {
    const done = piece()
    if (!done) return
    setKept(null)
    setKeeping(done)
  }

  /** Keys typed in the pad are the pad's: none reaches the formula's canvas. Escape closes it. */
  function keepKeys(event: KeyboardEvent) {
    event.stopPropagation()
    if (event.key === "Escape") onCancel()
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-[12px]" onKeyDown={keepKeys} onKeyUp={(event) => event.stopPropagation()} data-testid="inline-sketch">
      <PaneHeader title={title ?? (initial ? `修改 ${name} 的候选项` : `给 ${name} 画一个候选项`)}>
        <button className="order-first -ml-1 rounded-sm px-1.5 py-0.5 text-[#1a73e8] hover:bg-[#eef3fb]" onClick={onCancel} title="返回（Esc）">
          ← 返回
        </button>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            取消
          </Button>
          {templates && (
            <Button size="sm" variant="outline" onClick={keep} disabled={empty} title="把画的结构连同位点存进模板库，以后在别的变量里一键添加">
              存为模板…
            </Button>
          )}
          <Button size="sm" onClick={() => void save()} disabled={empty}>
            {saveLabel ?? (initial ? "保存" : `添加到 ${name}`)}
          </Button>
        </span>
      </PaneHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {problem && <p className="rounded-sm bg-[#fff4d6] px-2 py-1 text-[#8a5a00]">{problem}</p>}
        {kept && (
          <p className="rounded-sm bg-[#e9f6ec] px-2 py-1 text-[#1e7d34]" data-testid="template-kept">
            {kept}
          </p>
        )}
        {templates && keeping && (
          <SaveTemplateForm
            templates={templates}
            site={kind}
            alternative={{ kind: "fragment", molecule: keeping.molecule, ...(keeping.alsoAt.length > 0 ? { alsoAt: keeping.alsoAt } : {}) }}
            onDone={(template) => {
              setKeeping(null)
              setKept(`已存为模板“${template.name}”（${template.group}），可以在“模板库…”里找到。`)
            }}
            onCancel={() => setKeeping(null)}
          />
        )}
        <SketchPad initial={initial} kind={kind} onChange={change} fill />
      </div>
    </div>
  )
}
