import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { atomById, componentOf, displayMolecule, selectionFromAtoms } from "@structura/core/molecule"
import type { Molecule } from "@structura/core/types"
import { AtomLabelInput } from "./AtomLabelInput.tsx"
import { SceneView } from "./SceneView.tsx"
import { hitOf, hotkeyOps, hoverOf, keyOf, pointerDown, pointerMove, pointerUp, type RingHintShape } from "@structura/engine"
import { frameHandleCursor } from "./frameHandleCursor.ts"
import { QuickScaffold } from "./QuickScaffold.tsx"
import type { CanvasHandle, EditorSlice, Gesture, PointerHost, Preview } from "./types.ts"
import { useDoubleClick } from "./useDoubleClick.ts"
import { useHotspot } from "./useHotspot.ts"
import { useLabelEditor } from "./useLabelEditor.ts"
import { useQuickScaffold } from "./useQuickScaffold.ts"
import { useViewport } from "./useViewport.ts"

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
  const [ringHint, setRingHint] = useState<RingHintShape | null>(null)
  const [panning, setPanning] = useState(false)
  const [handleCursor, setHandleCursor] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  /** Where the pointer last was over the canvas, in client coordinates. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  /**
   * The molecule as of the last edit, ahead of the re-render when keys come fast, as shown:
   * collapsed abbreviations are their labels, so nothing behind a label can be pointed at.
   */
  const current = () => displayMolecule(props.latest().molecule)
  const label = useLabelEditor({ current, hotspot, run: props.run })
  const quick = useQuickScaffold({ current, hotspot, viewport, lastPointer, run: props.run })
  const { doubleClick, press } = useDoubleClick({ props, current, openLabel: label.openLabel })

  function cancelGesture() {
    gesture.current = { kind: "idle" }
    setPreview(null)
    setRingHint(null)
    hotspot.clearHover()
    setDraft(null)
    setPanning(false)
    setRotating(false)
  }

  const host: PointerHost = {
    // The molecule as of the last edit, not as of the last render: a second click or key that
    // comes before React has drawn the first one's result must act on that result.
    get props() {
      return { ...props, mol: current() }
    },
    gesture,
    space,
    zoom: () => viewport.get().zoom,
    pan: () => viewport.get().pan,
    toWorld: viewport.toWorld,
    setView: (nextZoom, nextPan) => viewport.set({ zoom: nextZoom, pan: nextPan }),
    setPreview,
    setDraft,
    setRingHint,
    setPanning,
    assignHover: hotspot.assignHover,
    setFrameHandle: (handle) => setHandleCursor(handle && frameHandleCursor(handle)),
    setRotating,
  }

  /**
   * Hover hotkeys: g, Tab, Enter and chemistry keys on the atom or bond under the pointer.
   * Returns whether the key was used; the editor's key router asks here first.
   */
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
    if (event.key === "Enter" && hot.type === "atom") return label.openLabel(hot.id)
    // A key that means nothing here falls through to the tool keys. One that means something
    // but cannot apply (no room for the ring) is still used up, so it never switches tools.
    const ops = hotkeyOps(mol, hot, key)
    if (!ops) return false
    // A key on the atom under the pointer leaves the selection alone; it may be elsewhere.
    const result = props.run(ops, { quiet: true, keepSelection: true })
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
    pointed: () => hotspot.under(),
    focusAtom: hotspot.pin,
    editLabel: (id) => void label.openLabel(id),
    targetAt: (clientX, clientY) => hitOf(current(), viewport.toWorld(clientX, clientY), viewport.get().zoom),
    quickScaffold: quick.open,
    replaceFragment: label.replaceFragment,
  }))

  // Selecting something starts afresh: an old hotspot must not take the keys meant for the selection.
  const { unpin } = hotspot
  useEffect(() => {
    if (props.selection.atoms.length > 0 || props.selection.bonds.length > 0) unpin()
  }, [props.selection, unpin])

  useEffect(() => {
    if (gesture.current.kind === "idle") setPreview(null)
  }, [props.tool, props.ringKind])

  const shown = draft ?? props.mol
  const labelEdit = label.edit
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
          press(event)
          // The canvas keeps the pointer while a drag goes on, even off its edge.
          if (event.button === 0 || event.button === 1) event.currentTarget.setPointerCapture(event.pointerId)
          pointerDown(host, event)
        }}
        onPointerMove={(event) => {
          lastPointer.current = { x: event.clientX, y: event.clientY }
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
            target={hotspot.target(shown)}
            preview={preview}
            ringHint={ringHint}
            colorHetero={props.colorHetero}
            drawOptions={props.drawOptions}
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
          onDone={label.done}
        />
      )}
      {quick.quick && <QuickScaffold left={quick.quick.screen.x} top={quick.quick.screen.y} target={quick.quick.target?.type ?? null} onCancel={quick.cancel} onPick={quick.pick} />}
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

