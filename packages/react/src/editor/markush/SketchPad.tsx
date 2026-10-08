import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { atomById } from "@structura/core/molecule"
import type { BondStyle, Molecule, RingKind } from "@structura/core/types"
import type { SiteKind } from "@structura/markush"
import { createEditor, createViewport, pickSite, sitesOf, sitesProblem, sitesShown, type ToolId } from "@structura/engine"
import { Canvas } from "../canvas/Canvas.tsx"
import type { CanvasHandle } from "../canvas/types.ts"
import { drawOptions } from "../drawOptions.ts"
import { SiteBadges } from "./SiteBadges.tsx"

const SINGLE: BondStyle = { order: 1, stereo: "none" }
const BONDS: Array<{ label: string; style: BondStyle }> = [
  { label: "单键", style: SINGLE },
  { label: "双键", style: { order: 2, stereo: "none" } },
  { label: "三键", style: { order: 3, stereo: "none" } },
]
const RINGS: Array<{ label: string; kind: RingKind }> = [
  { label: "苯环", kind: "benzene" },
  { label: "3", kind: "cyclopropane" },
  { label: "4", kind: "cyclobutane" },
  { label: "5", kind: "cyclopentane" },
  { label: "6", kind: "cyclohexane" },
  { label: "7", kind: "cycloheptane" },
]
const ELEMENTS = ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I"]
/** What the sites are for, by where the variable sits. */
const SITE_HINT: Record<SiteKind, string> = {
  end: "位点是接到通式上的原子；可以设多个，每个位点生成一种（如吡啶基接在 2、3、4 位）",
  link: "连接基要 2 个位点：两端各一个",
  ring: "位点是占住环里位置的原子（与环成两根键）；可以设多个，每个生成一种",
}
const NO_LABELS = drawOptions(false)
/** Small drawings for the bond, chain and benzene buttons, which text symbols render badly. */
const ICON = { width: 18, height: 14, viewBox: "0 0 18 14", fill: "none", stroke: "currentColor", strokeWidth: 1.4, "aria-hidden": true } as const
const BOND_ICONS: Record<number, ReactNode> = {
  1: <svg {...ICON}><path d="M2 7h14" /></svg>,
  2: <svg {...ICON}><path d="M2 5h14M2 9h14" /></svg>,
  3: <svg {...ICON}><path d="M2 3.5h14M2 7h14M2 10.5h14" /></svg>,
}
const CHAIN_ICON = <svg {...ICON}><path d="M1.5 10l3.75-6 3.75 6 3.75-6 3.75 6" /></svg>
const BENZENE_ICON = (
  <svg {...ICON}>
    <path d="M9 1.5l5 2.9v5.2l-5 2.9-5-2.9V4.4z" />
    <circle cx="9" cy="7" r="2.3" />
  </svg>
)

/** A site in words: the atom's element and which atom it is. */
function siteName(mol: Molecule, id: number): string {
  const atom = atomById(mol, id)
  const order = mol.atoms.findIndex((other) => other.id === id) + 1
  return atom ? `${atom.alias ?? atom.el}（第 ${order} 个原子）` : "?"
}

