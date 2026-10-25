// chem-structura: the Structura editor as a React component. A host renders <StructuraEditor />
// (or <Editor />, the same component) in a sized container, imports "chem-structura/style.css"
// once, and talks to it through its props and the handle it forwards.
export { Editor, Editor as StructuraEditor } from "./editor/Editor.tsx"
export type { EditorFile, EditorHandle, EditorProps, EditorUi, EnumerateOptions, Enumeration, FillVariables, Layout, OnFile, Op, RecognizeStructure, RunResult, Selection } from "./editor/Editor.tsx"
export type { TemplateStore } from "./editor/templates/store.ts"
export type { WordExport } from "./editor/markush/wordExport.ts"
export type { Theme } from "./components/theme.ts"
export { httpTemplateStore } from "./editor/templates/httpStore.ts"
export { memoryTemplateStore } from "./editor/templates/memoryStore.ts"
export { configureRDKit, type RDKitOptions } from "./editor/rdkit.ts"
