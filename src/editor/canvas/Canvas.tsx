import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react"
import { atomById, bondsLeaving, componentOf, selectionFromAtoms } from "@/chem/molecule"
import type { Drawing, Molecule } from "@/chem/types"
import { AtomLabelInput } from "@/editor/canvas/AtomLabelInput"
import { pointerDown, pointerMove, pointerUp } from "@/editor/canvas/gestures"
import { SceneView } from "@/editor/canvas/SceneView"
import { doubleClickAction } from "@/editor/canvas/doubleClick"
import { hitOf, hoverOf, sameHover } from "@/editor/canvas/targeting"
import type { CanvasHandle, EditorSlice, Gesture, HoverTarget, PointerHost, Preview } from "@/editor/canvas/types"
import { useHotspot } from "@/editor/canvas/useHotspot"
import { useViewport } from "@/editor/canvas/useViewport"
import { hotkeyOps } from "@/editor/hotkeys/lookup"
import { keyOf } from "@/editor/input/keymap"

/** Two presses this close in time (ms) and space (px) make a double click. */
const DOUBLE_CLICK_MS = 500
const DOUBLE_CLICK_SLOP = 6

/** The drawing surface: pointer gestures, hover keys, the label field and the view. */
export const Canvas = forwardRef<CanvasHandle, EditorSlice>(function Canvas(props, ref) {
  const { viewport } = props
  const { svgRef, zoom, pan } = useViewport(viewport)
  const hotspot = useHotspot(`${props.tool}:${props.ringKind}`)
  const gesture = useRef<Gesture>({ kind: "idle" })
  const space = useRef(false)
  const spaceDragged = useRef(false)
  const [preview, setPreview] = useState<Preview>(null)
  const [draft, setDraft] = useState<Molecule | null>(null)
  const [panning, setPanning] = useState(false)
  const [handleCursor, setHandleCursor] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  /** The label field: on one atom, or on a selected fragment to replace (`replace` lists its atoms). */
  const [labelEdit, setLabelEdit] = useState<{ id: number; initial: string; replace?: number[] } | null>(null)
  /** The molecule as of the last edit, ahead of the re-render when keys come fast. */
  const current = () => props.latest().molecule
  /** What the last press hit and the drawing before it, to spot a double click. */
  const firstClick = useRef<{ hit: HoverTarget; before: Drawing; time: number; x: number; y: number } | null>(null)

  function cancelGesture() {
    gesture.current = { kind: "idle" }
    setPreview(null)
    hotspot.clearHover()
    setDraft(null)
    setPanning(false)
    setRotating(false)
  }

  const host: PointerHost = {
    props,
    gesture,
    space,
    zoom: () => viewport.get().zoom,
    pan: () => viewport.get().pan,
    toWorld: viewport.toWorld,
    setView: (nextZoom, nextPan) => viewport.set({ zoom: nextZoom, pan: nextPan }),
    setPreview,
    setDraft,
    setPanning,
    assignHover: hotspot.assignHover,
    setCursor: setHandleCursor,
    setRotating,
  }

  /**
   * Hover hotkeys: g, Tab, Enter and chemistry keys on the atom or bond under the pointer.
   * Returns whether the key was used; the editor's key router asks here first.
   */
  /** Opens the label field on an atom; false if the atom is gone. */
  function openLabel(id: number): boolean {
    const atom = atomById(current(), id)
    if (!atom) return false
    // The field covers the atom, so the canvas sees the pointer leave; pinning keeps the
    // atom as the hotspot, so Enter after Escape reopens it and keys go on from there.
    hotspot.pin(atom.id)
    setLabelEdit({ id: atom.id, initial: atom.alias ?? (atom.el === "C" ? "" : atom.el) })
    return true
  }

  /**
   * The second press of a double click on the same atom or bond: soon after the first and
   * close to it. (Pointer events carry no click count, so it is timed here.) The first
   * press was an ordinary click, which may have drawn a bond or changed a bond order; that
   * is undone before the double click acts. Returns whether it acted.
   */
  function doubleClick(event: PointerEvent<SVGSVGElement>): boolean {
    const first = firstClick.current
    firstClick.current = null
    if (event.button !== 0 || !first) return false
    if (event.timeStamp - first.time > DOUBLE_CLICK_MS || Math.hypot(event.clientX - first.x, event.clientY - first.y) > DOUBLE_CLICK_SLOP) return false
    const hit = hitOf(current(), viewport.toWorld(event.clientX, event.clientY), viewport.get().zoom)
    if (!hit || !sameHover(first.hit, hit)) return false
    if (props.latest() !== first.before) props.undo()
    const action = doubleClickAction(current(), hit)
    if (action?.kind === "label") openLabel(action.atom)
    else if (action?.kind === "select") props.setSelection(action.selection)
    return action != null
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey) return false
    if (gesture.current.kind !== "idle") return false
    const mol = current()
    const hot = hotspot.active(mol)
    if (!hot) return false
    const key = keyOf(event)
    if (key === "g") {
      props.setSelection(hot.type === "atom" ? { atoms: [hot.id], bonds: [] } : { atoms: [], bonds: [hot.id] })
      return true
    }
    if (event.key === "Tab" && hot.type === "atom") {
      props.setSelection(selectionFromAtoms(mol, componentOf(mol, hot.id)))
      hotspot.unpin()
      return true
    }
    if (event.key === "Enter" && hot.type === "atom") return openLabel(hot.id)
    // A key that means nothing here falls through to the tool keys. One that means something
    // but cannot apply (no room for the ring) is still used up, so it never switches tools.
    const ops = hotkeyOps(mol, hot, key)
    if (!ops) return false
    const result = props.run(ops, { quiet: true })
    if (!result) return true
    if (result.next) hotspot.remember(result.next, result.drawing.molecule)
    return true
  }

  useImperativeHandle(ref, () => ({
    handleKey,
    holdSpace() {
      space.current = true
      spaceDragged.current = false
    },
    releaseSpace() {
      // Only a Space this canvas saw go down: a tap without a drag selects the molecule.
      if (!space.current) return
      space.current = false
      setPanning(false)
      if (spaceDragged.current) return
      const hot = hotspot.active(current())
      if (hot?.type !== "atom") return
      props.setSelection(selectionFromAtoms(current(), componentOf(current(), hot.id)))
      hotspot.unpin()
    },
    cancelGesture,
    hasGesture: () => gesture.current.kind !== "idle",
    hotspot: () => hotspot.active(current()),
    focusAtom: hotspot.pin,
    replaceFragment(ids: number[]) {
      const mol = current()
      // The field sits on the atom that joins the fragment to the rest, where the new piece goes.
      const [join] = bondsLeaving(mol, ids)
      const at = join ? (ids.includes(join.a) ? join.a : join.b) : ids[0]
      if (at != null && atomById(mol, at)) setLabelEdit({ id: at, initial: "", replace: ids })
    },
  }))

  useEffect(() => {
    if (gesture.current.kind === "idle") setPreview(null)
  }, [props.tool, props.ringKind])

  const shown = draft ?? props.mol
  const labelAtom = labelEdit ? atomById(shown, labelEdit.id) : undefined
  const cursor = panning ? "grab" : handleCursor ?? (props.tool === "lasso" || props.tool === "marquee" ? "default" : "crosshair")

  return (
    <div className="relative h-full min-w-0 flex-1 bg-white">
      <svg
        ref={svgRef}
        data-testid="canvas"
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor }}
        onPointerDown={(event) => {
          if (space.current) spaceDragged.current = true
          if (doubleClick(event)) {
            // Keeps the browser's mousedown from taking focus off a label field just opened.
            event.preventDefault()
            return
          }
          if (event.button === 0) {
            const world = viewport.toWorld(event.clientX, event.clientY)
            firstClick.current = {
              hit: hitOf(current(), world, viewport.get().zoom),
              before: props.latest(),
              time: event.timeStamp,
              x: event.clientX,
              y: event.clientY,
            }
          }
          pointerDown(host, event)
        }}
        onPointerMove={(event) => {
          hotspot.track(event.clientX, event.clientY, () => hoverOf(current(), viewport.toWorld(event.clientX, event.clientY), viewport.get().zoom))
          pointerMove(host, event)
        }}
        onPointerUp={(event) => pointerUp(host, event)}
        onPointerCancel={() => {
          gesture.current = { kind: "idle" }
          setPreview(null)
          hotspot.clearHover()
          setDraft(null)
          setRotating(false)
          if (!space.current) setPanning(false)
        }}
        onPointerLeave={() => {
          hotspot.clearHover()
          setHandleCursor(null)
          if (gesture.current.kind === "idle" && props.tool === "ring") setPreview(null)
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <SceneView
            mol={shown}
            arrows={props.arrows}
            selection={props.selection}
            tool={props.tool}
            zoom={zoom}
            hover={hotspot.hover}
            hotspotId={hotspot.pinnedIn(props.mol)}
            preview={preview}
            colorHetero={props.colorHetero}
            showFrame={!rotating}
            attachments={props.attachments}
          />
        </g>
      </svg>
      {labelEdit && labelAtom && (
        <AtomLabelInput
          key={labelEdit.id}
          initial={labelEdit.initial}
          placeholder={labelEdit.replace ? "替换为" : undefined}
          left={pan.x + labelAtom.x * zoom}
          top={pan.y + labelAtom.y * zoom}
          onDone={(text) => {
            setLabelEdit(null)
            if (text == null) return
            if (labelEdit.replace) props.run([{ op: "replace", atoms: labelEdit.replace, with: { label: text } }])
            else props.run([{ op: "label", atom: labelEdit.id, text }], { keepSelection: true })
          }}
        />
      )}
      {shown.atoms.length === 0 && preview == null && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[14px] leading-6 text-[#9a9a9a]">
          在空白处点击，画一条键
          <br />
          悬停在原子上按键，可直接接苯环、羰基和碳链
        </div>
      )}
    </div>
  )
})
