import { createContext, useContext } from "react"
import { download } from "./browser.ts"

/** A file the editor has made for the user: saved, exported, or a table of compounds. */
export type EditorFile = { name: string; type: string; data: Blob }

/**
 * The host's own way to keep the files the editor makes (EditorProps.onFile): in its storage,
 * its app's save dialog, a message to the page around an iframe. Returning false hands the file
 * back to the browser's download.
 */
export type OnFile = (file: EditorFile) => boolean | void

/** Where a file goes: to the host when it takes files, else the browser's download. */
export type Save = (filename: string, contents: string | Uint8Array<ArrayBuffer> | Blob, type: string) => void

export function saveTo(onFile?: OnFile): Save {
  if (!onFile) return download
  return (filename, contents, type) => {
    const data = contents instanceof Blob ? contents : new Blob([contents], { type })
    if (onFile({ name: filename, type, data }) === false) download(filename, data, type)
  }
}

export const SaveContext = createContext<Save>(download)

/** Where this editor's files go. */
export function useSave(): Save {
  return useContext(SaveContext)
}
