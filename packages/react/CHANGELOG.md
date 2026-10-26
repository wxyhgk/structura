# Changelog

## 0.8.0

- **Changed (breaking)**: the 通式 workspace is no longer in the editor. Its variables board,
  constraints, generated compounds and their exports (CSV, SDF, 化合物表, Word) are the
  Structura app's own 通式 page now, not the package's: the editor draws structures, generic
  formulas included (R1, attachments anywhere on a ring, brackets), and `enumerate()` on the
  handle and in `chem-structura/core` still generates their compounds. Gone with it: the 绘图 /
  通式 switch, the `fillVariables` and `wordExport` props (and the `FillVariables` and
  `WordExport` types), and `ui.workspaces`. The guide (帮助 → 使用说明) keeps the pages about
  drawing. `index.js` is 180 KB instead of 308.
- **Added**: `onEnumerate(document)`: offers 结构 → 通式与批量生成… for a host with a page of
  its own for the formula's variables; without it the item is not shown.

## 0.7.0

- **Small boxes**: the editor lays itself out by the size of its own box (not the window), as
  it changes. Below 720×520 it is compact: the menu bar keeps one row (menus no longer wrap one
  character to a line), rotating, flipping and deleting go behind ⋯, and the 通式 workspace
  shows 结构, 变量 and 生成结果 one at a time instead of three panes squeezed side by side.
  Below 480×360 it is mini: the menus (and the switch to 通式) go behind one ☰ beside the
  toolbar, and there is no status bar. The new `layout` prop fixes one of them instead.
- **`ui`**: leave out the menu bar, toolbar, palette, status bar or the 通式 workspace.
- **`onExpand(document)`**: 放大编辑 in a mini editor; the structure saved in the larger editor
  comes back as one undoable edit. `mount()` offers it by default, in `edit()`'s sheet.
- **`onFile(file)`**: the host takes the files the editor makes (保存, every 导出, tables of
  compounds, the template library) instead of a browser download; `false` hands one back.
- **Touch screens**: larger tool and toolbar buttons where the pointer is coarse. Two fingers
  pan the view together and pinch it to zoom about the point between them. A finger's press
  waits until it moves or lifts, so a second finger down by then draws nothing (a ring, eraser
  or charge tap would otherwise already be in the undo history); a second finger during a drag
  drops the drag, with no half-drawn bond or box and nothing to undo. After a pinch the finger
  left behind draws nothing until all have lifted. One finger draws as before, acting when it
  lifts for a tap; mouse and pen are unchanged.
- **Changed**: when the canvas changes size (the host resizes a panel, the window is resized,
  the 通式 workspace's panels open), the view keeps the same part of the drawing in its middle
  instead of keeping its top-left corner.
- **Added**: CDXML comes back whole. 导出 CDXML also keeps the whole Structura document in the
  file, compressed in an XML comment ChemDraw ignores, with a fingerprint of the structure
  written around it (nodes, bonds and label text, as written). 打开 (and dropping a file) now
  takes `.cdxml`: a file Structura exported opens with everything CDXML cannot say (variables'
  alternatives, provisos, ring closures) as it was. A file whose structure was changed since,
  or one with no Structura document in it, is refused with the reason rather than read as it
  was exported; there is no reader for ChemDraw's own structures yet. `getCdxml()` and
  `drawingCdxml` stay synchronous and leave the comment out.
- **Added**: arrow keys move the hotspot without the mouse: to the bonded atom that way (none
  when every bond turns more than 70° from the key), and with Shift along the chain to its end
  or first branch, across a ring rather than round it. Keys pressed next land there. With a
  selection, or no hotspot, arrows keep their old meaning (⇧ + arrow still moves the selection).
- **Changed**: a SMILES RDKit cannot read now says why, in Chinese, with RDKit's own words
  after it: an unpaired parenthesis, a ring left open, where the text goes wrong, an atom over
  its valence, or an aromatic ring it cannot kekulize ("无法读取，环没有闭合…"). RDKit's error
  log is captured for the call and no longer goes to the console.
- **Changed**: molecules read from SMILES (import, paste, `setSmiles`, `edit({ smiles })`,
  `<chem-molecule smiles>`) come in lying level: turned by a multiple of 30° so their longest
  axis is within 15° of horizontal, instead of at whatever angle RDKit laid them out. Molfile
  coordinates are kept as they are.
- **Added**: V3000 molfiles open, on their own and as records of an SD file, read exactly as
  their V2000 twins: charges, isotopes (MASS), R# atoms with RGROUPS as variables R1…, wedges
  and hashes (CFG), aromatic bonds, and repeat units (SRU) and groups (GEN) as brackets. What
  the editor cannot hold (radicals, abbreviations (SUP), coordination bonds, collections, other
  properties) is said in the import notes, as for V2000; only a broken connection table is
  refused. They were refused whole before, including what RDKit writes for dative bonds.
- **Added**: `edit()`'s `problems` also report slips in the drawing, as warnings: atoms drawn
  on top of each other (`atoms-overlap`), an atom lying on a bond it is not part of
  (`atom-on-bond`), and bonds far longer or shorter than the molecule's usual one (`long-bond`,
  `short-bond`), with Chinese `text` ("第 1 个原子（C）和第 7 个原子（N）画在了一起"). They are
  loose enough that nothing the editor's templates, scaffolds and tools lay out, nor RDKit's
  layouts of bridged rings, trips them, so `confirmProblems` does not ask about a normal drawing.
- **Changed**: the pointer over an atom shows a small dot on it (3.5 px), not a 12 px ring; over
  a labelled atom (NH₂, R1), a faint ground behind the label, which a dot would cover.
- **Fixed**: in the table of compounds (Word, table.cdxml, the zip package) abbreviations
  drawn in full could land on each other: Bn beside Ph or Mes, placed as for their labels, read
  as a fused ring. The expanded groups are now flipped or swung about the atom they hang from
  (no bond changes length), and only what that leaves is relaxed, stretching no bond more than
  20%; nothing else in the molecule moves. On a crowded test formula (three neighbouring
  substituents, 4913 compounds) overlaps fell from 12.7% to 1.2%.
- **Fixed**: an editor mounted where it has no size yet (a `display: none` tab, a 0×0 box)
  fitted its starting drawing at the smallest zoom (10%) and stayed there once shown. A fit
  asked for while the canvas has no width or height now waits for its first size.
- **Fixed**: an input method's Enter or Escape (choosing pinyin, kana…) no longer commits or
  cancels an atom's label, a variable's choices, a ring closure, a scaffold or template name.

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
