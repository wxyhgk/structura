import { emptyMolecule } from "./molecule/graph.ts"
import { readMolfile } from "./molfile/read.ts"
import type { Molecule } from "./types.ts"
import type { Problem } from "./validate.ts"

export { readMolfile }

export type MolRecord = {
  mol: Molecule
  title: string
  /** SDF data items, such as `> <name>`, in file order. */
  properties: Record<string, string>
  problems: Problem[]
}

/** Reads every record of an SDF file, or a single molfile. */
export function readSdf(text: string): MolRecord[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const records: MolRecord[] = []
  let start = 0
  for (let index = 0; index <= lines.length; index++) {
    if (index < lines.length && lines[index].trim() !== "$$$$") continue
    const chunk = lines.slice(start, index)
    start = index + 1
    if (chunk.every((line) => line.trim() === "")) continue
    const end = chunk.findIndex((line) => line.startsWith("M  END"))
    const molLines = end === -1 ? chunk : chunk.slice(0, end + 1)
    let read: ReturnType<typeof readMolfile>
    try {
      read = readMolfile(molLines.join("\n"))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      read = { mol: emptyMolecule(), title: (chunk[0] ?? "").trim(), problems: [{ code: "bad-molfile", severity: "error", message: `could not read this record: ${message}` }] }
    }
    const properties: Record<string, string> = {}
    if (end !== -1) {
      let name: string | null = null
      let value: string[] = []
      for (const line of chunk.slice(end + 1)) {
        const header = /^>.*<([^>]*)>/.exec(line)
        if (header) {
          name = header[1]
          value = []
        } else if (name != null && line.trim() === "") {
          properties[name] = value.join("\n")
          name = null
        } else if (name != null) {
          value.push(line)
        }
      }
      if (name != null) properties[name] = value.join("\n")
    }
    const number = records.length + 1
    records.push({ ...read, properties, problems: read.problems.map((problem) => ({ ...problem, record: number })) })
  }
  return records
}
