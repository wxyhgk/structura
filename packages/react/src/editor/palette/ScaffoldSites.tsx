import { useMemo } from "react"
import { sceneToSvg } from "@structura/core/draw"
import { freeSites, type Scaffold } from "@structura/core/scaffolds"

/** Where a badge sits: a little outside its atom or bond, away from the middle of the drawing. */
function outward(x: number, y: number, by: number) {
  const length = Math.hypot(x, y) || 1
  return { x: x + (x / length) * by, y: y + (y / length) * by }
}

const SITE = "#1a73e8"
const EDGE = "#e8710a"

/**
 * The scaffold drawn large with both kinds of badge to click: round blue numbers on the
 * atoms that can join (they still carry a hydrogen), square orange letters on the outer
 * bonds that can fuse. The chosen site and the chosen bond are filled in.
 */
export function ScaffoldSites({
  scaffold,
  site,
  edge,
  onSite,
  onEdge,
}: {
  scaffold: Scaffold
  site: string
  edge: string
  onSite: (site: string) => void
  onEdge: (edge: string) => void
}) {
  const svg = useMemo(() => sceneToSvg(scaffold.molecule, true), [scaffold])
  const box = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg)!.slice(1).map(Number)
  const pad = 30
  const viewBox = `${box[0] - pad} ${box[1] - pad} ${box[2] + 2 * pad} ${box[3] + 2 * pad}`
  const atom = (id: number) => scaffold.molecule.atoms.find((item) => item.id === id)!
  const free = new Set(freeSites(scaffold))
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`).replace(/width="[^"]*" height="[^"]*"/, 'width="100%" height="100%"'))}`
  return (
    <div className="relative aspect-[4/3] w-full">
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {Object.entries(scaffold.edges).map(([letter, [a, b]]) => {
          const at = outward((atom(a).x + atom(b).x) / 2, (atom(a).y + atom(b).y) / 2, 9)
          const chosen = letter === edge
          return (
            <g key={letter} onClick={() => onEdge(letter)} className="cursor-pointer" data-testid={`edge-${letter}`}>
              <rect x={at.x - 6} y={at.y - 6} width={12} height={12} rx={2.5} fill={chosen ? EDGE : "#fff"} stroke={EDGE} strokeWidth={1.1} />
              <text x={at.x} y={at.y + 3} fontSize={8} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fill={chosen ? "#fff" : EDGE}>
                {letter}
              </text>
            </g>
          )
        })}
        {Object.entries(scaffold.atoms)
          .filter(([locant]) => free.has(locant))
          .map(([locant, id]) => {
            const at = outward(atom(id).x, atom(id).y, 19)
            const label = locant.replace(/^C/, "")
            const chosen = locant === site
            return (
              <g key={locant} onClick={() => onSite(locant)} className="cursor-pointer" data-testid={`site-${locant}`}>
                <circle cx={at.x} cy={at.y} r={8} fill={chosen ? SITE : "#fff"} stroke={SITE} strokeWidth={1.2} />
                <text x={at.x} y={at.y + 3} fontSize={label.length > 2 ? 6.5 : 8} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fill={chosen ? "#fff" : SITE}>
                  {label}
                </text>
              </g>
            )
          })}
      </svg>
    </div>
  )
}
