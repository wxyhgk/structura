import type { ReactNode } from "react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu.tsx"
import type { Commands } from "../hooks/useCommands.ts"
import type { Command } from "@structura/engine"
import { LogoMark } from "../palette/icons.tsx"
import { useOverlayMark } from "../input/overlays.ts"

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
  raisedNumbers,
  onRaisedNumbers,
  hasFill,
  title,
  dirty,
  tabs,
}: {
  commands: Commands
  /** Whether the host can reach a model for filling (the menu item may still be disabled for want of variables). */
  hasFill: boolean
  colorHetero: boolean
  onColorHetero: (on: boolean) => void
  /** Variables' numbers as superscripts (R¹) rather than subscripts (R₁). */
  raisedNumbers: boolean
  onRaisedNumbers: (on: boolean) => void
  /** The document's name, and whether it has unsaved changes (shown as a dot). */
  title: string
  dirty: boolean
  /** The workspace switch (绘图 / 通式), shown in the middle of the bar. */
  tabs?: ReactNode
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
        <Item command={c.save} />
        <Item command={c.exportSvg} />
        <Item command={c.exportMol} />
        <Item command={c.exportCdxml} />
      </MenuButton>
      <MenuButton label="编辑">
        <Item command={c.undo} />
        <Item command={c.redo} />
        <DropdownMenuSeparator />
        <Item command={c.copy} />
        <Item command={c.cut} />
        <Item command={c.paste} />
        <Item command={c.copyImage} />
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
        <DropdownMenuSeparator />
        <Item command={c.clean} />
        <Item command={c.expandGroups} />
        <Item command={c.collapseGroups} />
        <Item command={c.replace} />
        <Item command={c.join} />
        <Item command={c.bracket} />
        <Item command={c.quickScaffold} />
        <DropdownMenuSeparator />
        <Item command={c.enumerate} />
      </MenuButton>
      {(c.recognizeImage.enabled || hasFill) && (
        <MenuButton label="AI">
          <Item command={c.recognizeImage} />
          <Item command={c.fillFromText} />
          {!c.fillFromText.enabled && <div className="px-2 pb-1.5 text-[11px] leading-snug text-[#888]">先在结构上画出 R1、X 等变量，才能从专利文字填写</div>}
        </MenuButton>
      )}
      <MenuButton label="查看">
        <Item command={c.zoomIn} />
        <Item command={c.zoomOut} />
        <Item command={c.actualSize} />
        <Item command={c.fitAll} />
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={colorHetero} onCheckedChange={(checked) => onColorHetero(checked === true)}>
          杂原子着色
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={raisedNumbers} onCheckedChange={(checked) => onRaisedNumbers(checked === true)}>
          变量编号写成上标（R¹）
        </DropdownMenuCheckboxItem>
      </MenuButton>
      <MenuButton label="帮助">
        <Item command={c.guide} />
        <Item command={c.help} />
      </MenuButton>
      {tabs && <div className="mx-auto">{tabs}</div>}
      <div className={`${tabs ? "" : "ml-auto "}text-[12px] text-[#777]`} data-testid="document-title" title={dirty ? "有未保存的修改" : undefined}>
        {title}
        {dirty && <span className="ml-1 text-[#1a73e8]">•</span>}
      </div>
    </header>
  )
}
