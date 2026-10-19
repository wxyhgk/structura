import { createContext, useContext, useSyncExternalStore } from "react"

// The editor's light and dark themes. Its colours are written for the light theme, the way
// they always were; dark comes from one rule, darkColor, applied to every one of them: the
// CSS variables of the interface (styles/tokens.css, generated from it) and the drawing on the
// canvas (usePaint). Files the editor writes (SVG, CDXML, Word…) stay light, whatever the theme.

/** Which theme a host asks for: "auto" follows the page (data-theme or a dark/light class on <html>), else the system. */
export type Theme = "light" | "dark" | "auto"

type Rgba = { r: number; g: number; b: number; a: number }

function parse(color: string): Rgba | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1]
    return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16), a: 1 }
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color.trim())
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) }
  return null
}

function toHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const [red, green, blue] = [r / 255, g / 255, b / 255]
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === red ? (green - blue) / d + (green < blue ? 6 : 0) : max === green ? (blue - red) / d + 2 : (red - green) / d + 4
  return { h: h * 60, s, l }
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((value) => Math.round(value * 255)) as [number, number, number]
}

const hex = (value: number) => value.toString(16).padStart(2, "0")

/**
 * A light-theme colour's dark-theme counterpart. Greys turn over (white ground to near black,
 * dark ink to light ink, mid greys stay mid); pale tints become dark tints of their hue; soft
 * colours (borders, rings) sink; strong colours lighten a little, to read on a dark ground.
 * Transparency is kept. Anything it cannot read comes back as it is.
 */
export function darkColor(color: string): string {
  const rgba = parse(color)
  if (!rgba) return color
  const { h, s, l } = toHsl(rgba)
  const spread = (Math.max(rgba.r, rgba.g, rgba.b) - Math.min(rgba.r, rgba.g, rgba.b)) / 255
  let next: { s: number; l: number }
  if (s < 0.15 || spread < 0.06) next = { s: 0, l: 1 - 0.88 * l }
  else if (l > 0.85) next = { s: s * 0.5, l: 0.16 + (1 - l) * 0.5 }
  else if (l > 0.65) next = { s: s * 0.7, l: 0.3 + (0.85 - l) * 0.5 }
  else next = { s, l: Math.min(0.72, l + 0.1) }
  const [r, g, b] = fromHsl(h, next.s, next.l)
  return rgba.a < 1 ? `rgba(${r}, ${g}, ${b}, ${rgba.a})` : `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * A colour of ink (bonds, element labels, a drawing's text) for a dark ground. Unlike
 * darkColor, which treats pale colours as grounds and darkens them, ink must stand out: greys
 * turn over as there, colours are lifted to at least medium lightness, and light colours
 * (boron's pink) stay as they are.
 */
export function darkInk(color: string): string {
  const rgba = parse(color)
  if (!rgba) return color
  const { h, s, l } = toHsl(rgba)
  const spread = (Math.max(rgba.r, rgba.g, rgba.b) - Math.min(rgba.r, rgba.g, rgba.b)) / 255
  if (s < 0.15 || spread < 0.06) return darkColor(color)
  if (l >= 0.62) return color
  const [r, g, b] = fromHsl(h, s, 0.62)
  return rgba.a < 1 ? `rgba(${r}, ${g}, ${b}, ${rgba.a})` : `#${hex(r)}${hex(g)}${hex(b)}`
}

/** Whether the editor around is dark: for the parts that portal out of it (menus, dialogs) and the canvas. */
export const DarkContext = createContext(false)

/** The class that turns the editor's colours dark (styles/tokens.css), for an element of it. */
export const darkClass = (dark: boolean) => (dark ? "chem-dark" : "")

const asIs = (color: string) => color

/** Turns a light-theme colour of the interface (a ground, a border, the selection's blue) into the current theme's. */
export function usePaint(): (color: string) => string {
  const dark = useContext(DarkContext)
  return dark ? darkColor : asIs
}

/** Turns a colour of the chemistry's ink (bonds, element labels) into the current theme's: see darkInk. */
export function useInk(): (color: string) => string {
  const dark = useContext(DarkContext)
  return dark ? darkInk : asIs
}

/** Whether the page says it is dark: data-theme="dark" or class "dark" on <html>; null when it says nothing. */
function pageSays(): boolean | null {
  const root = document.documentElement
  const named = root.getAttribute("data-theme") ?? root.getAttribute("data-color-scheme")
  if (named === "dark" || root.classList.contains("dark")) return true
  if (named === "light" || root.classList.contains("light")) return false
  return null
}

const SYSTEM_DARK = "(prefers-color-scheme: dark)"

/** Whether "auto" is dark now: the page's word if it gives one, else the system's. */
export function autoIsDark(): boolean {
  if (typeof document === "undefined") return false
  return pageSays() ?? (typeof matchMedia === "function" && matchMedia(SYSTEM_DARK).matches)
}

/** Calls `changed` whenever "auto" may have turned (the page's word, or the system's); returns the way to stop. */
export function watchAuto(changed: () => void): () => void {
  const observer = new MutationObserver(changed)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme"] })
  const media = typeof matchMedia === "function" ? matchMedia(SYSTEM_DARK) : null
  media?.addEventListener("change", changed)
  return () => {
    observer.disconnect()
    media?.removeEventListener("change", changed)
  }
}

const nothing = () => () => {}

/** Whether the editor is dark, following the page and the system live for "auto". Light on a server. */
export function useDark(theme: Theme = "light"): boolean {
  return useSyncExternalStore(
    theme === "auto" ? watchAuto : nothing,
    () => (theme === "auto" ? autoIsDark() : theme === "dark"),
    () => theme === "dark",
  )
}

/** The theme class for a menu, dialog or tooltip, which portals out of the editor's root (so does not inherit it). */
export function useOverlayTheme(): string {
  return darkClass(useContext(DarkContext))
}

/** SVG text with every fill and stroke colour turned dark, for a picture shown in the dark theme. */
export function recolorSvg(svg: string): string {
  return svg.replace(/\b(fill|stroke|stop-color)="([^"]+)"/g, (whole, attribute: string, value: string) =>
    value === "none" || value === "currentColor" || value.startsWith("url(") ? whole : `${attribute}="${darkInk(value)}"`,
  )
}

/** SVG text as an <img> source, in the theme of the editor around it. */
export function svgSource(svg: string, dark: boolean): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dark ? recolorSvg(svg) : svg)}`
}

/** The theme of the editor around, for a picture made from SVG text (see svgSource). */
export const useDarkPicture = (): boolean => useContext(DarkContext)
