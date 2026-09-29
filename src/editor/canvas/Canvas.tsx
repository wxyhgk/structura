import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { atomById, componentOf, selectionFromAtoms } from "@/chem/molecule"
import type { Molecule } from "@/chem/types"
import { AtomLabelInput } from "@/editor/canvas/AtomLabelInput"
import { pointerDown, pointerMove, pointerUp } from "@/editor/canvas/gestures"
import { SceneView } from "@/editor/canvas/SceneView"
import { hoverOf } from "@/editor/canvas/targeting"
import type { CanvasHandle, EditorSlice, Gesture, PointerHost, Preview } from "@/editor/canvas/types"
import { useHotspot } from "@/editor/canvas/useHotspot"
import { useViewport } from "@/editor/canvas/useViewport"
import { hotkeyOps } from "@/editor/hotkeys/lookup"
import { keyOf } from "@/editor/input/keymap"
import { runOps } from "@/editor/ops"

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
  const [labelEdit, setLabelEdit] = useState<{ id: number; initial: string } | null>(null)
  /** The molecule as of the last edit here, ahead of the re-render when keys come fast. */
  const molRef = useRef(props.mol)
  useEffect(() => {
    molRef.current = props.mol
  })

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
  function handleKey(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey) return false
    if (gesture.current.kind !== "idle") return false
    const mol = molRef.current
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
    if (event.key === "Enter" && hot.type === "atom") {
      const atom = atomById(mol, hot.id)
      if (!atom) return false
      setLabelEdit({ id: atom.id, initial: atom.alias ?? (atom.el === "C" ? "" : atom.el) })
      return true
    }
    // A key that means nothing here falls through to the tool keys. One that means something
    // but cannot apply (no room for the ring) is still used up, so it never switches tools.
    const ops = hotkeyOps(mol, hot, key)
    if (!ops) return false
    const result = runOps(mol, ops, props.commit, { quiet: true })
    if (!result) return true
    molRef.current = result.mol
    if (result.next) hotspot.remember(result.next, result.mol)
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
      const hot = hotspot.active(molRef.current)
      if (hot?.type !== "atom") return
      props.setSelection(selectionFromAtoms(molRef.current, componentOf(molRef.current, hot.id)))
      hotspot.unpin()
    },
    cancelGesture,
    hasGesture: () => gesture.current.kind !== "idle",
    hotspot: () => hotspot.active(molRef.current),
    focusAtom: hotspot.pin,
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
          pointerDown(host, event)
        }}
        onPointerMove={(event) => {
          hotspot.track(event.clientX, event.clientY, () => hoverOf(molRef.current, viewport.toWorld(event.clientX, event.clientY), viewport.get().zoom))
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
          />
        </g>
      </svg>
      {labelEdit && labelAtom && (
        <AtomLabelInput
          key={labelEdit.id}
          initial={labelEdit.initial}
          left={pan.x + labelAtom.x * zoom}
          top={pan.y + labelAtom.y * zoom}
          onDone={(text) => {
            setLabelEdit(null)
            if (text == null) return
            const result = runOps(molRef.current, [{ op: "label", atom: labelEdit.id, text }], props.commit, { keepSelection: true })
            if (result) molRef.current = result.mol
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
