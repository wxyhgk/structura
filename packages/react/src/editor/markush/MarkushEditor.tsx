import { forwardRef } from "react"
import { toDocument } from "@structura/core/document"
import { emptyDrawing } from "@structura/core/drawing"
import type { EditorHandle, EditorProps } from "../Editor.tsx"
import { EditorFrame } from "../EditorFrame.tsx"
import { ALL_PAGES } from "../../guide/index.ts"
import { FillDialog } from "./FillDialog.tsx"
import type { FillVariables } from "./useFill.ts"
import type { WordExport } from "./wordExport.ts"
import { MarkushWorkspace } from "./workspace/MarkushWorkspace.tsx"

export type MarkushEditorProps = Omit<EditorProps, "onEnumerate"> & {
  /**
   * How to reach the model for 从专利文字填写: the editor builds the request and checks the
   * answer; the host sends it to a server holding the API key (@structura/ai/server).
   */
  fillVariables?: FillVariables
  /** How to make Word tables with editable ChemDraw objects (chem2office); without it, pictures. */
  wordExport?: WordExport
  /** A generated compound, as a document of its own, to open where structures are drawn. */
  onOpenCompound: (document: string) => void
}

/**
 * The 通式 page's editor: the formula's canvas, its variables and constraints beside it and the
 * compounds it generates below, all one document. The standalone app's own page, not the
 * package's: Editor leaves it out.
 */
export const MarkushEditor = forwardRef<EditorHandle, MarkushEditorProps>(function MarkushEditor({ fillVariables, wordExport, onOpenCompound, ...props }, ref) {
  return (
    <EditorFrame
      ref={ref}
      {...props}
      brand="Structura · 通式"
      guidePages={ALL_PAGES}
      hasFill={fillVariables != null}
      centre={(canvas, { editor, file, dialogs, templates }) => (
        <>
          <MarkushWorkspace
            canvas={canvas}
            drawing={editor.drawing}
            run={editor.run}
            selected={editor.selection.atoms}
            colorHetero={editor.colorHetero}
            base={file.base}
            onPlace={(mol) => onOpenCompound(toDocument({ ...emptyDrawing(), molecule: mol }))}
            onHelp={dialogs.showGuide}
            onFill={fillVariables ? () => dialogs.open("fill") : undefined}
            wordExport={wordExport}
            templates={templates}
          />
          {fillVariables && <FillDialog open={dialogs.fill} onOpenChange={dialogs.setOpen("fill")} drawing={editor.latest()} run={editor.run} fill={fillVariables} />}
        </>
      )}
    />
  )
})
