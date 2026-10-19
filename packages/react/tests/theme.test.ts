import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { darkColor, darkInk, recolorSvg } from "../src/components/theme.ts"
import { TOKENS, tokensCss } from "../scripts/theme-tokens.ts"

/** Lightness, 0 to 1, of a #rrggbb colour. */
const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

test("dark theme colours: greys turn over, pale tints become dark tints, strong colours lighten, transparency kept", () => {
  assert.ok(lightness(darkColor("#ffffff")) < 0.15, "the white ground goes near black")
  assert.ok(lightness(darkColor("#222222")) > 0.85, "dark ink goes light")
  assert.ok(Math.abs(lightness(darkColor("#888888")) - lightness("#888888")) < 0.05, "mid grey stays mid")
  const tint = darkColor("#e8f1fb")
  assert.ok(lightness(tint) < 0.3, `pale blue ground ${tint} goes dark`)
  assert.ok(parseInt(tint.slice(5, 7), 16) > parseInt(tint.slice(1, 3), 16), "and stays blue")
  assert.ok(lightness(darkColor("#1a73e8")) > lightness("#1a73e8"), "the selection blue lightens")
  assert.match(darkColor("rgba(26, 115, 232, 0.08)"), /^rgba\(\d+, \d+, \d+, 0\.08\)$/)
  assert.equal(darkColor("var(--x)"), "var(--x)", "what it cannot read, as it is")
})

test("ink for a dark ground stands out: dark colours lifted, light ones kept, greys turned over", () => {
  assert.ok(lightness(darkInk("#d42020")) >= 0.6, "oxygen's red")
  assert.equal(darkInk("#ffb5b5"), "#ffb5b5", "boron's pink is light already")
  assert.equal(darkInk("#222222"), darkColor("#222222"))
})

test("a picture's SVG text turns dark: every fill and stroke, but not none or currentColor", () => {
  const svg = '<rect fill="#ffffff"/><line stroke="#222222"/><path fill="none" stroke="currentColor"/><text fill="#d42020">O</text>'
  const dark = recolorSvg(svg)
  assert.ok(!dark.includes("#ffffff") && !dark.includes('"#222222"'))
  assert.match(dark, /fill="none" stroke="currentColor"/)
  assert.match(dark, new RegExp(`fill="${darkInk("#d42020")}"`))
})

test("styles/tokens.css is up to date with the colours the interface uses (npm run tokens)", () => {
  assert.equal(readFileSync(TOKENS, "utf8"), tokensCss())
})
