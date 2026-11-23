/** What one slice of a generation came to: where it got to, or how it failed (with the last step it made, if any). */
export type Slice<T, R> = { step: IteratorResult<T, R>; error?: undefined } | { error: string; last: IteratorResult<T, R> | null }

/**
 * Runs `steps` until it is done or `keepGoing` says to give the page its turn. A step that
 * throws ends the slice with the error in words, instead of escaping from a timer where nothing would show it.
 */
export function runSlice<T, R>(steps: Iterator<T, R>, keepGoing: () => boolean): Slice<T, R> {
  let last: IteratorResult<T, R> | null = null
  try {
    let step = steps.next()
    last = step
    while (!step.done && keepGoing()) {
      step = steps.next()
      last = step
    }
    return { step }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), last }
  }
}
