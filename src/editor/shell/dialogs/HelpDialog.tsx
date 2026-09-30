import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ATOM_KEYS, BOND_KEYS } from "@/editor/hotkeys/lookup"
import { MOD } from "@/editor/browser"
import { allCommands, type Commands } from "@/editor/hooks/useCommands"
import { keyLabel } from "@/editor/input/keymap"
import { TOOL_KEYS } from "@/editor/tools/bindings"
import { describeAtomAction, describeBondAction, hotkeyLabel } from "@/editor/tools/describe"
import { useOverlayMark } from "@/editor/input/overlays"

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <>
      <dt className="text-[#666]">{keys}</dt>
      <dd>{action}</dd>
    </>
  )
}

/** Rows of [keys, action], merging entries that share an action, in first-seen order. */
function byAction(entries: { key: string; action: string }[]): [string, string][] {
  const rows = new Map<string, string[]>()
  for (const { key, action } of entries) rows.set(action, [...(rows.get(action) ?? []), key])
  return [...rows].map(([action, keys]) => [keys.join(" "), action])
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <>
      <dt className="col-span-2 mt-2 font-medium text-[#333]">{title}</dt>
      {rows.map(([keys, action]) => (
        <Shortcut key={action} keys={keys} action={action} />
      ))}
    </>
  )
}

// Keys the canvas handles itself, besides the chemistry in the key tables.
const HOVER_EXTRAS: [string, string][] = [
  ["Enter", "编辑这个原子的标签"],
  ["g / Tab / 空格", "选中这个原子 / 选中整个分子"],
]

function hotkeyRows<A>(table: Record<string, A>, describe: (action: A) => string): [string, string][] {
  return byAction(Object.entries(table).map(([key, action]) => ({ key: hotkeyLabel(key), action: describe(action) })))
}

export function HelpDialog({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Commands
}) {
  const overlayMark = useOverlayMark()
  const toolRows = byAction(
    TOOL_KEYS.map((entry) => ({
      key: entry.key !== entry.key.toLowerCase() ? `⇧${entry.key}` : entry.key.toUpperCase(),
      action: entry.label,
    })),
  )
  const commandRows = byAction(
    allCommands(commands).flatMap((command) => command.keys.map((key) => ({ key: keyLabel(key, MOD), action: command.label }))),
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...overlayMark} className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>
            蓝圈标出下一次按键作用的位置：鼠标悬停的原子或键。刚按完键、鼠标没动时，蓝圈跳到新接出的原子上，可以接着连按；鼠标移开到空白处，蓝圈留在原处。没有蓝圈时，按键作用于选中的每个原子（鼠标停在选中部分上时也是）。Esc 取消选中。既没蓝圈也没选中时，按键切换工具。
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <Section title="悬停在原子上，或选中原子后" rows={[...hotkeyRows(ATOM_KEYS, describeAtomAction), ...HOVER_EXTRAS]} />
          <Section title="悬停在键上，或只选中键时" rows={hotkeyRows(BOND_KEYS, describeBondAction)} />
          <Section title="没悬停时：工具" rows={toolRows} />
          <Section title="编辑" rows={commandRows} />
          <Section title="鼠标" rows={[["单击空白", "画一条水平键"], ["选中后", "拖外框的点：顶上旋转，四角缩放，四边拉伸"]]} />
        </dl>
      </DialogContent>
    </Dialog>
  )
}
