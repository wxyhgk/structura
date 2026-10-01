/**
 * Every combination of one index per wheel, `sizes[i]` positions on wheel i, the last
 * wheel turning fastest. No wheels make one empty combination; a wheel with no positions
 * makes none. Each combination is a fresh array, so callers may keep it.
 */
export function* odometer(sizes: readonly number[]): Generator<number[]> {
  if (sizes.some((size) => size <= 0)) return
  const index = sizes.map(() => 0)
  for (;;) {
    yield [...index]
    let at = sizes.length - 1
    for (; at >= 0; at--) {
      index[at]++
      if (index[at] < sizes[at]) break
      index[at] = 0
    }
    if (at < 0) return
  }
}
