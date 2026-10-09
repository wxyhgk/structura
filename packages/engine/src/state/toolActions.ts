import type { AttachmentShape } from "@structura/markush"
import { atomIdsOfSelection } from "@structura/core/molecule"
import type { Op } from "@structura/core/ops"
import type { Bracket } from "@structura/core/types"
import type { EditorStore } from "./store.ts"

/**
 * Picking the tools that also act on what is selected, ChemDraw-style: the bracket tool
 * brackets the selected atoms straight away, and a shape picked for the attachment tool
 * redraws the selected atoms' attachments that way. Each is one undoable step, and the
 * tool stays picked for drawing more.
 */
export function toolActions(store: EditorStore) {
  const selectedIds = () => atomIdsOfSelection(store.latest().molecule, store.get().selection)
  return {
    /** The bracket tool, of `kind` (else the last kind picked); selected atoms get such a bracket at once. */
    takeBracketTool(kind?: Bracket["kind"]) {
      if (kind) store.setBracketKind(kind)
      store.setTool("bracket")
      const ids = selectedIds()
      if (ids.length > 0) store.run([{ op: "add_bracket", atoms: ids, kind: store.get().bracketKind }], { keepSelection: true })
    },
    /** The attachment tool; a shape given becomes how it draws new attachments, and selected atoms' attachments are redrawn so. */
    takeAttachTool(shape?: AttachmentShape | null) {
      store.setTool("attach")
      if (shape === undefined) return
      store.setAttachShape(shape)
      const ids = new Set(selectedIds())
      const ops: Op[] = (store.latest().attachments ?? [])
        .filter((attachment) => ids.has(attachment.atom) && (attachment.shape ?? null) !== shape)
        .map((attachment) => ({ op: "set_attachment_shape", atom: attachment.atom, shape }))
      if (ops.length > 0) store.run(ops, { keepSelection: true })
    },
  }
}
