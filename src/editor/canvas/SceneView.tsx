import { memo, useMemo } from "react"
import { bondFigures, buildScene, type AtomLabel, type Figure } from "@/chem/draw"
import { atomById, atomIdsOfSelection } from "@/chem/molecule"
import type { Arrow, Molecule, Selection, ToolId } from "@/chem/types"
import { selectionFrame } from "./targeting.ts"
import type { HoverTarget, Preview } from "./types.ts"

export function SceneView({
  mol,
  arrows,
  selection,
  tool,
  zoom,
  hover,
  hotspotId,
  preview,
  colorHetero,
  showFrame,
}: {
  mol: Molecule
  arrows: Arrow[]
  selection: Selection
  tool: ToolId
  zoom: number
  hover: HoverTarget
  hotspotId: number | null
  preview: Preview
  colorHetero: boolean
  showFrame: boolean
}) {
  // Hover, previews and panning re-render often; the scene only changes with the molecule.
  const scene = useMemo(() => buildScene(mol, colorHetero), [mol, colorHetero])
  return (
    <>
      <Figures figures={scene.figures} />
      <Arrows arrows={arrows} />
      <Labels labels={scene.labels} />
      <HoverCue mol={mol} hover={hover} labels={scene.labels} zoom={zoom} />
      {hotspotId != null && !(hover?.type === "atom" && hover.id === hotspotId) && (
        <Hotspot mol={mol} id={hotspotId} labels={scene.labels} zoom={zoom} />
      )}
      {showFrame && (tool === "lasso" || tool === "marquee") && (
        <SelectionChrome mol={mol} selection={selection} labels={scene.labels} zoom={zoom} />
      )}
      {preview && <PreviewLayer preview={preview} />}
    </>
  )
}

const Arrows = memo(function Arrows({ arrows }: { arrows: Arrow[] }) {
  return (
    <>
      {arrows.map((arrow) => {
        const dx = arrow.x2 - arrow.x1
        const dy = arrow.y2 - arrow.y1
        const length = Math.hypot(dx, dy) || 1
        const ux = dx / length
        const uy = dy / length
        const head = 9
        return (
          <g key={arrow.id}>
            <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke="#222" strokeWidth={1.6} />
            <polygon
              fill="#222"
              points={`${arrow.x2},${arrow.y2} ${arrow.x2 - ux * head - uy * 4},${arrow.y2 - uy * head + ux * 4} ${arrow.x2 - ux * head + uy * 4},${arrow.y2 - uy * head - ux * 4}`}
            />
          </g>
        )
      })}
    </>
  )
})

