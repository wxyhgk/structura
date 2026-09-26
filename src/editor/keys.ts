/**
 * True when a key belongs to something other than the drawing: typing in a field, or a
 * dialog or menu that is open. Editor and canvas shortcuts both check this first.
 */
export function editorKeysBlocked(event: Event): boolean {
  if (inTextField(event)) return true
  return document.querySelector("[data-slot=dialog-content], [data-slot=dropdown-menu-content]") != null
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
