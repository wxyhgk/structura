import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react"
import { atomById } from "@structura/core/molecule"
import type { BondStyle, Molecule } from "@structura/core/types"
import type { SiteKind } from "@structura/markush"
import { command, createEditor, createViewport, keyOf, pickSite, routeKey, sitesOf, sitesProblem, sitesShown } from "@structura/engine"
import { Canvas } from "../canvas/Canvas.tsx"
import { canvasSlice } from "../canvas/slice.ts"
import type { CanvasHandle } from "../canvas/types.ts"
import { drawOptions } from "../drawOptions.ts"
import { BoundPalette } from "../palette/BoundPalette.tsx"
import { usePadSlot } from "../palette/padSlot.ts"
import { SiteBadges } from "./SiteBadges.tsx"

const SINGLE: BondStyle = { order: 1, stereo: "none" }
/** What the sites are for, by where the variable sits. */
const SITE_HINT: Record<SiteKind, string> = {
  end: "位点是接到通式上的原子；可以设多个，每个位点生成一种（如吡啶基接在 2、3、4 位）",
  link: "连接基要 2 个位点：两端各一个",
  ring: "位点是占住环里位置的原子（与环成两根键）；可以设多个，每个生成一种",
}
const PLAIN = drawOptions(false)

/** A site in words: the atom's element and which atom it is. */
function siteName(mol: Molecule, id: number): string {
  const atom = atomById(mol, id)
  const order = mol.atoms.findIndex((other) => other.id === id) + 1
  return atom ? `${atom.alias ?? atom.el}（第 ${order} 个原子）` : "?"
}

/**
 * A small canvas of its own for drawing one alternative, with its sites: where the piece
 * joins the formula, shown as numbered rings on the atoms and moved in site mode. How many
 * sites it takes follows from where the variable sits (`kind`). Inside the editor it draws
 * with the editor's own tool palette (lent to it while it is open), colours and keys, so it
 * works like the main canvas; it has its own history, so nothing here touches the main
 * drawing until the piece is added.
 */
