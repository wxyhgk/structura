import type { Molecule, Point } from "@structura/core/types"
import { createEditor, pointerDown, pointerMove, pointerUp, type Editor, type Gesture, type HoverTarget, type PointerHost, type Preview, type ToolId } from "@structura/engine"

// The editor driven the way a person drives it, without a screen: presses, moves and
// releases go through the engine's gestures, and what they show is kept for the test.

type Pointer = Partial<{ shiftKey: boolean; altKey: boolean }>

/**
 * A canvas without a screen: screen and drawing coordinates are the same, zoom is 1, and
 * what gestures show (preview, draft, hover) is kept for the test to look at.
 */
export function fakeCanvas(editor: Editor) {
  const shown = { preview: null as Preview, draft: null as Molecule | null, hover: null as HoverTarget }
  const host: PointerHost = {
    get props() {
      const state = editor.get()
      return { ...state, mol: editor.latest().molecule, run: editor.run, setSelection: editor.setSelection }
    },
    gesture: { current: { kind: "idle" } as Gesture },
    space: { current: false },
    zoom: () => 1,
    pan: () => ({ x: 0, y: 0 }),
    toWorld: (x, y) => ({ x, y }),
    setView: () => {},
    setPreview: (preview) => (shown.preview = preview),
    setDraft: (draft) => (shown.draft = draft),
    setPanning: () => {},
    assignHover: (hover) => (shown.hover = hover),
    setCursor: () => {},
    setRotating: () => {},
    setRingHint: () => {},
  }
  const at = (point: Point, extra: Pointer = {}) => ({ button: 0, clientX: point.x, clientY: point.y, shiftKey: false, altKey: false, ...extra })
  return {
    shown,
    host,
    /** Press at a point (the start of a drag). */
    press: (point: Point, extra?: Pointer) => pointerDown(host, at(point, extra)),
    /** Move to a point with the button held or not. */
    move: (point: Point, extra?: Pointer) => pointerMove(host, at(point, extra)),
    /** Let go at a point. */
    release: (point: Point, extra?: Pointer) => pointerUp(host, at(point, extra)),
    /** Press, move through the points, let go at the last. */
    drag(from: Point, ...through: Point[]) {
      pointerDown(host, at(from))
      for (const point of through) pointerMove(host, at(point))
      pointerUp(host, at(through.at(-1) ?? from))
    },
    click: (point: Point, extra?: Pointer) => {
      pointerDown(host, at(point, extra))
      pointerUp(host, at(point, extra))
    },
  }
}

/** A fresh editor with a tool picked, and a fake canvas on it. */
export function withTool(tool: ToolId) {
  const editor = createEditor()
  editor.setTool(tool)
  return { editor, ...fakeCanvas(editor) }
}
