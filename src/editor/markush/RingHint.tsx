import type { RingHintShape } from "./hints.ts"

/**
 * Shown while drawing: letting go here makes a variable attachment, "any free position of
 * this ring". Dashed circles on the candidates and a count under the ring.
 */
export function RingHint({ hint }: { hint: RingHintShape }) {
  const reach = Math.max(...hint.positions.map((point) => Math.hypot(point.x - hint.centre.x, point.y - hint.centre.y)))
  return (
    <g data-testid="ring-hint">
      {hint.positions.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={9} fill="rgba(26, 115, 232, 0.12)" stroke="#1a73e8" strokeDasharray="3 2" />
      ))}
      <text x={hint.centre.x} y={hint.centre.y + reach + 22} textAnchor="middle" fontSize={11} fill="#1a73e8">
        任一位置（{hint.positions.length} 处）
      </text>
    </g>
  )
}
