import type { ReactNode } from "react"
import type { AttachmentShape } from "@structura/markush"
import type { BondStyle, Bracket, RingKind } from "@structura/core/types"

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function LassoIcon() {
  return (
    <Frame>
      <path d="M8 5.5c2.8-2 7.2-.4 7.6 3.2.4 3.6-2.2 5-4.2 4.2-1.6-.6-1.2-2.6.2-2.8 1.8-.3 3.2 1.6 2.2 3.6-1.6 3.2-6.6 4.4-9.2 1.2C2.2 12.2 3 8 5.2 6.6" />
    </Frame>
  )
}

export function MarqueeIcon() {
  return (
    <Frame>
      <path strokeDasharray="2.2 1.8" d="M5 6.5h14v11H5z" />
    </Frame>
  )
}

export function BondIcon({ style }: { style: BondStyle }) {
  if (style.stereo === "up") {
    return (
      <Frame>
        <path d="M5 12 L19 7.2 L19 16.8 Z" fill="currentColor" stroke="none" />
      </Frame>
    )
  }
  if (style.stereo === "down") {
    return (
      <Frame>
        <path d="M6 12h2.2M9.2 10.6h2.2M12.4 9.2h2.2M15.6 7.8h2.2" />
      </Frame>
    )
  }
  if (style.stereo === "either") {
    return (
      <Frame>
        <path d="M4 12c1.2-2.4 2.2-2.4 3.2 0s2 2.4 3.2 0 2-2.4 3.2 0 2 2.4 3.2 0 2.2-2.4 3.2 0" />
      </Frame>
    )
  }
  if (style.order === 3) {
    return (
      <Frame>
        <path d="M5 8h14M5 12h14M5 16h14" />
      </Frame>
    )
  }
  if (style.order === 2) {
    return (
      <Frame>
        <path d="M5 9.2h14M5 14.8h14" />
      </Frame>
    )
  }
  return (
    <Frame>
      <path d="M4.5 12h15" />
    </Frame>
  )
}

export function ChainIcon() {
  return (
    <Frame>
      <path d="M3 16.5 7.5 8l4 8 4-8 4 8" />
    </Frame>
  )
}

function polygonPoints(sides: number, radius: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides
    const x = 12 + radius * Math.cos(angle)
    const y = 12 + radius * Math.sin(angle)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(" ")
}

export function RingIcon({ kind }: { kind: RingKind }) {
  const sides =
    kind === "cyclopropane"
      ? 3
      : kind === "cyclobutane"
        ? 4
        : kind === "cyclopentane" || kind === "cyclopentene"
          ? 5
          : kind === "cycloheptane"
            ? 7
            : kind === "cyclooctane"
              ? 8
              : 6
  return (
    <Frame>
      <polygon points={polygonPoints(sides, 7.2)} />
      {kind === "benzene" && (
        <polygon points={polygonPoints(6, 4.1)} strokeWidth="1.2" />
      )}
    </Frame>
  )
}

export function EraserIcon() {
  return (
    <Frame>
      <path d="M14.5 5.5 19 10l-6.2 6.2H8.2L4.8 12.8a1.6 1.6 0 0 1 0-2.3L12.2 5.5a1.6 1.6 0 0 1 2.3 0Z" />
      <path d="M8.2 16.2h10" />
    </Frame>
  )
}

export function ChargePlusIcon() {
  return (
    <Frame>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Frame>
  )
}

export function ChargeMinusIcon() {
  return (
    <Frame>
      <circle cx="12" cy="12" r="7" />
      <path d="M8.5 12h7" />
    </Frame>
  )
}

/** Square brackets round a ring; a repeat unit's round a stretch of chain, its n at the lower right. */
export function BracketIcon({ kind }: { kind: Bracket["kind"] }) {
  if (kind === "repeat") {
    return (
      <Frame>
        <path d="M7.2 4.5H5v15h2.2M13.8 4.5H16v15h-2.2" />
        <path d="M2 13.6 5.8 10.4l3.8 3.2 3.8-3.2 3.8 3.2" strokeWidth="1.4" />
        <text x="20.6" y="20.6" fontSize="8" fontStyle="italic" fontFamily="Arial, Helvetica, sans-serif" textAnchor="middle" fill="currentColor" stroke="none">
          n
        </text>
      </Frame>
    )
  }
  return (
    <Frame>
      <path d="M7 4H4.5v16H7M17 4h2.5v16H17" />
      <polygon points={hexagonAt(12, 12, 4.4)} strokeWidth="1.3" />
    </Frame>
  )
}

/** A small hexagon, flat sides left and right, round a centre. */
function hexagonAt(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`
  }).join(" ")
}

/**
 * A variable attachment, drawn the way `shape` draws it: a line into the ring's middle, a
 * line to an ellipse round it, the bond sweeping round it; "auto" (the flyout's 自动) a
 * dashed ring round it, as it is up to the drawing.
 */
export function AttachIcon({ shape }: { shape: AttachmentShape | "auto" }) {
  if (shape === "line") {
    return (
      <Frame>
        <polygon points={hexagonAt(14, 11, 6.4)} strokeWidth="1.3" />
        <path d="M2 11h12" />
      </Frame>
    )
  }
  // Kept up and to the left, clear of the flyout's caret in the button's corner.
  const ring = <polygon points={hexagonAt(14, 11, 4)} strokeWidth="1.2" />
  if (shape === "arc" || shape === "bracket") {
    return (
      <Frame>
        {ring}
        <path d="M2 11h5.4a6.6 6.6 0 1 1 5.45 6.5" />
      </Frame>
    )
  }
  return (
    <Frame>
      {ring}
      <path d="M2 11h5.4" />
      <circle cx="14" cy="11" r="6.6" strokeDasharray={shape === "auto" ? "2.2 1.8" : undefined} />
    </Frame>
  )
}

export function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <polygon
        points={polygonPoints(6, 8)}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
