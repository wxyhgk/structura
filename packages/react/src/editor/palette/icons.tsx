import type { ReactNode } from "react"
import type { BondStyle, RingKind } from "@structura/core/types"

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
