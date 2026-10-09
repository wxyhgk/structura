import { memo } from "react"
import { attachmentMarks, type AtomLabel } from "@structura/core/draw"
import type { Molecule } from "@structura/core/types"
import type { Attachment } from "@structura/markush"

/**
 * Variable points of attachment: one line from the atom into the middle of its candidate
 * atoms (a ring's centre), the way patents draw "attached at any free position"; a repeated
 * one is written (R1)m. The geometry is core's, the same as in every export.
 */
export const AttachmentLines = memo(function AttachmentLines({
  mol,
  attachments,
  labels,
}: {
  mol: Molecule
  attachments: Attachment[] | undefined
  labels: AtomLabel[]
}) {
  const marks = attachmentMarks(mol, attachments, labels)
  if (marks.length === 0) return null
  return (
    <g data-testid="attachments">
      {marks.map((mark) => (
        <g key={mark.atom}>
          <line x1={mark.from.x} y1={mark.from.y} x2={mark.to.x} y2={mark.to.y} stroke="#222" strokeWidth={1.55} strokeLinecap="round" />
          {mark.texts.length > 0 && (
            <g data-testid="repeat-marks">
              {mark.texts.map((text, index) => (
                <text
                  key={index}
                  x={text.x}
                  y={text.y}
                  fill={text.color}
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize={text.size}
                  fontStyle={text.italic ? "italic" : undefined}
                  textAnchor={text.anchor}
                  dominantBaseline="central"
                >
                  {text.text}
                </text>
              ))}
            </g>
          )}
        </g>
      ))}
    </g>
  )
})
