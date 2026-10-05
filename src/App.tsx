import { useEffect, useRef } from "react"
import { Editor, type EditorHandle } from "@/editor/Editor"
import { fillOverHttp } from "@/fillOverHttp"
import { recognizeOverHttp } from "@/recognizeOverHttp"
import { exposeForTests } from "@/testHook"

/** The standalone app: the editor filling the whole page, reaching the model through its own server. */
export default function App() {
  const editor = useRef<EditorHandle>(null)
  useEffect(() => exposeForTests(editor.current), [])
  return <Editor ref={editor} fillVariables={fillOverHttp} recognizeStructure={recognizeOverHttp} />
}
