import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MOD } from "@/editor/browser"
import { allCommands, type Commands } from "@/editor/hooks/useCommands"
import { keyLabel } from "@/editor/keymap"
import { TOOL_KEYS } from "@/editor/tools/keys"

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

// Hover hotkeys are chemistry, not commands: they depend on what is under the pointer.
const HOVER_KEYS: [string, string][] = [
  ["1 / 0", "延长碳链 / 向上加一根键"],
  ["2 / 8 / z", "羰基 / 双键 / 三键"],
  ["3 / a", "原子上接苯环。键上 3 改三键，a 才并苯环"],
  ["键上 2 w y", "改成双键、实楔、波浪键"],
  ["4 / 5", "实楔 / 虚楔"],
  ["6 7 v u", "环己、环戊、环丙、环丁；已有两根键时变成螺环"],
  ["j / J", "两种朝向的椅式环己烷"],
  ["9 / K", "分叉；链中间的 K 是一实一虚，末端的 K 是叔丁基"],
  ["o n s f …", "换成 OH、NH₂、SH、F。大写 O N F 是 OMe、NO₂、CF₃"],
  ["Enter / + −", "编辑这个原子的标签 / 加减电荷"],
  ["g / Tab / 空格", "选中这个原子 / 选中整个分子"],
]

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
          <Section title="悬停时" rows={HOVER_KEYS} />
          <Section title="没悬停时：工具" rows={toolRows} />
          <Section title="编辑" rows={commandRows} />
          <Section title="鼠标" rows={[["单击空白", "画一条水平键"], ["选中后", "拖外框的点：顶上旋转，四角缩放，四边拉伸"]]} />
        </dl>
      </DialogContent>
    </Dialog>
  )
}
