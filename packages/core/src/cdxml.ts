// Writing a drawing for ChemDraw (CDXML), generic-formula marks included: variables as
// generic nicknames, variable attachments, brackets, and the definitions as text under it.
export { toCdxml } from "./cdxml/write.ts"
export type { CdxmlOptions } from "./cdxml/write.ts"
export { toCdxmlTable } from "./cdxml/table.ts"
export type { TableEntry, TableOptions } from "./cdxml/table.ts"
// What a file's structure hashes to: how cdxmlDocument.ts tells a changed file (see there).
export { cdxmlFingerprint } from "./cdxml/fingerprint.ts"
