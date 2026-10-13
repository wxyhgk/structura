# Changelog

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
