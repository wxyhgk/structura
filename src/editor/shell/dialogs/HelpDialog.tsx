import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ATOM_KEYS, BOND_KEYS } from "@/chem/hotkeys"
import { MOD } from "@/editor/browser"
import { allCommands, type Commands } from "@/editor/hooks/useCommands"
import { keyLabel } from "@/editor/keymap"
import { TOOL_KEYS } from "@/editor/tools/keys"
import { describeAtomAction, describeBondAction, hotkeyLabel } from "@/editor/hotkeys/describe"

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>
            悬停在原子上（蓝圈）再按键，会直接接上结构。绿圈是下一次按键的位置，鼠标先别动可以连按。鼠标挪到别的原子上之后，按键就作用在那里。没悬停时，按键切换工具。
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <Section title="悬停在原子上" rows={[...hotkeyRows(ATOM_KEYS, describeAtomAction), ...HOVER_EXTRAS]} />
          <Section title="悬停在键上" rows={hotkeyRows(BOND_KEYS, describeBondAction)} />
          <Section title="没悬停时：工具" rows={toolRows} />
          <Section title="编辑" rows={commandRows} />
          <Section title="鼠标" rows={[["单击空白", "画一条水平键"], ["选中后", "拖外框的点：顶上旋转，四角缩放，四边拉伸"]]} />
        </dl>
      </DialogContent>
    </Dialog>
  )
}
