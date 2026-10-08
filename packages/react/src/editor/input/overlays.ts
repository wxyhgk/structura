import { createContext, useContext } from "react"

/** Attribute that ties a dialog or menu, which portals out of the editor's DOM, to its editor. */
export const OVERLAY_MARK = "data-editor-overlay"

/** The id of the editor that owns the dialogs and menus rendered below it. */
export const OverlayScope = createContext("")

/** Props for a dialog or menu content, so only this editor's open overlays hold its keys. */
export function useOverlayMark() {
  return { [OVERLAY_MARK]: useContext(OverlayScope) }
}
