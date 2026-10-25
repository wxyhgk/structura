import type { MainModule } from "@rdkit/rdkit"

export type SmilesLine = { smiles: string; name: string }

/**
 * One SMILES per line, optionally followed by a name, as in .smi files. A dot inside a
 * SMILES keeps its pieces together (a salt stays one entry).
 */
export function smilesLines(text: string): SmilesLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [smiles, ...rest] = line.split(/\s+/)
      return { smiles, name: rest.join(" ") }
    })
}

/** Loose check for pasted text: every line starts with something SMILES could be. */
export function looksLikeSmiles(text: string): boolean {
  if (/^\s*M {2}END/m.test(text)) return false
  const lines = smilesLines(text)
  return lines.length > 0 && lines.every(({ smiles }) => /^[A-Za-z0-9@+\-[\]()=#$%./\\:*~]+$/.test(smiles) && /[A-Za-z]/.test(smiles))
}

/**
 * Why RDKit turned a SMILES down, as far as its log says: an unpaired parenthesis, a ring
 * number never closed, a character it cannot place (`position` counts from 1), an atom over
 * its valence, or aromatic atoms it cannot kekulize. Atoms count from 1, in SMILES order.
 */
export type SmilesFault =
  | { kind: "open-parenthesis" }
  | { kind: "close-parenthesis" }
  | { kind: "unclosed-ring" }
  | { kind: "syntax"; position: number | null }
  | { kind: "valence"; atom: number; element: string; valence: number }
  | { kind: "kekulize"; atoms: number[] }

/** The fault named in RDKit's error text (its log, or the error smilesToMolfile gives), if any. */
export function smilesFault(text: string): SmilesFault | null {
  if (/extra open parentheses/.test(text)) return { kind: "open-parenthesis" }
  if (/extra close parentheses/.test(text)) return { kind: "close-parenthesis" }
  if (/unclosed ring/.test(text)) return { kind: "unclosed-ring" }
  const valence = /Explicit valence for atom # (\d+) ([A-Za-z*]+), (\d+), is greater than permitted/.exec(text)
  // RDKit counts atoms from 0.
  if (valence) return { kind: "valence", atom: Number(valence[1]) + 1, element: valence[2], valence: Number(valence[3]) }
  const kekulize = /Can't kekulize mol\.\s+Unkekulized atoms:\s*([\d ]+)/.exec(text)
  if (kekulize) return { kind: "kekulize", atoms: kekulize[1].trim().split(/\s+/).map((atom) => Number(atom) + 1) }
  const position = /around position (\d+)/.exec(text)
  if (/syntax error/.test(text)) return { kind: "syntax", position: position ? Number(position[1]) : null }
  return null
}

/**
 * RDKit's own words for a failure, from its error log: the first message and where to look,
 * without the timestamps, the echoed SMILES and its ~~^ marker.
 */
function reasonIn(log: string): string {
  const lines = log
    .split("\n")
    .map((line) => line.replace(/^\[[\d:]+\]\s*/, "").replace(/^SMILES Parse Error:\s*/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
  if (lines.length === 0) return ""
  const where = lines.find((line) => line.startsWith("check for mistakes around position"))
  return where ? `${lines[0]}; ${where.replace(/:$/, "")}` : lines[0]
}

/**
 * Turns a SMILES into a 2D molfile with RDKit: parse, lay out (CoordGen when the module
 * prefers it), kekulize and wedge. The editor then reads the molfile like any other. When
 * RDKit cannot read it, `error` gives RDKit's reason from its error log (captured for the
 * call, so it does not also go to the console) and `fault` what kind of reason it is.
 */
export function smilesToMolfile(rdkit: MainModule, smiles: string): { molfile: string } | { error: string; fault: SmilesFault | null } {
  // A module built without log capture just gives no reason.
  const log = typeof rdkit.set_log_capture === "function" ? rdkit.set_log_capture("rdApp.error") : null
  const failed = () => {
    const reason = reasonIn(log?.get_buffer() ?? "")
    return { error: `RDKit could not read "${smiles}"${reason ? `: ${reason}` : ""}`, fault: smilesFault(reason) }
  }
  const mol = rdkit.get_mol(smiles)
  try {
    if (!mol || !mol.is_valid()) return failed()
    mol.set_new_coords(true)
    return { molfile: mol.get_molblock() }
  } finally {
    mol?.delete()
    log?.delete()
  }
}
