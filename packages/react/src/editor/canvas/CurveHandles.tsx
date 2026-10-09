import type { AttachmentMark } from "@structura/core/draw"
import type { CurveFocus } from "@structura/engine"

/** A node's handle, in screen pixels across, whatever the zoom. */
const HANDLE = 8

/**
 * The custom attachment curve being edited: the curve lit up, and a small square on each
 * node to drag (the picked one filled). Sizes are in screen pixels, so they stay the same
 * at any zoom.
 */
export function CurveHandles({ marks, focus, zoom }: { marks: AttachmentMark[]; focus: CurveFocus; zoom: number }) {
  const mark = marks.find((item) => item.atom === focus.atom)
  if (!mark?.custom || zoom <= 0) return null
  const size = HANDLE / zoom
  return (
    <g data-testid="curve-handles">
      <path d={mark.path} fill="none" stroke="#1a73e8" strokeOpacity={0.35} strokeWidth={6 / zoom} strokeLinecap="round" strokeLinejoin="round" />
      {mark.custom.nodes.map((node, index) => (
        <rect
          key={index}
          data-testid="curve-node"
          data-index={index}
          x={node.x - size / 2}
          y={node.y - size / 2}
          width={size}
          height={size}
          fill={index === focus.node ? "#1a73e8" : "#ffffff"}
          stroke="#1a73e8"
          strokeWidth={1.2 / zoom}
        />
      ))}
    </g>
  )
}
