import { memo } from "react"
import type { BracketMark } from "@structura/core/draw"

/**
 * Square brackets round parts of the structure, drawn from where their atoms are (so they
 * follow every move), a repeat unit's count at the lower right. The geometry is core's
 * (structureMarks), the same as in every export.
 */
export const BracketMarks = memo(function BracketMarks({ marks }: { marks: BracketMark[] }) {
  if (marks.length === 0) return null
  return (
    <g data-testid="brackets">
      {marks.map((mark) => (
        <g key={mark.id} data-testid="bracket" data-kind={mark.kind}>
          {mark.figures.map((figure, index) => (
            <polyline
              key={index}
              points={figure.points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke={figure.stroke}
              strokeWidth={figure.width}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {mark.text && (
            <text
              data-testid="bracket-count"
              x={mark.text.x}
              y={mark.text.y}
              fill={mark.text.color}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={mark.text.size}
              fontStyle="italic"
              textAnchor={mark.text.anchor}
              dominantBaseline="central"
            >
              {mark.text.text}
            </text>
          )}
        </g>
      ))}
    </g>
  )
})
