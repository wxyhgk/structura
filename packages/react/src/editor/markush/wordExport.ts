/**
 * How a host makes Word documents of editable ChemDraw objects from a table of compounds: it
 * is handed the package 化合物表 also downloads (see compoundTable.ts) and gives back the
 * .docx, typically from a server running chem2office (the standalone app's /api/word). Without
 * it, or when it is not available, 导出 Word makes the table with pictures in the page instead.
 */
export type WordExport = {
  /** Whether editable Word can be made now; when not, why (shown to the user, in Chinese). */
  check(): Promise<{ available: true } | { available: false; reason: string }>
  /** The package (a zip) as a .docx, `columns` structures to a row. Rejects with the reason it failed. */
  make(pack: Uint8Array<ArrayBuffer>, options: { columns: number }): Promise<Blob>
}
