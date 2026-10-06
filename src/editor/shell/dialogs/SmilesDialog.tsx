import { MOD } from "@/editor/browser"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useOverlayMark } from "@/editor/input/overlays"

/**
 * Typing or pasting SMILES, one per line. Lines that could not be used stay in the
 * dialog with the reason; warnings about lines that were added go to `onNotes`.
 */
export function SmilesDialog({
  open,
  onOpenChange,
  onImport,
  onNotes,
  loadFailed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (text: string) => Promise<{ lines: string[]; skipped: number }>
  onNotes: (lines: string[]) => void
  loadFailed: string
}) {
  const overlayMark = useOverlayMark()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function submit() {
    setBusy(true)
    setErrors([])
    try {
      const { lines, skipped } = await onImport(text)
      if (skipped > 0) {
        setErrors(lines)
        return
      }
      onOpenChange(false)
      setText("")
      if (lines.length > 0) onNotes(lines)
    } catch {
      setErrors([loadFailed])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent {...overlayMark} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>导入 SMILES</DialogTitle>
          <DialogDescription>每行一个 SMILES，后面可以跟名称。第一次使用会下载 RDKit（约 2.4 MB）。也可以直接在画布上粘贴。</DialogDescription>
        </DialogHeader>
        <textarea
          className="h-32 w-full resize-y rounded border border-[#c8c8c8] p-2 font-mono text-[13px] outline-none focus:border-[#1a73e8]"
          placeholder={"CC(=O)Oc1ccccc1C(=O)O aspirin\nc1ccc2ccccc2c1"}
          value={text}
          data-testid="smiles-input"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit()
          }}
        />
        {errors.length > 0 && (
          <ul className="list-disc pl-5 text-[13px] text-[#d1242f]" data-testid="smiles-errors">
            {errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        )}
        <div className="flex justify-end">
          <Button size="sm" disabled={busy || text.trim() === ""} onClick={() => void submit()} data-testid="smiles-submit">
            {busy ? "正在转换…" : `导入 ${MOD}↵`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
