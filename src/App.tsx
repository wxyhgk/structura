import { Editor } from "chem-structura"
import { DRAWING } from "@/autosave"
import { EditorPage } from "@/EditorPage"
import { openWith } from "@/handoff"

/** The drawing page: the structure editor; 通式与批量生成 opens the drawing on the 通式 page. */
export default function App() {
  return <EditorPage storageKey={DRAWING} what="绘图">{({ ref, ...props }) => <Editor ref={ref} {...props} onEnumerate={(document) => openWith("/markush.html", document)} />}</EditorPage>
}
