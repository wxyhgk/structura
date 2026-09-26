import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MOD } from "@/editor/browser"

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
      <>
        <dt className="text-[#666]">{keys}</dt>
        <dd>{action}</dd>
      </>
    )
  }

  export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>
            悬停在原子上（蓝圈）再按键，会直接接上结构。绿圈是下一次按键的位置，鼠标先别动可以连按。鼠标挪到别的原子上之后，按键就作用在那里。没悬停时，下面这些键仍是工具。
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <Shortcut keys="1 / 0" action="延长碳链 / 向上加一根键" />
          <Shortcut keys="2 / 8 / z" action="羰基 / 双键 / 三键" />
          <Shortcut keys="3 / a" action="原子上接苯环。键上 3 改三键，a 才并苯环" />
          <Shortcut keys="键上 2 w y" action="改成双键、实楔、波浪键" />
          <Shortcut keys="4 / 5" action="实楔 / 虚楔" />
          <Shortcut keys="6 7 v u" action="环己、环戊、环丙、环丁；已有两根键时变成螺环" />
          <Shortcut keys="j / J" action="两种朝向的椅式环己烷" />
          <Shortcut keys="9 / K" action="分叉；链中间的 K 是一实一虚，末端的 K 是叔丁基" />
          <Shortcut keys="o n s f …" action="换成 OH、NH₂、SH、F。大写 O N F 是 OMe、NO₂、CF₃" />
          <Shortcut keys="Enter / + −" action="编辑这个原子的标签 / 加减电荷" />
          <Shortcut keys="单击空白" action="画一条水平键" />
          <Shortcut keys="V / M" action="没悬停时：套索 / 框选" />
          <Shortcut keys="B / K / R / E" action="没悬停时：单键 / 碳链 / 环 / 橡皮" />
          <Shortcut keys="X / 1 / 2 / 3 / Z" action="没悬停时：单键 / 单键 / 双键 / 三键 / 三键" />
          <Shortcut keys="W / ⇧W / Y" action="没悬停时：实楔键 / 虚楔键 / 波浪键" />
          <Shortcut keys="J / A" action="没悬停时：苯环工具" />
          <Shortcut keys="T / 4 – 8" action="没悬停时：三元环 / 四元到八元饱和环" />
          <Shortcut keys="选中后" action="拖外框的点：顶上旋转，四角缩放，四边拉伸" />
          <Shortcut keys={`${MOD}Z / ⇧${MOD}Z`} action="撤销 / 重做" />
        </dl>
      </DialogContent>
    </Dialog>
  )
}
