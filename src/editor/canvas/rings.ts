import type { AtomLabel } from "@structura/core/draw"
import type { Atom } from "@structura/core/types"

/**
 * The circle drawn around an atom: centred on its label when it has one and just big
 * enough to enclose it, else a fixed screen-size circle on the atom.
 */
export function atomCircle(atom: Atom, label: AtomLabel | undefined, zoom: number, bare: number) {
  if (!label) return { cx: atom.x, cy: atom.y, r: bare / zoom }
  const cx = (label.box.left + label.box.right) / 2
  const cy = (label.box.top + label.box.bottom) / 2
  return { cx, cy, r: Math.hypot(label.box.right - cx, label.box.bottom - cy) + 3 / zoom }
}
