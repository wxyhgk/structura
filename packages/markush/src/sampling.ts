// Visiting a numbered set of things in a scattered order that stays evenly spread however
// far along you stop (the step of a golden-ratio sequence on a circle of `size` points).

function gcd(a: bigint, b: bigint): bigint {
  while (b > 0n) [a, b] = [b, a % b]
  return a
}

/**
 * A step through `size` indices, so that i·step mod size visits each of them once before any
 * repeats, and any run of them lies evenly over the whole range: near size/φ, and prime to
 * `size` (that is what makes it visit every index, and every digit of a mixed radix in turn).
 */
export function stride(size: bigint): bigint {
  if (size <= 2n) return 1n
  let step = (size * 618033988749894848n) / 1000000000000000000n
  if (step < 1n) step = 1n
  while (gcd(step, size) !== 1n) step++
  return step
}
