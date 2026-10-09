// The editor's behaviour, without the screen: which key does what to which atom, what a
// pointer hits and where a drag snaps, the tools and their keys, the view's arithmetic, and
// the ops each user action makes. Framework-free; the React editor (and later a 3D editor
// or an agent acting like a user) drives it. Chemistry itself is @structura/core.

export { keyLabel, keyOf, matches, type KeyMatch } from "./keys/keymap.ts"

export { atomActionOps, bondActionOps, type AtomAction, type BondAction } from "./hotkeys/actions.ts"
export { ATOM_KEYS } from "./hotkeys/atom-keys.ts"
export { BOND_KEYS } from "./hotkeys/bond-keys.ts"
export { hasHotkey, hotkeyOps, selectionHotkeyOps, selectionTips } from "./hotkeys/lookup.ts"

export type { ScaffoldPick, ToolId } from "./tools/types.ts"
export { keysFor, TOOL_KEYS, toolForKey, toolKeyLabel, withKeys, type ToolKey } from "./tools/bindings.ts"
export { BOND_STYLES, RING_KINDS, sameStyle, toolLabel } from "./tools/catalog.ts"
export { RING_NAMES } from "./i18n/zh.ts"
export { describeAtomAction, describeBondAction, hotkeyLabel } from "./tools/describe.ts"
export { defaultPick } from "./tools/scaffoldPick.ts"

export type { HoverTarget } from "./pointer/types.ts"
export { contextTarget, type ContextTarget } from "./pointer/context.ts"
export { contextAtoms } from "./pointer/contextAtoms.ts"
export { bondEnd, clampScale, dragIds, frameAt, hitOf, hoverOf, sameHover, selectionFrame, type FrameHandle, type SelectionFrame } from "./pointer/targeting.ts"
export { doubleClickAction, type DoubleClick } from "./pointer/doubleClick.ts"
export { snappedMove } from "./pointer/moveSnap.ts"
export { fuseReach, fusionSide, fusionTarget } from "./pointer/fusion.ts"
export { chainCount } from "./pointer/chain.ts"

export { clampZoom, createViewport, drawingPoints, fittedView, zoomedAt, type View, type Viewport } from "./view/viewport.ts"
export { ROTATE_STEP, ZOOM_STEP } from "./view/steps.ts"
export { steppedZoom, ZOOM_LEVELS } from "./view/zoomLevels.ts"

export { joinOps, paintOps, scaffoldOps, type Run, type RunOptions } from "./ops/builders.ts"
export { captureOps } from "./markush/capture.ts"
export { pickSite, sitesOf, sitesProblem, sitesShown, sketchedPiece } from "./markush/sketch.ts"

export { createEditor, type Editor } from "./state/editor.ts"
export { createEditorStore, type EditorSnapshot, type EditorStore } from "./state/store.ts"
export { canTransform, statusOf } from "./state/status.ts"
export { placeDrawing } from "./state/placeDrawing.ts"
export { createHotspot, resolveTarget, type Hotspot } from "./pointer/hotspot.ts"
export { allCommands, command, type Command, type CommandOptions, type CommandTable } from "./commands/command.ts"
export { routeFieldKey, routeKey, type KeyEvent, type KeyRoutes } from "./keys/router.ts"
export { pointerDown, pointerMove, pointerUp } from "./gestures/index.ts"
export { ringHint, type RingHintShape } from "./gestures/hints.ts"
export type { Gesture, GestureContext, PointerHost, PointerInput, Preview } from "./gestures/types.ts"
