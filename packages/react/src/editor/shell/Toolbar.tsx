import type { ReactNode } from "react"
import {
  CircleHelp,
  Download,
  FilePlus,
  FlipHorizontal2,
  FlipVertical2,
  Maximize2,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Button } from "../../components/ui/button.tsx"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger } from "../../components/ui/dropdown-menu.tsx"
import { Separator } from "../../components/ui/separator.tsx"
import type { Commands } from "../hooks/useCommands.ts"
import type { Command } from "@structura/engine"
import { Hint } from "../palette/ToolButton.tsx"
import { useOverlayMark } from "../input/overlays.ts"
import type { Layout } from "./layout.ts"

/** A toolbar button with the same hint as the tool palette: what it does, and its shortcut. */
function IconButton({ command, label = command.label, children }: { command: Command; label?: string; children: ReactNode }) {
  return (
    <Hint label={command.shortcut ? `${label}  ${command.shortcut}` : label} side="bottom">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={label} disabled={!command.enabled} className="size-7 rounded-sm text-(--c-222222) pointer-coarse:size-10" onClick={command.run}>
        {children}
      </Button>
    </Hint>
  )
}

function Gap() {
  return <Separator orientation="vertical" className="mx-1 h-5" />
}

/** The buttons there is no room for, as a menu: each with its icon, name and shortcut. */
function More({ items }: { items: Array<{ command: Command; icon: ReactNode }> }) {
  const overlayMark = useOverlayMark()
  return (
    <DropdownMenu>
      <Hint label="更多" side="bottom">
        <DropdownMenuTrigger
          aria-label="更多"
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-(--c-222222) hover:bg-black/5 dark:hover:bg-white/10 data-open:bg-black/5 dark:data-open:bg-white/10 pointer-coarse:size-10"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent {...overlayMark} align="start" className="min-w-44">
        {items.map(({ command, icon }) => (
          <DropdownMenuItem key={command.label} disabled={!command.enabled} onClick={command.run}>
            {icon}
            {command.label}
            {command.shortcut && <DropdownMenuShortcut>{command.shortcut}</DropdownMenuShortcut>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The toolbar. Compact, rotating, flipping and deleting go into ⋯; mini, the file buttons and
 * help too, and the menus (`menus`, a ☰) lead the row, with 放大编辑 (`onExpand`) at its end.
 */
export function Toolbar({ commands, zoom, layout = "full", menus, onExpand }: { commands: Commands; zoom: number; layout?: Layout; menus?: ReactNode; onExpand?: () => void }) {
  const c = commands
  const file = [
    { command: c.newDocument, icon: <FilePlus /> },
    { command: c.exportSvg, icon: <Download /> },
  ]
  const turn = [
    { command: c.rotateLeft, icon: <RotateCcw /> },
    { command: c.rotateRight, icon: <RotateCw /> },
    { command: c.flipHorizontal, icon: <FlipHorizontal2 /> },
    { command: c.flipVertical, icon: <FlipVertical2 /> },
    { command: c.remove, icon: <Trash2 /> },
  ]
  const help = { command: c.guide, icon: <CircleHelp />, label: "使用说明 (F1)" }
  const buttons = (items: Array<{ command: Command; icon: ReactNode; label?: string }>) =>
    items.map(({ command, icon, label }) => (
      <IconButton key={command.label} command={command} label={label}>
        {icon}
      </IconButton>
    ))
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-hidden border-b border-(--c-d5d5d5) bg-(--c-f7f7f7) px-1.5 pointer-coarse:h-12" data-testid="toolbar">
      {menus}
      {layout !== "mini" && (
        <>
          {buttons(file)}
          <Gap />
        </>
      )}
      {buttons([
        { command: c.undo, icon: <Undo2 /> },
        { command: c.redo, icon: <Redo2 /> },
      ])}
      <Gap />
      <IconButton command={c.zoomOut}>
        <ZoomOut />
      </IconButton>
      <button
        type="button"
        className="h-7 min-w-12 shrink-0 rounded-sm px-1 text-[12px] text-(--c-333333) hover:bg-black/5 dark:hover:bg-white/10 pointer-coarse:h-10"
        onClick={c.actualSize.run}
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton command={c.zoomIn}>
        <ZoomIn />
      </IconButton>
      <Gap />
      {layout === "full" ? buttons(turn) : <More items={layout === "mini" ? [...turn, ...file, help] : turn} />}
      <div className="ml-auto" />
      {layout !== "mini" && buttons([help])}
      {onExpand && layout === "mini" && (
        <Hint label="放大编辑" side="bottom">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="放大编辑" className="size-7 rounded-sm text-(--c-222222) pointer-coarse:size-10" onClick={onExpand}>
            <Maximize2 />
          </Button>
        </Hint>
      )}
    </div>
  )
}
