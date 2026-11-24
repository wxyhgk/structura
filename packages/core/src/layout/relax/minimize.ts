/** Energy at x; writes the gradient into `grad`. */
export type Objective = (x: Float64Array, grad: Float64Array) => number

export type MinimizeOptions = {
  iterations: number
  /** Stop once no gradient component is larger than this. */
  tolerance: number
  /** Largest move of any single coordinate in one step, so a bad start cannot fling atoms away. */
  maxStep: number
}

const MEMORY = 6

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0
  for (let index = 0; index < a.length; index++) sum += a[index] * b[index]
  return sum
}

function largest(values: Float64Array): number {
  let most = 0
  for (const value of values) most = Math.max(most, Math.abs(value))
  return most
}

function negated(values: Float64Array): Float64Array {
  const out = new Float64Array(values.length)
  for (let k = 0; k < values.length; k++) out[k] = -values[k]
  return out
}

/** Search direction from the last few steps (L-BFGS two-loop recursion). */
function direction(grad: Float64Array, steps: Float64Array[], changes: Float64Array[]): Float64Array {
  const d = negated(grad)
  const alphas = new Float64Array(steps.length)
  for (let index = steps.length - 1; index >= 0; index--) {
    const alpha = dot(steps[index], d) / dot(changes[index], steps[index])
    alphas[index] = alpha
    for (let k = 0; k < d.length; k++) d[k] -= alpha * changes[index][k]
  }
  if (steps.length > 0) {
    const last = steps.length - 1
    const scale = dot(steps[last], changes[last]) / dot(changes[last], changes[last])
    for (let k = 0; k < d.length; k++) d[k] *= scale
  }
  for (let index = 0; index < steps.length; index++) {
    const beta = dot(changes[index], d) / dot(changes[index], steps[index])
    for (let k = 0; k < d.length; k++) d[k] += steps[index][k] * (alphas[index] - beta)
  }
  return d
}

/**
 * L-BFGS with a backtracking line search: every accepted step lowers the energy, the
 * iteration count is capped, and there is no randomness, so the same start gives the same end.
 */
export function minimize(f: Objective, start: Float64Array, options: MinimizeOptions): Float64Array {
  let x = new Float64Array(start)
  let grad = new Float64Array(x.length)
  let energy = f(x, grad)
  const steps: Float64Array[] = []
  const changes: Float64Array[] = []

  for (let iteration = 0; iteration < options.iterations; iteration++) {
    if (largest(grad) < options.tolerance) break
    let d = direction(grad, steps, changes)
    let slope = dot(grad, d)
    if (!(slope < 0)) {
      steps.length = 0
      changes.length = 0
      d = negated(grad)
      slope = dot(grad, d)
    }
    let t = Math.min(1, options.maxStep / Math.max(largest(d), 1e-12))
    const next = new Float64Array(x.length)
    const nextGrad = new Float64Array(x.length)
    let nextEnergy = Infinity
    for (let tries = 0; tries < 30; tries++) {
      for (let k = 0; k < x.length; k++) next[k] = x[k] + t * d[k]
      nextEnergy = f(next, nextGrad)
      if (nextEnergy <= energy + 1e-4 * t * slope) break
      t *= 0.5
    }
    if (!(nextEnergy < energy)) break

    const step = new Float64Array(x.length)
    const change = new Float64Array(x.length)
    for (let k = 0; k < x.length; k++) {
      step[k] = next[k] - x[k]
      change[k] = nextGrad[k] - grad[k]
    }
    if (dot(step, change) > 1e-12) {
      steps.push(step)
      changes.push(change)
      if (steps.length > MEMORY) {
        steps.shift()
        changes.shift()
      }
    }
    const settled = energy - nextEnergy < 1e-12 * Math.max(1, energy)
    x = next
    grad = nextGrad
    energy = nextEnergy
    if (settled) break
  }
  return x
}
