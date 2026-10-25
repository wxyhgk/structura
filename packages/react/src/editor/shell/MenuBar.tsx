import type { ReactNode } from "react"
import { Menu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu.tsx"
import type { Commands } from "../hooks/useCommands.ts"
import type { Command } from "@structura/engine"
import { LogoMark } from "../palette/icons.tsx"
import { useOverlayMark } from "../input/overlays.ts"
import type { Theme } from "../../components/theme.ts"

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "auto", label: "跟随系统" },
]

function MenuButton({ label, children }: { label: string; children: ReactNode }) {
  const overlayMark = useOverlayMark()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-6 shrink-0 rounded-sm px-2 text-[13px] whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/10 data-open:bg-black/5 dark:data-open:bg-white/10">
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

type MenuProps = {
  commands: Commands
  /** Whether the host can reach a model for filling (the menu item may still be disabled for want of variables). */
  hasFill: boolean
  colorHetero: boolean
  onColorHetero: (on: boolean) => void
  /** Variables' numbers as superscripts (R¹) rather than subscripts (R₁). */
  raisedNumbers: boolean
  onRaisedNumbers: (on: boolean) => void
  /** The theme, offered in 查看 when the host lets the user choose (onTheme). */
  theme: Theme
  onTheme?: (theme: Theme) => void
}

/** The menus, each a label and its items: a row of buttons in the menu bar, or submenus of ☰. */
function menus({ commands: c, hasFill, colorHetero, onColorHetero, raisedNumbers, onRaisedNumbers, theme, onTheme }: MenuProps): Array<{ label: string; items: ReactNode }> {
  return [
    {
      label: "文件",
      items: (
        <>
          <Item command={c.newDocument} />
          <Item command={c.open} />
          <Item command={c.importSmiles} />
          <DropdownMenuSeparator />
          <Item command={c.save} />
          <Item command={c.exportSvg} />
          <Item command={c.exportMol} />
          <Item command={c.exportCdxml} />
        </>
      ),
    },
    {
      label: "编辑",
      items: (
        <>
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
        </>
      ),
    },
    {
      label: "结构",
      items: (
        <>
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
          {c.enumerate.enabled && (
            <>
              <DropdownMenuSeparator />
              <Item command={c.enumerate} />
            </>
          )}
        </>
      ),
    },
    ...(c.recognizeImage.enabled || hasFill
      ? [
          {
            label: "AI",
            items: (
              <>
                <Item command={c.recognizeImage} />
                <Item command={c.fillFromText} />
                {!c.fillFromText.enabled && <div className="px-2 pb-1.5 text-[11px] leading-snug text-(--c-888888)">先在结构上画出 R1、X 等变量，才能从专利文字填写</div>}
              </>
            ),
          },
        ]
      : []),
    {
      label: "查看",
      items: (
        <>
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
          {onTheme && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={theme} onValueChange={(value) => onTheme(value as Theme)}>
                {THEMES.map((item) => (
                  <DropdownMenuRadioItem key={item.value} value={item.value}>
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}
        </>
      ),
    },
    {
      label: "帮助",
      items: (
        <>
          <Item command={c.guide} />
          <Item command={c.help} />
        </>
      ),
    },
  ]
}

/** The menu bar: the name, the menus and the document's title. Compact, the name goes (the mark stays). */
export function MenuBar({
  title,
  dirty,
  compact = false,
  brand = "Structura",
  ...props
}: MenuProps & {
  /** The document's name, and whether it has unsaved changes (shown as a dot). */
  title: string
  dirty: boolean
  compact?: boolean
  /** The name beside the mark. */
  brand?: string
}) {
  return (
    <header className="flex h-8 shrink-0 items-center gap-1 border-b border-(--c-d0d0d0) bg-(--c-f2f2f2) pr-3 pl-2 pointer-coarse:h-10">
      <div className="mr-1 flex shrink-0 items-center gap-1.5 px-1.5 font-medium whitespace-nowrap">
        <LogoMark />
        {!compact && brand}
      </div>
      {menus(props).map((menu) => (
        <MenuButton key={menu.label} label={menu.label}>
          {menu.items}
        </MenuButton>
      ))}
      <div
        className="ml-auto min-w-0 truncate text-[12px] whitespace-nowrap text-(--c-777777)"
        data-testid="document-title"
        title={dirty ? `${title}（有未保存的修改）` : title}
      >
        {title}
        {dirty && <span className="ml-1 text-(--c-1a73e8)">•</span>}
      </div>
    </header>
  )
}

/** All the menus behind one ☰, for an editor with no room for a menu bar. */
export function MenuSheet(props: MenuProps) {
  const overlayMark = useOverlayMark()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="菜单"
        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-(--c-222222) hover:bg-black/5 dark:hover:bg-white/10 data-open:bg-black/5 dark:data-open:bg-white/10 pointer-coarse:size-10"
      >
        <Menu className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent {...overlayMark} align="start" className="min-w-36">
        {menus(props).map((menu) => (
          <DropdownMenuSub key={menu.label}>
            <DropdownMenuSubTrigger>{menu.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent {...overlayMark} className="min-w-44">
              {menu.items}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
