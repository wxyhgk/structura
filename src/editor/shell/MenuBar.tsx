import type { ReactNode } from "react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Command, Commands } from "@/editor/hooks/useCommands"
import { LogoMark } from "@/editor/palette/icons"
import { useOverlayMark } from "@/editor/input/overlays"

function MenuButton({ label, children }: { label: string; children: ReactNode }) {
  const overlayMark = useOverlayMark()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-6 rounded-sm px-2 text-[13px] hover:bg-black/5 data-open:bg-black/5">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent {...overlayMark} align="start" className="min-w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Item({ command }: { command: Command }) {
  return (
    <DropdownMenuItem disabled={!command.enabled} onClick={command.run}>
      {command.label}
      {command.shortcut && <DropdownMenuShortcut>{command.shortcut}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  )
}

export function MenuBar({
  commands,
  colorHetero,
  onColorHetero,
}: {
  commands: Commands
  colorHetero: boolean
  onColorHetero: (on: boolean) => void
}) {
  const c = commands
  return (
    <header className="flex h-8 shrink-0 items-center gap-1 border-b border-[#d0d0d0] bg-[#f2f2f2] pr-3 pl-2">
      <div className="mr-1 flex items-center gap-1.5 px-1.5 font-medium">
        <LogoMark />
        Structura
      </div>
      <MenuButton label="文件">
        <Item command={c.newDocument} />
        <Item command={c.open} />
        <Item command={c.importSmiles} />
        <DropdownMenuSeparator />
        <Item command={c.exportSvg} />
        <Item command={c.exportMol} />
      </MenuButton>
      <MenuButton label="编辑">
        <Item command={c.undo} />
        <Item command={c.redo} />
        <DropdownMenuSeparator />
        <Item command={c.copy} />
        <Item command={c.cut} />
        <Item command={c.duplicate} />
        <Item command={c.remove} />
        <Item command={c.selectAll} />
      </MenuButton>
      <MenuButton label="结构">
        <Item command={c.rotateLeft} />
        <Item command={c.rotateRight} />
        <Item command={c.rotateHalf} />
        <DropdownMenuSeparator />
        <Item command={c.flipHorizontal} />
        <Item command={c.flipVertical} />
      </MenuButton>
      <MenuButton label="查看">
        <Item command={c.zoomIn} />
        <Item command={c.zoomOut} />
        <Item command={c.actualSize} />
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={colorHetero} onCheckedChange={(checked) => onColorHetero(checked === true)}>
          杂原子着色
        </DropdownMenuCheckboxItem>
      </MenuButton>
      <MenuButton label="帮助">
        <Item command={c.help} />
      </MenuButton>
      <div className="ml-auto text-[12px] text-[#777]">未命名</div>
    </header>
  )
}
