import { Editor } from "@/editor/Editor"
import { fillOverHttp } from "@/fillOverHttp"
import { recognizeOverHttp } from "@/recognizeOverHttp"

/** The standalone app: the editor filling the whole page, reaching the model through its own server. */
export default function App() {
  return <Editor fillVariables={fillOverHttp} recognizeStructure={recognizeOverHttp} />
}