/**
 * A small canvas of its own for drawing one alternative: bonds, rings, a chain, elements,
 * eraser, and its sites: where the piece joins the formula, shown as numbered rings on the
 * atoms and moved in site mode. How many sites it takes follows from where the variable sits
 * (`kind`). It has its own history, so nothing here touches the main drawing until the piece
 * is added. Hover keys (1/2/3, a, n, o…) work as on the main canvas.
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
  const mol = snapshot.history.present.molecule
  const shown = sitesShown(mol, sites, kind)
  const problem = sitesProblem(mol, sites, kind)

  useEffect(() => onChange(mol, sites), [mol, sites, onChange])

  // A piece opened for editing is shown in the middle of the pad, at the usual size.
  useEffect(() => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!opened || opened.mol.atoms.length === 0 || !box) return
    const xs = opened.mol.atoms.map((atom) => atom.x)
    const ys = opened.mol.atoms.map((atom) => atom.y)
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    viewport.set({ zoom: 1, pan: { x: box.width / 2 - centre.x, y: box.height / 2 - centre.y } })
  }, [opened, viewport])

  const pick = (tool: ToolId, change: () => void = () => {}) => {
    setMarking(false)
    change()
    editor.setTool(tool)
  }

  /** In marking mode the click is the pad's, not the canvas tool's. */
  function markEnd(event: PointerEvent<HTMLDivElement>) {
    boxRef.current?.focus()
    if (!marking || event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const hit = canvasRef.current?.targetAt(event.clientX, event.clientY)
    if (hit?.type === "atom") setSites(pickSite(shown.assumed ? [] : shown.sites, hit.id, kind))
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const command = event.metaKey || event.ctrlKey
    if (command && event.key.toLowerCase() === "z") {
      if (event.shiftKey) editor.redo()
      else editor.undo()
    } else if (command || !canvasRef.current?.handleKey(event.nativeEvent)) return
    event.preventDefault()
    event.stopPropagation()
  }

  /** One button of a segmented group; `name` is what it is called (for the symbols shown). */
  const segment = (active: boolean) => `inline-flex h-6 min-w-6 items-center justify-center px-1.5 ${active ? "bg-[#e8f1fb] font-semibold text-[#1a73e8]" : "bg-white text-[#333] hover:bg-[#f2f2f2]"}`
  const group = "inline-flex divide-x divide-[#d6d6d6] overflow-hidden rounded-sm border border-[#d0d0d0]"
  const tool = marking ? null : snapshot.tool
  return (
    <div className={`flex flex-col gap-2 text-xs ${fill ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" role="toolbar" aria-label="画板工具">
        <button
          className={`h-6 rounded-sm border px-2 font-semibold ${marking ? "border-[#1a73e8] bg-[#1a73e8] text-white" : "border-[#1a73e8] bg-white text-[#1a73e8] hover:bg-[#e8f1fb]"}`}
          onClick={() => setMarking(!marking)}
          title="点原子设为位点（接到通式上的位置），再点一次去掉"
        >
          ◎ 设位点
        </button>
        <div className={group}>
          {BONDS.map((bond) => (
            <button
              key={bond.label}
              aria-label={bond.label}
              title={bond.label}
              className={segment(tool === "bond" && snapshot.bondStyle.order === bond.style.order && snapshot.bondStyle.stereo === "none")}
              onClick={() => pick("bond", () => editor.setBondStyle(bond.style))}
            >
              {BOND_ICONS[bond.style.order]}
            </button>
          ))}
          <button aria-label="碳链" title="碳链：拖出一条锯齿链" className={segment(tool === "chain")} onClick={() => pick("chain")}>
            {CHAIN_ICON}
          </button>
        </div>
        <div className={group}>
          {RINGS.map((ring) => (
            <button
              key={ring.kind}
              aria-label={ring.kind === "benzene" ? "苯环" : `${ring.label}元环`}
              title={ring.kind === "benzene" ? "苯环" : `${ring.label} 元环`}
              className={segment(tool === "ring" && snapshot.ringKind === ring.kind)}
              onClick={() => pick("ring", () => editor.setRingKind(ring.kind))}
            >
              {ring.kind === "benzene" ? BENZENE_ICON : ring.label}
            </button>
          ))}
        </div>
        <div className={group}>
          {ELEMENTS.map((el) => (
            <button key={el} className={segment(tool === "atom" && snapshot.atomEl === el)} onClick={() => pick("atom", () => editor.setAtomEl(el))} title={`点原子改成 ${el}`}>
              {el}
            </button>
          ))}
        </div>
        <div className={group}>
          <button className={segment(tool === "eraser")} onClick={() => pick("eraser")}>
            橡皮
          </button>
          <button className={`${segment(false)} disabled:text-[#bbb]`} onClick={() => editor.undo()} disabled={snapshot.history.past.length === 0}>
            撤销
          </button>
        </div>
      </div>
      <div
        ref={boxRef}
        tabIndex={0}
        className={`relative ${fill ? "min-h-[240px] flex-1" : "h-[340px]"} overflow-hidden rounded-sm border border-[#d0d0d0] bg-white outline-none focus:border-[#9fc3ee] ${marking ? "[&_svg]:cursor-crosshair" : ""}`}
        onPointerDownCapture={markEnd}
        onKeyDown={handleKey}
        data-testid="sketch-pad"
      >
        <Canvas
          ref={canvasRef}
          mol={mol}
          arrows={snapshot.history.present.arrows}
          tool={snapshot.tool}
          bondStyle={snapshot.bondStyle}
          ringKind={snapshot.ringKind}
          scaffold={snapshot.scaffold}
          atomEl={snapshot.atomEl}
          selection={snapshot.selection}
          colorHetero={snapshot.colorHetero}
          drawOptions={NO_LABELS}
          run={editor.run}
          latest={editor.latest}
          setSelection={editor.setSelection}
          undo={editor.undo}
          viewport={viewport}
        />
        <SiteBadges mol={mol} sites={shown.sites} assumed={shown.assumed} viewport={viewport} />
        {marking && <p className="pointer-events-none absolute top-1.5 left-2 rounded-sm bg-[#1a73e8] px-1.5 py-0.5 text-white">设位点：点原子（再点一次去掉）</p>}
      </div>
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
