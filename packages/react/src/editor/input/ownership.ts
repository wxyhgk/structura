import { useRef, useState, type SyntheticEvent } from "react"
import { useWindowListener } from "./useWindowListener.ts"

/** True for an event aimed at the page itself (nothing focused), not at an element on it. */
export function onPage(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return true
  const doc = target.ownerDocument
  return doc == null || target === doc.body || target === doc.documentElement
}

/**
 * Decides which keys, pastes and copies are this editor's, so it can share a page with other
 * widgets. An event is the editor's when it comes from inside it, its dialogs and menus
 * included (they portal out of its DOM, so the root marks events on their way down the React
 * tree), or when it goes to the bare page and the editor was the last thing clicked or
 * focused. The editor starts out engaged, so a full-page app takes keys before any click.
 */
export function useOwnership() {
  const [marked] = useState(() => new WeakSet<Event>())
  const engaged = useRef(true)

  const engage = (event: Event) => {
    if (marked.has(event)) engaged.current = true
    else if (!onPage(event.target)) engaged.current = false
  }
  useWindowListener("pointerdown", engage)
  useWindowListener("focusin", engage)

  return {
    owns: (event: Event) => marked.has(event) || (onPage(event.target) && engaged.current),
    /** For the root's capture handlers: the event passed through this editor. */
    mark: (event: SyntheticEvent) => {
      marked.add(event.nativeEvent)
    },
  }
}
