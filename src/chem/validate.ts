import { atomHydrogens } from "./formula.ts"
import type { Drawing, Molecule } from "./types.ts"

export type ProblemCode =
  | "duplicate-id"
  | "id-not-below-counter"
  | "bad-coordinate"
  | "dangling-bond"
  | "self-bond"
  | "duplicate-bond"
  | "stereo-on-multiple-bond"
  | "look-on-special-bond"
  | "valence"

/**
 * Errors break an invariant the rest of the code relies on.
 * Warnings are chemistry a half-drawn structure is allowed to have.
 */
export type Problem = {
  code: ProblemCode
  severity: "error" | "warning"
  atoms?: number[]
  bonds?: number[]
  arrows?: number[]
  message: string
}

const WEDGES = new Set(["up", "down", "either"])

export function validate(mol: Molecule): Problem[] {
  const problems: Problem[] = []
  const atomIds = new Set<number>()
  for (const atom of mol.atoms) {
    if (atomIds.has(atom.id)) {
      problems.push({ code: "duplicate-id", severity: "error", atoms: [atom.id], message: `atom #${atom.id} appears twice` })
    }
    atomIds.add(atom.id)
    if (atom.id >= mol.nextAtomId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        atoms: [atom.id],
        message: `atom #${atom.id} is not below nextAtomId ${mol.nextAtomId}`,
      })
    }
    if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y)) {
      problems.push({ code: "bad-coordinate", severity: "error", atoms: [atom.id], message: `atom #${atom.id} has a non-finite coordinate` })
    }
  }

  const bondIds = new Set<number>()
  const pairs = new Map<string, number>()
  for (const bond of mol.bonds) {
    if (bondIds.has(bond.id)) {
      problems.push({ code: "duplicate-id", severity: "error", bonds: [bond.id], message: `bond #${bond.id} appears twice` })
    }
    bondIds.add(bond.id)
    if (bond.id >= mol.nextBondId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        bonds: [bond.id],
        message: `bond #${bond.id} is not below nextBondId ${mol.nextBondId}`,
      })
    }
    if (bond.a === bond.b) {
      problems.push({ code: "self-bond", severity: "error", bonds: [bond.id], atoms: [bond.a], message: `bond #${bond.id} joins atom #${bond.a} to itself` })
      continue
    }
    const missing = [bond.a, bond.b].filter((id) => !atomIds.has(id))
    if (missing.length > 0) {
      problems.push({
        code: "dangling-bond",
        severity: "error",
        bonds: [bond.id],
        atoms: missing,
        message: `bond #${bond.id} points at missing atom ${missing.map((id) => `#${id}`).join(", ")}`,
      })
    }
    const key = bond.a < bond.b ? `${bond.a}-${bond.b}` : `${bond.b}-${bond.a}`
    const first = pairs.get(key)
    if (first != null) {
      problems.push({
        code: "duplicate-bond",
        severity: "error",
        bonds: [first, bond.id],
        atoms: [bond.a, bond.b],
        message: `bonds #${first} and #${bond.id} both join #${bond.a} and #${bond.b}`,
      })
    } else {
      pairs.set(key, bond.id)
    }
    if (bond.order !== 1 && WEDGES.has(bond.stereo)) {
      problems.push({
        code: "stereo-on-multiple-bond",
        severity: "error",
        bonds: [bond.id],
        message: `bond #${bond.id} has order ${bond.order} and stereo "${bond.stereo}"`,
      })
    }
    if (bond.look && (bond.order !== 1 || bond.stereo !== "none")) {
      problems.push({
        code: "look-on-special-bond",
        severity: "error",
        bonds: [bond.id],
        message: `bond #${bond.id} has look "${bond.look}" but is not a plain single bond`,
      })
    }
  }

  for (const atom of mol.atoms) {
    if (!atomHydrogens(mol, atom.id).error) continue
    problems.push({ code: "valence", severity: "warning", atoms: [atom.id], message: `atom #${atom.id} (${atom.el}) exceeds its valence` })
  }
  return problems
}

export function validateDrawing(drawing: Drawing): Problem[] {
  const problems = validate(drawing.molecule)
  const ids = new Set<number>()
  for (const arrow of drawing.arrows) {
    if (ids.has(arrow.id)) {
      problems.push({ code: "duplicate-id", severity: "error", arrows: [arrow.id], message: `arrow #${arrow.id} appears twice` })
    }
    ids.add(arrow.id)
    if (arrow.id >= drawing.nextArrowId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        arrows: [arrow.id],
        message: `arrow #${arrow.id} is not below nextArrowId ${drawing.nextArrowId}`,
      })
    }
    if (![arrow.x1, arrow.y1, arrow.x2, arrow.y2].every(Number.isFinite)) {
      problems.push({ code: "bad-coordinate", severity: "error", arrows: [arrow.id], message: `arrow #${arrow.id} has a non-finite coordinate` })
    }
  }
  return problems
}

export function errorsOf(problems: Problem[]): Problem[] {
  return problems.filter((problem) => problem.severity === "error")
}
