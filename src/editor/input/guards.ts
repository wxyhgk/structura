import type { MouseEvent as ReactMouseEvent } from "react"
import { OVERLAY_MARK } from "@/editor/input/overlays"

const OVERLAY = "[data-slot=dialog-content], [data-slot=dropdown-menu-content]"

/**
 * True when a key belongs to something other than the drawing: typing in a field, or a
 * dialog or menu of this editor that is open. Every key, paste and copy checks this first.
 */
export function editorKeysBlocked(event: Event, overlayScope: string): boolean {
  if (inTextField(event)) return true
  // A key pressed inside an open menu or dialog is its own, and so is the Escape that
  // closes one (by the time it bubbles here the menu already reads as closed).
  const overlay = event.target instanceof Element ? event.target.closest(OVERLAY) : null
  if (overlay && (overlay.getAttribute("data-state") === "open" || (event as KeyboardEvent).key === "Escape")) return true
  // A menu still fading out after it closed no longer owns the keys.
  return document.querySelector(`[${OVERLAY_MARK}="${overlayScope}"][data-state=open]`) != null
}

/** True when the key goes to a text field, where the browser's own editing keys belong. */
export function inTextField(event: Event): boolean {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLElement && target.isContentEditable
}

/**
 * Keeps the editor's buttons from holding focus after a click, so a later Enter or Space
 * goes to the drawing instead of pressing the last button again. Keyboard focus (Tab)
 * still works, and buttons inside dialogs and menus behave normally.
 */
export function keepFocusOffToolbar(event: ReactMouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest("button")) return
  if (target.closest(OVERLAY)) return
  event.preventDefault()
}
