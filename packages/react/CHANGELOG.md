# Changelog

## 0.6.2

- **Fixed**: style.css restyled the page around the editor. Its utilities have the names a
  Tailwind page uses for its own (`.border-border`, `.text-muted-foreground`, `.bg-secondary`…),
  and with the ids' weight they carry (0.3.0) they beat the page's rules on the page's own
  elements, with the editor's colour variables: on a page whose `--border` is not a whole colour
  (shadcn's `214.3 31.8% 91.4%`) borders and grey text turned black and selected buttons lost
  their fill. Every rule now matches only inside the editor (`.chem-app`, `.chem-overlay`),
  adding no weight, but `<chem-molecule>`'s own and the reset of the popper wrappers round the
  editor's menus; `check:dist` checks the built file for any other.

## 0.6.1

- **Changed**: what the pointer is on is now simply what it is nearest, instead of each kind
  having its own radius (atom 12 px, bond 7, curve and bracket 6, tried in turn). Bonds were
  much harder to point at than atoms: at 50% and below a bond could not be hovered or clicked
  at all, and at 100% it had 246 px² to an atom's 450; hover reached further than a click, so
  what lit up was not always what was taken. Now:
  - One reach for atoms, bonds, custom curves and brackets: 30% of a bond's length on screen,
    kept between 8 and 16 px (16 to 28 px for a finger). Within it the nearest wins; an atom
    keeps 30% of each bond at its end, so a bond keeps its middle at any zoom.
  - An atom with a label is hit anywhere on the label (NH₂, R1), not only round its centre.
  - On a boundary the pointer stays on what is lit until the other is 2 px nearer, so the
    mark does not flicker; a click takes what is lit.
  - Per bond at 100%: 503 px² (was 246); at 50%: 124 (was 0). A custom curve or bracket
    beside a bond is taken where it is the nearer, no longer always lost to the bond.

## 0.6.0

Additions only: nothing 0.5.0 offered has changed signature or gone away.

- **Selection for the host**: `getSelection()` and `setSelection({ atoms, bonds? })` on the
  handle (`mount()` too), and `onSelectionChange(selection)`, with atom and bond ids as in
  `getDocument()`: for a page that shows the same molecule elsewhere (a 3D view, a table) and
  keeps the two selections together. The host's own `setSelection` is not an edit (no undo
  step, the view stays) and is not reported back; the user's changes are, once each (a box or
  lasso when released). The `Selection` type is exported.

## 0.5.0

Additions only: nothing 0.4.0 offered has changed signature or gone away.

- **Dark theme**: `theme: "light" | "dark" | "auto"` on the Editor (and `mount()`), `edit()`
  and `<chem-molecule theme>`; `"auto"` follows the page (`data-theme` or class `dark` on
  `<html>`) and the system, live. Light, the default, is unchanged. The interface, menus,
  dialogs, canvas, thumbnails and the guide all turn; files written stay light.
  `onThemeChange` puts 浅色 / 深色 / 跟随系统 in the 查看 menu.
- **Fixed**: hovering an atom or bond lagged while the 通式 workspace was generating (it
  restarts after every edit with 自动更新 on): every 12 ms slice re-rendered all the result
  cards. Progress now shows at most every 0.2 s, unchanged cards are not redrawn, and a slice
  ends early when input is waiting. Generating is also about three times faster.

## 0.4.0

Additions only: nothing 0.3.0 offered has changed signature or gone away.

- **Tables of compounds** (the 通式 workspace): generated compounds are numbered by a pattern
  (`C-{n}` → C-1, C-2…; every download uses the numbers), and 化合物表… exports them as a
  patent prints them: a Word document, a ChemDraw table (.cdxml), or a package for chem2office.
  Structures drawn in full, one bond length, a salt's ions side by side. The Word document holds
  editable ChemDraw objects when the host passes `wordExport` (chem2office on its server), else
  pictures. A salt's counter-ion drawn beside a formula now stays with every compound.
- **`edit()`**: `smiles` as input; `on3D: "project" | "reject"`; `confirmProblems`;
  `withSmiles`. The result also carries `problems` (with Chinese `text`), `notes`, `changed`
  and, when asked, `smiles`.
- **Escape** with nothing to stop or deselect closes a host's dialog (`onDismiss`) at once, no
  longer taking the lasso first.
- **`drawingSvg`**: `background` (`false` for none) and `color` (`"currentColor"` follows the
  page); core's SVG writer has `background` and `ink`.
- **Fixed**: a page's own `.dark` class no longer darkens the editor's menus and dialogs while
  the rest stays light (the editor has no dark theme yet).

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
