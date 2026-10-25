// SMILES in, through RDKit: the caller loads the RDKit module (in Node, `await initRDKitModule()`;
// in a browser, with the .wasm file's URL) and hands it in.
export { smilesRecords } from "./records.ts"
export { looksLikeSmiles, smilesFault, smilesLines, smilesToMolfile } from "./smiles.ts"
export type { SmilesFault, SmilesLine } from "./smiles.ts"
