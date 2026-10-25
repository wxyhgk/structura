// Makes the built style.css hold up on any page. Tailwind puts the editor's rules in cascade
// layers, and any page rule outside a layer beats every layered rule: a page's `.grid { … }`
// or `button { … }` would restyle the editor. So the layers go, and every rule gets id-level
// weight instead (`:not(#\#)` adds one id and matches everything), in tiers that keep the
// layers' order:
//
//   0       host: rules on <chem-molecule> itself, which sits in the page and is the page's to style
//   1 id    a page's own rules, as most are (`#app .x`, `.page button`)
//   2 ids   reset: everything in the editor back to the browser's defaults (style.css), and
//           around: the page's elements that hold the editor's overlays (popper wrappers)
//   3 ids   properties, theme, base
//   4 ids   components, utilities
//   5 ids   the editor's rules outside any layer, which beat the utilities before too
//
// Inline styles still win, as before. Every rule but host's and around's also matches only
// inside the editor's roots (.chem-app, .chem-overlay): its utilities have the names a Tailwind
// page uses for its own (`.border-border`, `.text-muted-foreground`), and with ids' weight they
// would restyle the page's elements with the editor's colours. The scope is a `:where()`, so it
// adds no weight. Lengths in rem become px, so a page that sets its own root font size does not
// shrink the editor. Used by vite.config.ts on the built stylesheet.
import { transform } from "lightningcss"
import postcss from "postcss"

const TIERS = { host: 0, reset: 2, around: 2, properties: 3, theme: 3, base: 3, components: 4, utilities: 4 }
/** The layers whose rules are on the page's elements, not the editor's: not confined to its roots. */
const ON_PAGE = new Set(["host", "around"])
const UNLAYERED = 5
const ROOT_FONT_SIZE = 16

/** `:not(#\#)`: one id's weight, matching every element. */
const ID_WEIGHT = { type: "pseudo-class", kind: "not", selectors: [[{ type: "id", name: "#" }]] }

/** `:where(.chem-app, .chem-overlay, .chem-app *, .chem-overlay *)`: inside the editor, no weight. */
const ROOTS = ["chem-app", "chem-overlay"]
const IN_EDITOR = {
  type: "pseudo-class",
  kind: "where",
  selectors: ROOTS.flatMap((name) => [
    [{ type: "class", name }],
    [{ type: "class", name }, { type: "combinator", value: "descendant" }, { type: "universal" }],
  ]),
}

/**
 * A rule's tier while it passes from postcss to lightningcss: `.__tier3 <selector>`, or
 * `.__page0 <selector>` for a rule on the page's elements.
 */
const TAG = /^__(tier|page)(\d)$/

/**
 * The selector with `ids` ids' weight added to the element it matches: at the end of its last
 * compound, before a pseudo-element (::before), which must stay last.
 */
export function weighted(selector, ids) {
  const at = matchedEnd(selector)
  return [...selector.slice(0, at), ...Array.from({ length: ids }, () => ID_WEIGHT), ...selector.slice(at)]
}

/** The selector matching only inside the editor's roots: the scope on the element matched. */
export function confined(selector) {
  const at = matchedEnd(selector)
  return [...selector.slice(0, at), IN_EDITOR, ...selector.slice(at)]
}

/** Where the element matched ends: its last compound, before a pseudo-element (::before). */
function matchedEnd(selector) {
  let compound = selector.length
  while (compound > 0 && selector[compound - 1].type !== "combinator") compound--
  const at = selector.findIndex((part, index) => index >= compound && part.type === "pseudo-element")
  return at < 0 ? selector.length : at
}

/**
 * Step 1 (postcss): the layers taken away, each style rule tagged with its tier. Rules inside
 * @media and @supports keep their place; @keyframes steps are not selectors.
 */
const flattenLayers = {
  postcssPlugin: "flatten-layers",
  Once(root) {
    root.walkAtRules("layer", (layer) => {
      if (!layer.nodes) return layer.remove()
      const name = layer.params.trim()
      if (!(name in TIERS)) throw new Error(`style.css: a layer this build does not know: "${name}"`)
      if (layer.parent !== root) throw new Error("style.css: a layer inside another rule")
      layer.walkRules((rule) => tag(rule, TIERS[name], ON_PAGE.has(name)))
      layer.replaceWith(layer.nodes)
    })
    root.walkRules((rule) => {
      if (!/^\.__(tier|page)/.test(rule.selector)) tag(rule, UNLAYERED)
    })
  },
}

function tag(rule, tier, onPage = false) {
  if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return
  if (rule.parent?.type === "rule") throw new Error("style.css: nested style rules; flatten them first")
  rule.selectors = rule.selectors.map((selector) => `.__${onPage ? "page" : "tier"}${tier} ${selector}`)
}

/**
 * Step 2 (lightningcss, selectors only): each tag becomes that many ids' weight, and every rule
 * but those on the page's elements is confined to the editor.
 */
const weighTags = {
  Selector(selector) {
    const tag = selector[0]?.type === "class" ? TAG.exec(selector[0].name) : null
    if (!tag) return selector
    const [, kind, tier] = tag
    const rest = selector.slice(2)
    return weighted(kind === "page" ? rest : confined(rest), Number(tier))
  },
}

/** Lengths in rem as px, in declarations only (a media query's rem is the browser's, not the page's). */
const remToPx = {
  postcssPlugin: "rem-to-px",
  Declaration(declaration) {
    declaration.value = declaration.value.replace(/(-?\d*\.?\d+)rem\b/g, (_, number) => `${+(Number(number) * ROOT_FONT_SIZE).toFixed(4)}px`)
  },
}

/** The built stylesheet, hardened against the page around the editor. */
export function hardenCss(css) {
  const tagged = postcss([flattenLayers, remToPx]).process(css, { from: undefined }).css
  const { code } = transform({ filename: "style.css", code: Buffer.from(tagged), minify: true, visitor: weighTags })
  const out = code.toString()
  if (/__(tier|page)\d/.test(out)) throw new Error("style.css: a tier tag was left in a selector")
  return out
}
