import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react"
import type { BondStyle, Molecule, RingKind } from "@structura/core/types"
import { createEditor, createViewport, toggleEndOps, type ToolId } from "@structura/engine"
import { Canvas } from "@/editor/canvas/Canvas"
import type { CanvasHandle } from "@/editor/canvas/types"
import { drawOptions } from "@/editor/drawOptions"

const SINGLE: BondStyle = { order: 1, stereo: "none" }
const BONDS: Array<{ label: string; style: BondStyle }> = [
  { label: "单键", style: SINGLE },
  { label: "双键", style: { order: 2, stereo: "none" } },
  { label: "三键", style: { order: 3, stereo: "none" } },
]
const RINGS: Array<{ label: string; kind: RingKind }> = [
  { label: "苯环", kind: "benzene" },
  { label: "六元环", kind: "cyclohexane" },
  { label: "五元环", kind: "cyclopentane" },
]
const ELEMENTS = ["C", "N", "O", "S", "F", "Cl", "Br"]
const NO_LABELS = drawOptions(false)

/**
 * A small canvas of its own for drawing one alternative: bonds, rings, elements, eraser, and
 * a mode for marking where the piece joins the formula. It has its own history, so nothing
 * here touches the main drawing until the piece is added. Hover keys (1/2/3, a, n, o…) work
 * as on the main canvas.
 */
export function SketchPad({ initial, onChange }: { initial?: Molecule; onChange: (mol: Molecule) => void }) {
  const [editor] = useState(() => {
    const made = createEditor(initial ? [initial] : [])
    made.setTool("bond")
    made.setBondStyle(SINGLE)
    return made
  })
  const [viewport] = useState(createViewport)
  const snapshot = useSyncExternalStore(editor.subscribe, editor.get)
  const canvasRef = useRef<CanvasHandle>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  /** Clicking an atom marks or unmarks a point of attachment instead of drawing. */
  const [marking, setMarking] = useState(false)
  const mol = snapshot.history.present.molecule

  useEffect(() => onChange(mol), [mol, onChange])

  // A piece opened for editing is shown in the middle of the pad, at the usual size.
  useEffect(() => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!initial || initial.atoms.length === 0 || !box) return
    const xs = initial.atoms.map((atom) => atom.x)
    const ys = initial.atoms.map((atom) => atom.y)
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    viewport.set({ zoom: 1, pan: { x: box.width / 2 - centre.x, y: box.height / 2 - centre.y } })
  }, [initial, viewport])

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
    if (hit?.type === "atom") editor.run(toggleEndOps(editor.latest().molecule, hit.id))
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

  const on = (active: boolean) =>
    `rounded-sm border px-1.5 py-0.5 ${active ? "border-[#1a73e8] bg-[#e8f1fb] text-[#1a73e8]" : "border-[#d0d0d0] bg-white hover:bg-[#f2f2f2]"}`
  const tool = marking ? null : snapshot.tool
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="画板工具">
        {BONDS.map((bond) => (
          <button
            key={bond.label}
            className={on(tool === "bond" && snapshot.bondStyle.order === bond.style.order && snapshot.bondStyle.stereo === "none")}
            onClick={() => pick("bond", () => editor.setBondStyle(bond.style))}
          >
            {bond.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[#ddd]" />
        {RINGS.map((ring) => (
          <button key={ring.kind} className={on(tool === "ring" && snapshot.ringKind === ring.kind)} onClick={() => pick("ring", () => editor.setRingKind(ring.kind))}>
            {ring.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[#ddd]" />
        {ELEMENTS.map((el) => (
          <button key={el} className={on(tool === "atom" && snapshot.atomEl === el)} onClick={() => pick("atom", () => editor.setAtomEl(el))} title={`点原子改成 ${el}`}>
            {el}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[#ddd]" />
        <button className={on(tool === "eraser")} onClick={() => pick("eraser")}>
          橡皮
        </button>
        <button className={on(marking)} onClick={() => setMarking(!marking)} title="点原子标出（或去掉）接到通式上的位置">
          连接点 *
        </button>
        <button className={on(false)} onClick={() => editor.undo()} disabled={snapshot.history.past.length === 0}>
          撤销
        </button>
      </div>
      <div
        ref={boxRef}
        tabIndex={0}
        className={`relative h-[340px] overflow-hidden rounded-sm border border-[#d0d0d0] bg-white outline-none focus:border-[#9fc3ee] ${marking ? "[&_svg]:cursor-crosshair" : ""}`}
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
      </div>
    </div>
  )
}