const Figures = memo(function Figures({ figures }: { figures: Figure[] }) {
  return (
    <>
      {figures.map((figure, index) => {
        if (figure.kind === "line") {
          return (
            <line
              key={index}
              x1={figure.x1}
              y1={figure.y1}
              x2={figure.x2}
              y2={figure.y2}
              stroke={figure.stroke}
              strokeWidth={figure.width}
              strokeLinecap={figure.cap ?? "butt"}
              strokeDasharray={figure.dash}
            />
          )
        }
        if (figure.kind === "polygon") {
          return <polygon key={index} points={figure.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={figure.fill} />
        }
        return (
          <polyline
            key={index}
            points={figure.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={figure.stroke}
            strokeWidth={figure.width}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      })}
    </>
  )
})

const Labels = memo(function Labels({ labels }: { labels: AtomLabel[] }) {
  return (
    <>
      {labels.map((label) =>
        label.runs.map((run, index) => (
          <text
            key={`${label.atomId}-${index}`}
            x={run.x}
            y={run.y}
            fill={label.color}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={run.size}
            textAnchor={run.anchor}
            dominantBaseline="central"
          >
            {run.text}
          </text>
        )),
      )}
    </>
  )
})

function HoverCue({
  mol,
  hover,
  labels,
  zoom,
}: {
  mol: Molecule
  hover: HoverTarget
  labels: AtomLabel[]
  zoom: number
}) {
  if (!hover || zoom <= 0) return null
  const stroke = 1.6 / zoom
  if (hover.type === "bond") {
    const bond = mol.bonds.find((item) => item.id === hover.id)
    if (!bond) return null
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (!a || !b) return null
    return (
      <line
        data-testid="hover-bond"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#1a73e8"
        strokeOpacity={0.45}
        strokeWidth={8 / zoom}
        strokeLinecap="round"
      />
    )
  }
  const atom = atomById(mol, hover.id)
  if (!atom) return null
  const label = labels.find((item) => item.atomId === atom.id)
  const cx = label ? (label.box.left + label.box.right) / 2 : atom.x
  const cy = label ? (label.box.top + label.box.bottom) / 2 : atom.y
  const radius = label ? Math.hypot(label.box.right - cx, label.box.bottom - cy) + 3 / zoom : 12 / zoom
  return (
    <circle
      data-testid="hover-atom"
      cx={cx}
      cy={cy}
      r={radius}
      fill="rgba(26, 115, 232, 0.08)"
      stroke="#1a73e8"
      strokeWidth={stroke}
    />
  )
}

function Hotspot({
  mol,
  id,
  labels,
  zoom,
}: {
  mol: Molecule
  id: number
  labels: AtomLabel[]
  zoom: number
}) {
  const atom = atomById(mol, id)
  if (!atom || zoom <= 0) return null
  const label = labels.find((item) => item.atomId === atom.id)
  const cx = label ? (label.box.left + label.box.right) / 2 : atom.x
  const cy = label ? (label.box.top + label.box.bottom) / 2 : atom.y
  const radius = label ? Math.hypot(label.box.right - cx, label.box.bottom - cy) + 3 / zoom : 7 / zoom
  return (
    <circle
      data-testid="hotspot-atom"
      cx={cx}
      cy={cy}
      r={radius}
      fill="rgba(22, 140, 72, 0.14)"
      stroke="#168c48"
      strokeWidth={1.6 / zoom}
    />
  )
}

function SelectionChrome({
  mol,
  selection,
  labels,
  zoom,
}: {
  mol: Molecule
  selection: Selection
  labels: AtomLabel[]
  zoom: number
}) {
  const frame = selectionFrame(mol, selection)
  if (!frame) {
    const ids = atomIdsOfSelection(mol, selection)
    const atom = ids.length === 1 ? atomById(mol, ids[0]) : undefined
    if (!atom) return null
    const label = labels.find((item) => item.atomId === atom.id)
    if (label) {
      return (
        <rect
          x={label.box.left - 3}
          y={label.box.top - 3}
          width={label.box.right - label.box.left + 6}
          height={label.box.bottom - label.box.top + 6}
          fill="none"
          stroke="#8ebef2"
          strokeWidth={1.2 / zoom}
        />
      )
    }
    return <circle cx={atom.x} cy={atom.y} r={12 / zoom} fill="none" stroke="#8ebef2" strokeWidth={1.2 / zoom} />
  }
  const knob = frame.handles.find((handle) => handle.kind === "rotate")
  const size = 7 / zoom
  return (
    <g data-testid="selection-frame">
      <rect
        x={frame.minX}
        y={frame.minY}
        width={frame.maxX - frame.minX}
        height={frame.maxY - frame.minY}
        fill="none"
        stroke="#9ec9f5"
        strokeWidth={1 / zoom}
      />
      {knob && (
        <line
          x1={frame.center.x}
          y1={frame.minY}
          x2={knob.x}
          y2={knob.y}
          stroke="#9ec9f5"
          strokeWidth={1 / zoom}
        />
      )}
      {frame.handles.map((handle) => (
        <rect
          key={handle.kind}
          data-testid={handle.kind === "rotate" ? "rotate-handle" : undefined}
          x={handle.x - size / 2}
          y={handle.y - size / 2}
          width={size}
          height={size}
          fill="#ffffff"
          stroke="#7eb6ea"
          strokeWidth={1 / zoom}
        />
      ))}
    </g>
  )
}

function PreviewLayer({ preview }: { preview: Exclude<Preview, null> }) {
  if (preview.kind === "marquee") {
    const x = Math.min(preview.a.x, preview.b.x)
    const y = Math.min(preview.a.y, preview.b.y)
    return (
      <rect
        x={x}
        y={y}
        width={Math.abs(preview.b.x - preview.a.x)}
        height={Math.abs(preview.b.y - preview.a.y)}
        fill="rgba(26, 115, 232, 0.08)"
        stroke="#1a73e8"
        strokeDasharray="4 3"
      />
    )
  }
  if (preview.kind === "lasso") {
    return (
      <polyline
        points={preview.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="rgba(26, 115, 232, 0.08)"
        stroke="#1a73e8"
        strokeDasharray="4 3"
      />
    )
  }
  if (preview.kind === "bond") {
    return (
      <g opacity={0.45}>
        <Figures figures={bondFigures(preview.a, preview.b, preview.style, "#222", "#222", null, null, null)} />
      </g>
    )
  }
  const doubles = preview.kind === "ring" && preview.doubles
  return (
    <g opacity={0.45} stroke="#222" strokeWidth={1.55} fill="none">
      {preview.kind === "ring" && preview.anchor && preview.points[0] && (
        <line x1={preview.anchor.x} y1={preview.anchor.y} x2={preview.points[0].x} y2={preview.points[0].y} strokeWidth={1.55} />
      )}
      {preview.points.map((point, index) => {
        const next = preview.points[(index + 1) % preview.points.length]
        if (!next || (preview.kind === "chain" && index === preview.points.length - 1)) return null
        return (
          <line
            key={index}
            x1={point.x}
            y1={point.y}
            x2={next.x}
            y2={next.y}
            strokeWidth={doubles && index % 2 === 0 ? 3.2 : 1.55}
          />
        )
      })}
    </g>
  )
}
