import type { Objective } from "./minimize.ts"
import type { Setup } from "./setup.ts"
import type { Springs } from "./springs.ts"

/** Unbonded atoms nearer than this many bond lengths push apart. */
const REACH = 1
const PUSH = 4
/** Pull back towards where each atom started, so the result still looks like what was drawn. */
const TETHER = 0.02
const SPLIT = { x: Math.cos(1), y: Math.sin(1) }

/** Every atom's position for the parameters `q`, in bond lengths. */
export function positionsFor(setup: Setup, q: Float64Array, out = Float64Array.from(setup.start)): Float64Array {
  for (const body of setup.bodies) {
    const tx = q[body.offset]
    const ty = q[body.offset + 1]
    if (!body.rigid) {
      const at = body.members[0]
      out[at * 2] = setup.start[at * 2] + tx
      out[at * 2 + 1] = setup.start[at * 2 + 1] + ty
      continue
    }
    const turn = q[body.offset + 2] / body.radius
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    for (const at of body.members) {
      const rx = setup.start[at * 2] - body.cx
      const ry = setup.start[at * 2 + 1] - body.cy
      out[at * 2] = body.cx + tx + rx * cos - ry * sin
      out[at * 2 + 1] = body.cy + ty + rx * sin + ry * cos
    }
  }
  return out
}

/** Pairs are listed out to this much beyond REACH, so the list survives small moves. */
const SKIN = 0.6
const CELL = REACH + SKIN

type Grid = Map<number, number[]>

const cellKey = (cx: number, cy: number) => (cx + 1_000_000) * 2_000_003 + (cy + 1_000_000)

function gridOf(pos: Float64Array, atoms: number[]): Grid {
  const grid: Grid = new Map()
  for (const at of atoms) {
    const key = cellKey(Math.floor(pos[at * 2] / CELL), Math.floor(pos[at * 2 + 1] / CELL))
    const cell = grid.get(key)
    if (cell) cell.push(at)
    else grid.set(key, [at])
  }
  return grid
}

/**
 * The energy the relaxer minimises: springs, a push between unbonded atoms that come too
 * close, and a weak tether. Atoms in the same rigid body never push each other. Pairs that
 * might push are found through a grid and kept until some atom has moved far enough to
 * make the list stale, so each evaluation is a flat loop even in a big drawing.
 */
export function objective(setup: Setup, springs: Springs, close: Set<number>): Objective {
  const count = setup.ids.length
  const moving = setup.bodies.flatMap((body) => body.members)
  const pushing = moving.filter((at) => setup.visible[at])
  const isMoving = new Uint8Array(count)
  for (const at of moving) isMoving[at] = 1
  const still = setup.ids.map((_, at) => at).filter((at) => !isMoving[at] && setup.visible[at])
  const stillGrid = gridOf(setup.start, still)
  const pos = Float64Array.from(setup.start)
  const grad = new Float64Array(count * 2)
  const listedAt = new Float64Array(count * 2)
  let pairs: number[] = []
  let listed = false

  const mayPush = (a: number, b: number) => setup.body[a] !== setup.body[b] && !close.has(Math.min(a, b) * count + Math.max(a, b))

  const relist = () => {
    pairs = []
    const movingGrid = gridOf(pos, pushing)
    for (const a of pushing) {
      const cx = Math.floor(pos[a * 2] / CELL)
      const cy = Math.floor(pos[a * 2 + 1] / CELL)
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          const key = cellKey(x, y)
          for (const b of stillGrid.get(key) ?? []) if (mayPush(a, b)) pairs.push(a, b)
          for (const b of movingGrid.get(key) ?? []) if (b > a && mayPush(a, b)) pairs.push(a, b)
        }
      }
    }
    for (const at of pushing) {
      listedAt[at * 2] = pos[at * 2]
      listedAt[at * 2 + 1] = pos[at * 2 + 1]
    }
    listed = true
  }

  /** Whether some atom may have come within reach of one not on the list. */
  const stale = () => {
    if (!listed) return true
    const limit = (SKIN / 2) * (SKIN / 2)
    for (const at of pushing) {
      const dx = pos[at * 2] - listedAt[at * 2]
      const dy = pos[at * 2 + 1] - listedAt[at * 2 + 1]
      if (dx * dx + dy * dy > limit) return true
    }
    return false
  }

  return (q, gq) => {
    positionsFor(setup, q, pos)
    grad.fill(0)
    let energy = 0

    for (let index = 0; index < springs.a.length; index++) {
      const a = springs.a[index]
      const b = springs.b[index]
      const dx = pos[a * 2] - pos[b * 2]
      const dy = pos[a * 2 + 1] - pos[b * 2 + 1]
      const d = Math.hypot(dx, dy)
      const stretch = d - springs.length[index]
      energy += springs.weight[index] * stretch * stretch
      if (d < 1e-9) continue
      const scale = (2 * springs.weight[index] * stretch) / d
      grad[a * 2] += scale * dx
      grad[a * 2 + 1] += scale * dy
      grad[b * 2] -= scale * dx
      grad[b * 2 + 1] -= scale * dy
    }

    if (stale()) relist()
    for (let index = 0; index < pairs.length; index += 2) {
      const a = pairs[index]
      const b = pairs[index + 1]
      const dx = pos[a * 2] - pos[b * 2]
      const dy = pos[a * 2 + 1] - pos[b * 2 + 1]
      const d2 = dx * dx + dy * dy
      if (d2 >= REACH * REACH) continue
      const d = Math.sqrt(d2)
      const overlap = REACH - d
      // Atoms sitting exactly on each other still need a way apart. One shared direction
      // (the later atom always goes the same way) slides a doubled-up chain off sideways
      // in one piece instead of tangling it.
      const side = a < b ? 1 : -1
      const ux = d > 1e-9 ? dx / d : side * SPLIT.x
      const uy = d > 1e-9 ? dy / d : side * SPLIT.y
      const force = 2 * PUSH * overlap
      grad[a * 2] -= force * ux
      grad[a * 2 + 1] -= force * uy
      grad[b * 2] += force * ux
      grad[b * 2 + 1] += force * uy
      energy += PUSH * overlap * overlap
    }

    for (const at of moving) {
      const dx = pos[at * 2] - setup.start[at * 2]
      const dy = pos[at * 2 + 1] - setup.start[at * 2 + 1]
      energy += TETHER * (dx * dx + dy * dy)
      grad[at * 2] += 2 * TETHER * dx
      grad[at * 2 + 1] += 2 * TETHER * dy
    }

    for (const body of setup.bodies) {
      let gx = 0
      let gy = 0
      let turn = 0
      for (const at of body.members) {
        gx += grad[at * 2]
        gy += grad[at * 2 + 1]
        if (body.rigid) {
          const rx = pos[at * 2] - body.cx - q[body.offset]
          const ry = pos[at * 2 + 1] - body.cy - q[body.offset + 1]
          turn += -ry * grad[at * 2] + rx * grad[at * 2 + 1]
        }
      }
      gq[body.offset] = gx
      gq[body.offset + 1] = gy
      if (body.rigid) gq[body.offset + 2] = turn / body.radius
    }
    return energy
  }
}
