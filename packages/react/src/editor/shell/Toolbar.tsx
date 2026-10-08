import type { ReactNode } from "react"
import {
  CircleHelp,
  Download,
  FilePlus,
  FlipHorizontal2,
  FlipVertical2,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Button } from "../../components/ui/button.tsx"
import { Separator } from "../../components/ui/separator.tsx"
import type { Commands } from "../hooks/useCommands.ts"
import type { Command } from "@structura/engine"
import { Hint } from "../palette/ToolButton.tsx"

/** A toolbar button with the same hint as the tool palette: what it does, and its shortcut. */
function IconButton({ command, label = command.label, children }: { command: Command; label?: string; children: ReactNode }) {
  return (
    <Hint label={command.shortcut ? `${label}  ${command.shortcut}` : label} side="bottom">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={label} disabled={!command.enabled} className="size-7 rounded-sm text-[#222]" onClick={command.run}>
        {children}
      </Button>
    </Hint>
  )
}

function Gap() {
  return <Separator orientation="vertical" className="mx-1 h-5" />
}

export function Toolbar({ commands, zoom }: { commands: Commands; zoom: number }) {
  const c = commands
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-[#d5d5d5] bg-[#f7f7f7] px-1.5">
      <IconButton command={c.newDocument}>
        <FilePlus />
      </IconButton>
      <IconButton command={c.exportSvg}>
        <Download />
      </IconButton>
      <Gap />
      <IconButton command={c.undo}>
        <Undo2 />
      </IconButton>
      <IconButton command={c.redo}>
        <Redo2 />
      </IconButton>
      <Gap />
      <IconButton command={c.zoomOut}>
        <ZoomOut />
      </IconButton>
      <button
        type="button"
        className="h-7 min-w-12 rounded-sm px-1 text-[12px] text-[#333] hover:bg-black/5"
        onClick={c.actualSize.run}
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton command={c.zoomIn}>
        <ZoomIn />
      </IconButton>
      <Gap />
      <IconButton command={c.rotateLeft}>
        <RotateCcw />
      </IconButton>
      <IconButton command={c.rotateRight}>
        <RotateCw />
      </IconButton>
      <IconButton command={c.flipHorizontal}>
        <FlipHorizontal2 />
      </IconButton>
      <IconButton command={c.flipVertical}>
        <FlipVertical2 />
      </IconButton>
      <Gap />
      <IconButton command={c.remove}>
        <Trash2 />
      </IconButton>
      <div className="ml-auto" />
      <IconButton command={c.guide} label="使用说明 (F1)">
        <CircleHelp />
      </IconButton>
    </div>
  )
}
