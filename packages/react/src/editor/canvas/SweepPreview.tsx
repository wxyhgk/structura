import { RingHint } from "../markush/RingHint.tsx"
import type { Preview } from "./types.ts"

/**
 * The attachment tool's sweep: a line from where it started to the pointer, the rings passed
 * over shaded, and the positions the attachment will choose from with their count.
 */
export function SweepPreview({ preview }: { preview: Extract<Preview, { kind: "sweep" }> }) {
  return (
    <g data-testid="sweep-preview">
      {preview.rings.map((ring, index) => (
        <polygon
          key={index}
          data-testid="swept-ring"
          points={ring.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="rgba(26, 115, 232, 0.12)"
          stroke="#1a73e8"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ))}
      <line x1={preview.a.x} y1={preview.a.y} x2={preview.b.x} y2={preview.b.y} stroke="#1a73e8" strokeWidth={1.6} strokeLinecap="round" strokeDasharray="5 3" />
      {preview.hint && <RingHint hint={preview.hint} />}
    </g>
  )
}
