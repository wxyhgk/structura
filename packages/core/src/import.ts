import type { MolRecord } from "./sdf.ts"
import type { Bracket, Molecule } from "./types.ts"
import { validate, type Problem } from "./validate.ts"

export type Imported = {
  /** Records that can go on the canvas. */
  molecules: Molecule[]
  /** Each of those molecules' brackets, if its record had any (on that molecule's atom ids). */
  brackets: Array<Bracket[] | undefined>
  /** Everything worth telling the user, each tagged with its record number. */
  problems: Problem[]
  /** How many records were left out. */
  skipped: number
}

/**
 * Decides what an import adds, shared by opening a file, pasting text and SMILES. A record
 * is left out when it is empty, carries an error, or would break the molecule's invariants;
 * the user is told why either way.
 */
export function usableRecords(records: MolRecord[]): Imported {
  const molecules: Molecule[] = []
  const brackets: Array<Bracket[] | undefined> = []
  const problems: Problem[] = []
  let skipped = 0
  records.forEach((record, index) => {
    const number = index + 1
    const found = [...record.problems]
    const broken = validate(record.mol).filter((problem) => problem.severity === "error")
    for (const problem of broken) {
      if (!found.some((item) => item.message === problem.message)) found.push(problem)
    }
    const errors = found.some((problem) => problem.severity === "error")
    if (errors || record.mol.atoms.length === 0) {
      skipped++
      if (!errors) found.push({ code: "bad-molfile", severity: "error", message: "the record has no atoms" })
    } else {
      molecules.push(record.mol)
      brackets.push(record.brackets)
    }
    problems.push(...found.map((problem) => ({ ...problem, record: number })))
  })
  return { molecules, brackets, problems, skipped }
}
