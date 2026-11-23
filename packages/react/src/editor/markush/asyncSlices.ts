/** How long one slice of work may hold the page before it gets its turn. */
const SLICE_MS = 12

/**
 * Runs `each` over `items` in short slices, yielding to the page between them, so a long
 * list (RDKit over a thousand compounds) never freezes it. `cancelled` is asked before every
 * item; `onSlice` hears how many are done after each slice. Resolves true when every item
 * was handled, false when cancelled first. An item that throws ends the run with that error.
 */
export async function inSlices<T>(items: readonly T[], each: (item: T) => void, { cancelled = () => false, onSlice }: { cancelled?: () => boolean; onSlice?: (done: number) => void } = {}): Promise<boolean> {
  let index = 0
  while (index < items.length) {
    if (cancelled()) return false
    const end = performance.now() + SLICE_MS
    do {
      each(items[index++])
    } while (index < items.length && performance.now() < end && !cancelled())
    onSlice?.(index)
    if (index < items.length) await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  return !cancelled()
}
