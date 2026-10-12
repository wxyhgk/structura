import assert from "node:assert/strict"
import test from "node:test"
import { hardenCss } from "../scripts/harden-css.mjs"

const ids = (n: number) => ":not(#\\#)".repeat(n)

test("layers go, and each rule weighs as many ids as its layer's tier", () => {
  const css = hardenCss(`@layer reset, theme, base, components, utilities;
    @layer reset { .r { all: revert } }
    @layer base { .b { color: red } }
    @layer utilities { .u { color: blue } }
    .own { color: green }`)
  assert.doesNotMatch(css, /@layer/)
  assert.match(css, new RegExp(`\\.r${escape(ids(2))}\\{`))
  assert.match(css, new RegExp(`\\.b${escape(ids(3))}\\{`))
  assert.match(css, new RegExp(`\\.u${escape(ids(4))}\\{`))
  assert.match(css, new RegExp(`\\.own${escape(ids(5))}\\{`))
})

test("the weight goes on the element matched, before a pseudo-element, and inside @media too", () => {
  const css = hardenCss(`@layer utilities { .a .b:hover::before { content: "" } @media (width >= 40rem) { .c > .d { color: red } } }`)
  assert.ok(css.includes(`.a .b:hover${ids(4)}:before{`), css)
  assert.ok(css.includes(`@media (width>=40rem){.c>.d${ids(4)}{`), css)
})

test("keyframes, @property and @font-face are left as they are", () => {
  const css = hardenCss(`@layer utilities { @keyframes k { from { opacity: 0 } to { opacity: 1 } } }
    @property --x { syntax: "*"; inherits: false }
    @font-face { font-family: F; src: url(f.woff2) }`)
  assert.match(css, /@keyframes k\{0%\{opacity:0\}to\{opacity:1\}\}/)
  assert.match(css, /@property --x\{/)
  assert.match(css, /@font-face\{/)
  assert.doesNotMatch(css, /not\(#/)
})

test("lengths in rem become px, except in media queries, so the page's root font size does not matter", () => {
  const css = hardenCss(`@layer utilities { .p { padding: .25rem; width: calc(100% - 2rem) } @media (width >= 48rem) { .q { margin: 1.5rem } } }`)
  assert.match(css, /padding:4px/)
  assert.match(css, /calc\(100% - 32px\)/)
  assert.match(css, /@media \(width>=48rem\)/)
  assert.match(css, /margin:24px/)
})

test("a layer the build does not know stops it, rather than guessing its place", () => {
  assert.throws(() => hardenCss("@layer mystery { .x { color: red } }"), /mystery/)
})

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\#]/g, "\\$&")
}
