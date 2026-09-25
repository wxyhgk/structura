import { TooltipProvider } from "@/components/ui/tooltip"
import { Editor } from "@/editor/Editor"

export default function App() {
  return (
    <TooltipProvider delayDuration={350}>
      <Editor />
    </TooltipProvider>
  )
}
