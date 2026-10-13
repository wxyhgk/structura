// chem-structura/standalone: the editor for a page without React, React bundled in. A page
// includes "chem-structura/style.css" once, then: writes <chem-molecule> elements (a structure
// shown, editable on a click), or calls edit() to open the editor over the page, or sizes an
// element and calls mount(element) for an editor of its own. Everything in
// chem-structura/core comes along, so a page can also show structures without opening the
// editor (drawingSvg…) from the one file. Built twice: as an ES module (dist/standalone.js)
// and for a plain <script> (dist/chem-structura.iife.js, which sets window.ChemStructura).
export type { EditorHandle, EditorProps, EnumerateOptions, Enumeration, FillVariables, Op, RecognizeStructure, RunResult } from "./editor/Editor.tsx"
export type { TemplateStore } from "./editor/templates/store.ts"
export type { WordExport } from "./editor/markush/wordExport.ts"
export { httpTemplateStore } from "./editor/templates/httpStore.ts"
export { memoryTemplateStore } from "./editor/templates/memoryStore.ts"
export { configureRDKit, type RDKitOptions } from "./editor/rdkit.ts"
export { applyOps, displayFormula, drawingCdxml, drawingFromMolfile, drawingMolfile, drawingSvg, elementalAnalysis, emptyDrawing, enumerate, enumerationSdf } from "./core.ts"
export { exactMass, isDocument, librarySize, molecularWeight, netCharge, plainFormula, readDocument, readMolfile, readSdf, toDocument, toMolfile, toSdf, validateDrawing } from "./core.ts"
export type { Arrow, Atom, Bond, Bracket, Drawing, ExportOptions, LibrarySize, Molecule, MolRecord, OpsResult, Problem } from "./core.ts"

export { mount, type MountedEditor, type MountOptions } from "./standalone/mount.tsx"
export { edit, type Edited, type EditOptions } from "./standalone/sheet.ts"
export { defineMoleculeElement, type MoleculeChange, type MoleculeElement } from "./standalone/moleculeElement.ts"
import { defineMoleculeElement } from "./standalone/moleculeElement.ts"

// <chem-molecule> is there as soon as the file is loaded (in a browser).
defineMoleculeElement()
