import { useSyncExternalStore } from "react"

const nothingToWatch = () => () => {}

/**
 * False while the editor is rendered on a server and while React takes over that HTML in the
 * browser (hydration); true from then on, and from the first render in a page that React
 * renders itself. For what the server cannot draw as the browser will: drawn text is
 * measured with the page's fonts, which a server does not have.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    nothingToWatch,
    () => true,
    () => false,
  )
}
