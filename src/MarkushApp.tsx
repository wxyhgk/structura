import { MarkushEditor } from "@structura/markush-page"
import { MARKUSH } from "@/autosave"
import { EditorPage } from "@/EditorPage"
import { fillOverHttp } from "@/fillOverHttp"
import { openWith } from "@/handoff"
import { wordOverHttp } from "@/wordOverHttp"

/** The 通式 page: the generic formula, its variables and the compounds it generates; a compound opens on the drawing page. */
export default function MarkushApp() {
  return (
    <EditorPage storageKey={MARKUSH} what="通式">
      {({ ref, ...props }) => <MarkushEditor ref={ref} {...props} fillVariables={fillOverHttp} wordExport={wordOverHttp} onOpenCompound={(document) => openWith("/", document)} />}
    </EditorPage>
  )
}
