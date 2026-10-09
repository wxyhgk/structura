import { memo } from "react"
import type { AttachmentMark } from "@structura/core/draw"

/**
 * Variable points of attachment, the way patents draw "attached at any free position": a
 * line into one ring's middle, an ellipse round a fused system with a line to it, or the
 * bond sweeping round the system; a repeated one is written (R1)m. The geometry is core's
 * (structureMarks), the same as in every export.
 */
export const AttachmentLines = memo(function AttachmentLines({ marks }: { marks: AttachmentMark[] }) {
  if (marks.length === 0) return null
  return (
    <g data-testid="attachments">
      {marks.map((mark) => (
        <g key={mark.atom} data-shape={mark.shape}>
          <path d={mark.path} fill="none" stroke="#222" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" />
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
