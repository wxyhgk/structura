import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ImportNotes } from "@/editor/imports/notes"

export function ImportNotesDialog({ notes, onClose }: { notes: ImportNotes | null; onClose: () => void }) {
  return (
    <Dialog open={notes != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>导入提示</DialogTitle>
          <DialogDescription>{notes?.opened ? "文件已打开，但有些内容需要注意：" : "文件没有打开："}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 list-disc space-y-1 overflow-y-auto pl-5 text-[13px]" data-testid="import-notes">
          {notes?.lines.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
