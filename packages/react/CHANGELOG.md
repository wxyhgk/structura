# Changelog

## 0.3.0

Everything below is new; nothing that 0.2.0 offered has changed or gone away.

- **Without React**: `chem-structura/standalone`, React bundled in, as an ES module
  (`dist/standalone.js`) and for a plain `<script>` (`dist/chem-structura.iife.js`, global
  `ChemStructura`; `https://cdn.jsdelivr.net/npm/chem-structura@0.3.0` serves it).
  - `<chem-molecule>`: a structure on a page (molfile, Structura document or `smiles`); with
    `editable`, a click opens the editor and 保存 fires `change`; form-associated (`name`).
  - `edit({ title, molfile | document })`: the editor over the page, resolving to
    `{ molfile, document }` or null. Escape cancels once the editor has no use for it; the
    page behind is inert while it is open.
  - `mount(element, options)`: an editor in an element of the page's, with the component's
    handle plus `update(options)` and `unmount()`.
- **Without the editor**: `chem-structura/core`, the chemistry with no React and no browser
  (Node too): `applyOps`, `drawingFromMolfile`, `drawingMolfile`, `drawingSvg`,
  `drawingCdxml`, `readDocument` / `toDocument`, `enumerate`, `librarySize`, formulas and
  masses. The standalone build carries all of it as well.
- **Handle**: `getSvg()`, `getPng({ scale })`, `getSmiles()` / `setSmiles(text)`, `getInchi()`,
  `getInchiKey()`.
- **Props**: `onDismiss()`, for an Escape the editor has no use for.
- **RDKit**: `configureRDKit({ module })` lends the page's own RDKit instead of loading a
  second one; a call that comes too late says so in the console.
- **Fixed**
  - The page's own CSS no longer restyles the editor (tag rules, classes named like
    Tailwind's, a root font size, inherited text styles).
  - Server rendering (Next.js, Remix…): it rendered with an error, and its HTML did not match
    in the browser.
  - `fit()` right after `run()` or `setMolfile()` fitted the drawing from before.
- **Smaller**: the package is 1.4 MB (was 3.5 MB with the new builds' source maps), and its
  JavaScript is minified.
