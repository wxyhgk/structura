import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { runOps } from "@/editor/ops"
import { editorKeysBlocked } from "@/editor/keys"
import { atomById, componentOf, selectionFromAtoms } from "@/chem/molecule"
import type { HotTarget, Molecule, Point } from "@/chem/types"
import { pointerDown, pointerMove, pointerUp } from "@/editor/canvas/gestures"
import { SceneView } from "@/editor/canvas/SceneView"
import { clampZoom, hoverOf, sameHover } from "@/editor/canvas/targeting"
import { ZOOM_STEP } from "@/editor/canvas/view"
import { keyOf } from "@/editor/keymap"
import type { CanvasHandle, EditorSlice, Gesture, HoverTarget, PointerHost, Preview } from "@/editor/canvas/types"

export type { CanvasHandle } from "@/editor/canvas/types"

export const Canvas = forwardRef<CanvasHandle, EditorSlice>(function Canvas(props, ref) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture>({ kind: "idle" })
  const space = useRef(false)
  const spaceDragged = useRef(false)
  const zoomRef = useRef(1)
  const panRef = useRef<Point>({ x: 0, y: 0 })
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [preview, setPreview] = useState<Preview>(null)
  const [hover, setHover] = useState<HoverTarget>(null)
  const [draft, setDraft] = useState<Molecule | null>(null)
  const [panning, setPanning] = useState(false)
  const [handleCursor, setHandleCursor] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [hotspotId, setHotspotId] = useState<number | null>(null)
  const [labelEdit, setLabelEdit] = useState<{ id: number; value: string; initial: string } | null>(null)
  const molRef = useRef(props.mol)
  const hoverRef = useRef<HoverTarget>(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const pinRef = useRef<{ id: number; x: number; y: number; covered: HoverTarget } | null>(null)
  const labelOpen = useRef(false)
  useEffect(() => {
    molRef.current = props.mol
  })

  function setView(nextZoom: number, nextPan: Point) {
    zoomRef.current = nextZoom
    panRef.current = nextPan
    setZoom(nextZoom)
    setPan(nextPan)
    propsRef.current.onZoom(nextZoom)
  }

  function toWorld(clientX: number, clientY: number): Point {
    const rect = svgRef.current?.getBoundingClientRect()
    return {
      x: (clientX - (rect?.left ?? 0) - panRef.current.x) / zoomRef.current,
      y: (clientY - (rect?.top ?? 0) - panRef.current.y) / zoomRef.current,
    }
  }

  function assignHover(next: HoverTarget) {
    hoverRef.current = next
    setHover((current) => (sameHover(current, next) ? current : next))
  }

  function clearHover() {
    hoverRef.current = null
    setHover(null)
  }

  function cancelGesture() {
    gesture.current = { kind: "idle" }
    setPreview(null)
    clearHover()
    setDraft(null)
    setPanning(false)
    setRotating(false)
  }

  function activeHotspot(mol: Molecule): HotTarget | null {
    const pin = pinRef.current
    if (pin && atomById(mol, pin.id)) return { type: "atom", id: pin.id }
    const current = hoverRef.current
    if (!current) return null
    if (current.type === "atom" && atomById(mol, current.id)) return current
    if (current.type === "bond" && mol.bonds.some((bond) => bond.id === current.id)) return current
    return null
  }

  function rememberHotspot(next: HotTarget) {
    if (next.type === "atom" && atomById(molRef.current, next.id)) {
      pinRef.current = {
        id: next.id,
        x: pointerRef.current.x,
        y: pointerRef.current.y,
        covered: hoverRef.current,
      }
      setHotspotId(next.id)
      return
    }
    pinRef.current = null
    setHotspotId(null)
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const worldX = (sx - panRef.current.x) / zoomRef.current
    const worldY = (sy - panRef.current.y) / zoomRef.current
    const next = clampZoom(zoomRef.current * factor)
    setView(next, { x: sx - worldX * next, y: sy - worldY * next })
  }

  const host: PointerHost = {
    props,
    gesture,
    space,
    zoom: () => zoomRef.current,
    pan: () => panRef.current,
    toWorld,
    setView,
    setPreview,
    setDraft,
    setPanning,
    assignHover,
    setCursor: setHandleCursor,
    setRotating,
  }

  /**
   * Hover hotkeys: g, Tab, Enter and chemistry keys on the atom or bond under the pointer.
   * Returns whether the key was used; the editor's key router asks here first.
   */
  function handleKey(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey) return false
    if (editorKeysBlocked(event)) return false
    if (gesture.current.kind !== "idle") return false
    const mol = molRef.current
    const hot = activeHotspot(mol)
    if (!hot) return false
    const key = keyOf(event)
    if (key === "g") {
      propsRef.current.setSelection(
        hot.type === "atom" ? { atoms: [hot.id], bonds: [] } : { atoms: [], bonds: [hot.id] },
      )
      return true
    }
    if (event.key === "Tab" && hot.type === "atom") {
      propsRef.current.setSelection(selectionFromAtoms(mol, componentOf(mol, hot.id)))
      pinRef.current = null
      setHotspotId(null)
      return true
    }
    if (event.key === "Enter" && hot.type === "atom") {
      const atom = atomById(mol, hot.id)
      if (!atom) return false
      const value = atom.alias ?? (atom.el === "C" ? "" : atom.el)
      labelOpen.current = true
      setLabelEdit({ id: atom.id, value, initial: value })
      return true
    }
    const on = hot.type === "atom" ? { atom: hot.id } : { bond: hot.id }
    // A key that does nothing here is not an edit; let it fall through to the tool keys.
    const result = runOps(mol, [{ op: "hotkey", ...on, key }], propsRef.current.commit, { quiet: true })
    if (!result) return false
    molRef.current = result.mol
    if (result.next) rememberHotspot(result.next)
    return true
  }

  useImperativeHandle(ref, () => ({
    handleKey,
    zoomBy(factor: number) {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
    },
    resetView() {
      setView(1, { x: 0, y: 0 })
    },
    fitContent(mol?: Molecule) {
      const rect = svgRef.current?.getBoundingClientRect()
      const points = [
        ...(mol ?? molRef.current).atoms,
        ...propsRef.current.arrows.flatMap((arrow) => [
          { x: arrow.x1, y: arrow.y1 },
          { x: arrow.x2, y: arrow.y2 },
        ]),
      ]
      if (!rect || points.length === 0) return
      const xs = points.map((point) => point.x)
      const ys = points.map((point) => point.y)
      const margin = 60
      const width = Math.max(...xs) - Math.min(...xs) + margin * 2
      const height = Math.max(...ys) - Math.min(...ys) + margin * 2
      const nextZoom = Math.min(1.5, Math.max(0.1, Math.min(rect.width / width, rect.height / height)))
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2
      setView(nextZoom, { x: rect.width / 2 - cx * nextZoom, y: rect.height / 2 - cy * nextZoom })
    },
    cancelGesture,
    hasGesture: () => gesture.current.kind !== "idle",
    hotspot: () => activeHotspot(molRef.current),
    focusAtom(id: number) {
      pinRef.current = { id, x: pointerRef.current.x, y: pointerRef.current.y, covered: hoverRef.current }
      setHotspotId(id)
    },
  }))

  const hoverScope = `${props.tool}:${props.ringKind}`
  const [hoverScopeSeen, setHoverScopeSeen] = useState(hoverScope)
  if (hoverScopeSeen !== hoverScope) {
    setHoverScopeSeen(hoverScope)
    setHover(null)
  }

  useEffect(() => {
    hoverRef.current = hover
  })

  useEffect(() => {
    if (gesture.current.kind === "idle") setPreview(null)
  }, [props.tool, props.ringKind])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP)
        return
      }
      setView(zoomRef.current, {
        x: panRef.current.x - event.deltaX,
        y: panRef.current.y - event.deltaY,
      })
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (editorKeysBlocked(event)) return
      if (event.code === "Space" && !event.repeat) {
        space.current = true
        spaceDragged.current = false
        event.preventDefault()
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      space.current = false
      setPanning(false)
      if (spaceDragged.current) return
      const hot = activeHotspot(molRef.current)
      if (hot?.type !== "atom") return
      propsRef.current.setSelection(selectionFromAtoms(molRef.current, componentOf(molRef.current, hot.id)))
      pinRef.current = null
      setHotspotId(null)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])


  const shown = draft ?? props.mol
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
          pointerRef.current = { x: event.clientX, y: event.clientY }
          const pin = pinRef.current
          if (pin && Math.hypot(event.clientX - pin.x, event.clientY - pin.y) > 6) {
            const under = hoverOf(molRef.current, toWorld(event.clientX, event.clientY), zoomRef.current)
            const stayed =
              under != null &&
              ((under.type === "atom" && under.id === pin.id) ||
                (pin.covered != null && under.type === pin.covered.type && under.id === pin.covered.id))
            if (under && !stayed) {
              pinRef.current = null
              setHotspotId(null)
            }
          }
          pointerMove(host, event)
        }}
        onPointerUp={(event) => pointerUp(host, event)}
        onPointerCancel={() => {
          gesture.current = { kind: "idle" }
          setPreview(null)
          clearHover()
          setDraft(null)
          setRotating(false)
          if (!space.current) setPanning(false)
        }}
        onPointerLeave={() => {
          clearHover()
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
            hover={hover}
            hotspotId={hotspotId != null && atomById(props.mol, hotspotId) ? hotspotId : null}
            preview={preview}
            colorHetero={props.colorHetero}
            showFrame={!rotating}
          />
        </g>
      </svg>
      {labelEdit &&
        (() => {
          const atom = atomById(shown, labelEdit.id)
          if (!atom) return null
          return (
            <input
              data-testid="atom-label-input"
              autoFocus
              value={labelEdit.value}
              aria-label="原子标签"
              className="absolute z-10 h-7 w-20 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#1a73e8] bg-white text-center font-[Arial,Helvetica,sans-serif] text-[15px] outline-none"
              style={{ left: pan.x + atom.x * zoom, top: pan.y + atom.y * zoom }}
              onChange={(event) => {
                const value = event.target.value
                setLabelEdit((current) => (current ? { ...current, value } : current))
              }}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === "Enter") {
                  event.preventDefault()
                  event.currentTarget.blur()
                } else if (event.key === "Escape") {
                  event.preventDefault()
                  labelOpen.current = false
                  setLabelEdit(null)
                  event.currentTarget.blur()
                }
              }}
              onBlur={() => {
                if (!labelOpen.current) return
                labelOpen.current = false
                const current = labelEdit
                setLabelEdit(null)
                if (!current || current.value.trim() === current.initial) return
                const result = runOps(molRef.current, [{ op: "label", atom: current.id, text: current.value }], propsRef.current.commit, { keepSelection: true })
                if (result) molRef.current = result.mol
              }}
            />
          )
        })()}
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
