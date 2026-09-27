const OVERLAY = "[data-slot=dialog-content], [data-slot=dropdown-menu-content]"
const OPEN_OVERLAY = "[data-slot=dialog-content][data-state=open], [data-slot=dropdown-menu-content][data-state=open]"

/**
 * True when a key belongs to something other than the drawing: typing in a field, or a
 * dialog or menu that is open. Editor and canvas shortcuts both check this first.
 */
export function editorKeysBlocked(event: Event): boolean {
  if (inTextField(event)) return true
  // A key pressed inside an open menu or dialog is its own, and so is the Escape that
  // closes one (by the time it bubbles here the menu already reads as closed).
  const overlay = event.target instanceof Element ? event.target.closest(OVERLAY) : null
  if (overlay && (overlay.getAttribute("data-state") === "open" || (event as KeyboardEvent).key === "Escape")) return true
  // A menu still fading out after it closed no longer owns the keys.
  return document.querySelector(OPEN_OVERLAY) != null
}

/** True when the key goes to a text field, where the browser's own editing keys belong. */
export function inTextField(event: Event): boolean {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLElement && target.isContentEditable
}

/**
 * Keeps toolbar buttons from holding focus after a click, so a later Enter or Space goes
 * to the drawing instead of pressing the last button again. Keyboard focus (Tab) still
 * works, and buttons inside dialogs and menus behave normally.
 */
export function keepFocusOffToolbar(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest("button")) return
  if (target.closest("[data-slot=dialog-content], [data-slot=dropdown-menu-content]")) return
  event.preventDefault()
}