export function SketchPad({
  initial,
  kind,
  onChange,
  fill = false,
}: {
  /** A drawn alternative opened for changing: its sites still "*" atoms, and the other atoms it may join by. */
  initial?: { molecule: Molecule; alsoAt?: number[] }
  kind: SiteKind
  onChange: (mol: Molecule, sites: number[]) => void
  /** Grow to the height it is given (a whole pane) instead of a fixed-size box. */
  fill?: boolean
}) {
  const [opened] = useState(() => (initial ? sitesOf(initial.molecule, initial.alsoAt) : null))
  const [sites, setSites] = useState<number[]>(opened?.sites ?? [])
  const [editor] = useState(() => {
    const made = createEditor(opened ? [opened.mol] : [])
    made.setTool("bond")
    made.setBondStyle(SINGLE)
    return made
  })
  const [viewport] = useState(createViewport)
  const snapshot = useSyncExternalStore(editor.subscribe, editor.get)
  const canvasRef = useRef<CanvasHandle>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  /** Site mode: clicking an atom sets or takes away a site instead of drawing. */
  const [marking, setMarking] = useState(false)
  const slot = usePadSlot()
  const claim = slot?.claim
  const colorHetero = slot?.colorHetero ?? true
  const mol = snapshot.history.present.molecule
  const shown = sitesShown(mol, sites, kind)
  const problem = sitesProblem(mol, sites, kind)
  const commands = useMemo(
    () => [
      command("撤销", editor.undo, { keys: [{ key: "z", meta: true }] }),
      command("重做", editor.redo, { keys: [{ key: "z", meta: true, shift: true }, { key: "y", meta: true }] }),
      command("删除", editor.removeSelection, { keys: [{ key: "Backspace" }, { key: "Delete" }] }),
      command("全选", editor.selectEverything, { keys: [{ key: "a", meta: true }] }),
    ],
    [editor],
  )

  useEffect(() => onChange(mol, sites), [mol, sites, onChange])
  // The editor's palette draws here while the pad is open; picking a tool leaves site mode.
  useEffect(() => claim?.({ editor, onPick: () => setMarking(false) }), [claim, editor])
  useEffect(() => editor.setColorHetero(colorHetero), [editor, colorHetero])

  // A piece opened for editing is shown in the middle of the pad, at the usual size.
  useEffect(() => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!opened || opened.mol.atoms.length === 0 || !box) return
    const xs = opened.mol.atoms.map((atom) => atom.x)
    const ys = opened.mol.atoms.map((atom) => atom.y)
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    viewport.set({ zoom: 1, pan: { x: box.width / 2 - centre.x, y: box.height / 2 - centre.y } })
  }, [opened, viewport])

  /** In marking mode the click is the pad's, not the canvas tool's. */
  function markEnd(event: PointerEvent<HTMLDivElement>) {
    boxRef.current?.focus()
    if (!marking || event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const hit = canvasRef.current?.targetAt(event.clientX, event.clientY)
    if (hit?.type === "atom") setSites(pickSite(shown.assumed ? [] : shown.sites, hit.id, kind))
  }

  /** Keys go through the same router as the main canvas's, to the pad's editor and canvas. */
  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") return
    if (event.code === "Space") {
      if (!event.repeat) canvasRef.current?.holdSpace()
      event.preventDefault()
      return
    }
    if (keyOf(event.nativeEvent) === "[") return // The pad draws no brackets.
    routeKey(event.nativeEvent, { editor, commands, canvas: canvasRef.current })
  }

  const button = (active: boolean) =>
    `h-6 rounded-sm border px-2 ${active ? "border-[#1a73e8] bg-[#1a73e8] font-semibold text-white" : "border-[#d0d0d0] bg-white text-[#333] hover:bg-[#f2f2f2] disabled:text-[#bbb]"}`
  const pad = (
    <div
      ref={boxRef}
      tabIndex={0}
      className={`relative ${fill ? "min-h-[240px] flex-1" : "h-[340px] flex-1"} overflow-hidden rounded-sm border border-[#d0d0d0] bg-white outline-none focus:border-[#9fc3ee] ${marking ? "[&_svg]:cursor-crosshair" : ""}`}
      onPointerDownCapture={markEnd}
      onKeyDown={handleKey}
      onKeyUp={(event) => event.code === "Space" && canvasRef.current?.releaseSpace()}
      data-testid="sketch-pad"
    >
      <Canvas ref={canvasRef} {...canvasSlice({ ...editor, ...snapshot, arrows: snapshot.history.present.arrows }, { mol, drawOptions: slot?.drawOptions ?? PLAIN, viewport })} />
      <SiteBadges mol={mol} sites={shown.sites} assumed={shown.assumed} viewport={viewport} />
      {marking && <p className="pointer-events-none absolute top-1.5 left-2 rounded-sm bg-[#1a73e8] px-1.5 py-0.5 text-white">设位点：点原子（再点一次去掉）</p>}
    </div>
  )
  return (
    <div className={`flex flex-col gap-2 text-xs ${fill ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="画板">
        <button
          className={`h-6 rounded-sm border px-2 font-semibold ${marking ? "border-[#1a73e8] bg-[#1a73e8] text-white" : "border-[#1a73e8] bg-white text-[#1a73e8] hover:bg-[#e8f1fb]"}`}
          onClick={() => setMarking(!marking)}
          title="点原子设为位点（接到通式上的位置），再点一次去掉"
        >
          ◎ 设位点
        </button>
        <button className={button(false)} onClick={() => editor.undo()} disabled={snapshot.history.past.length === 0} title="撤销（⌘Z）">
          撤销
        </button>
        <button className={button(false)} onClick={() => editor.redo()} disabled={snapshot.history.future.length === 0} title="重做（⇧⌘Z）">
          重做
        </button>
        {claim && <span className="text-[#888]">用左侧工具栏画，快捷键和主画布一样</span>}
      </div>
      {claim ? (
        pad
      ) : (
        <div className={`flex gap-2 ${fill ? "min-h-0 flex-1" : ""}`}>
          <BoundPalette editor={editor} onPick={() => setMarking(false)} structureTools={false} />
          {pad}
        </div>
      )}
      <p className="text-[#555]" data-testid="sites-line">
        <span className="text-[#888]">{SITE_HINT[kind]}。</span>
        {shown.sites.length > 0 && (
          <span>
            位点：{shown.sites.map((id, index) => `${index + 1}. ${siteName(mol, id)}`).join("、")}
            {shown.assumed && "（默认用第一个画的原子，点“设位点”可以换）"}
            {kind !== "link" && shown.sites.length > 1 && `，生成时每个位点一种，共 ${shown.sites.length} 种`}
          </span>
        )}
        {problem && mol.atoms.length > 0 && <span className="text-[#b26a00]"> {problem}</span>}
      </p>
    </div>
  )
}
