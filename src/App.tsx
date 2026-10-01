import { Editor } from "@/editor/Editor"
import { fillOverHttp } from "@/fillOverHttp"

/** The standalone app: the editor filling the whole page, reaching Claude through its own server. */
export default function App() {
  return <Editor fillVariables={fillOverHttp} />
}
