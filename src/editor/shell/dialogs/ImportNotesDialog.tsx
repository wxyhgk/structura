import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ImportNotes } from "@/editor/imports/notes"
import { useOverlayMark } from "@/editor/input/overlays"

export function ImportNotesDialog({ notes, onClose }: { notes: ImportNotes | null; onClose: () => void }) {
  const overlayMark = useOverlayMark()
  return (
    <Dialog open={notes != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent {...overlayMark} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{notes?.title ?? "导入提示"}</DialogTitle>
          <DialogDescription>{notes?.title ? "没有完成：" : notes?.opened ? "文件已打开，但有些内容需要注意：" : "文件没有打开："}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 list-disc space-y-1 overflow-y-auto pl-5 text-[13px]" data-testid="import-notes">
          {notes?.lines.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
