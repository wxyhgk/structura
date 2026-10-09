import { structureMarks } from "@structura/core/draw"
import { DEFAULT_REPEAT } from "@structura/core/drawing"
import type { Bracket, Molecule } from "@structura/core/types"
import type { Attachment } from "@structura/markush"
import type { Preview } from "./types.ts"

/** The bracket being previewed, told apart from the drawing's own (whose ids start at 1). */
const PREVIEW_ID = -1

/**
 * The bracket tool's box while it is dragged, and the bracket it would make round the atoms
 * inside, drawn as it will be (core's geometry, beside the drawing's other marks).
 */
export function BracketPreview({ preview, mol, attachments, brackets }: { preview: Extract<Preview, { kind: "bracket" }>; mol: Molecule; attachments?: Attachment[]; brackets?: Bracket[] }) {
  const { a, b } = preview
  const candidate: Bracket = { id: PREVIEW_ID, atoms: preview.atoms, kind: preview.bracketKind, ...(preview.bracketKind === "repeat" ? { repeat: DEFAULT_REPEAT } : {}) }
  const mark = preview.atoms.length > 0 ? structureMarks(mol, attachments, [...(brackets ?? []), candidate]).brackets.find((item) => item.id === PREVIEW_ID) : undefined
  return (
    <g data-testid="bracket-preview">
      <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="rgba(26, 115, 232, 0.06)" stroke="#1a73e8" strokeDasharray="4 3" />
      {mark?.figures.map((figure, index) => (
        <polyline key={index} points={figure.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#1a73e8" strokeWidth={figure.width} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {mark?.text && (
        <text x={mark.text.x} y={mark.text.y} fill="#1a73e8" fontFamily="Arial, Helvetica, sans-serif" fontSize={mark.text.size} fontStyle="italic" textAnchor={mark.text.anchor} dominantBaseline="central">
          {mark.text.text}
        </text>
      )}
    </g>
  )
}
