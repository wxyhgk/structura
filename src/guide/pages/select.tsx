import { moveAndTurn } from "../tutorials/drawing.ts"
import { H, Table } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const selectPage = definePage({
  id: "select",
  group: "编辑",
  title: "选择、移动和变换",
  keywords: "选择 套索 框选 全选 双击 移动 旋转 翻转 复制 粘贴 删除 整理 替换 箭头 连接 合并 吸附 拼接",
  body: (context) => (
    <>
      <Tutorial title="选中、移动、旋转" steps={moveAndTurn(context)} />
      <H>选择</H>
      <Table
        rows={[
          [`套索 [V] / 框选 [M]`, "拖出范围选中"],
          [`[${context.mod}][A]`, "全选"],
          ["双击键", "选中它所在的整个分子"],
          [`悬停按 [G] / [Tab] / [空格]`, "选中这个原子 / 整个分子"],
          ["选中原子后按键", "每个选中的原子都接上结构（例如全选后按 1）"],
        ]}
      />
      <H>移动和变换</H>
      <Table
        rows={[
          ["拖动选中部分", "移动"],
          ["选框上的点", "顶上的点旋转，四角缩放，四边拉伸"],
          [`[⇧] + 方向键`, "移动 10 像素"],
          [`[⌥] + 方向键`, "旋转 15°"],
          [`[⇧][⌥] + 方向键`, "3D 翻转"],
          ["结构菜单", "旋转 180°、水平 / 垂直翻转"],
        ]}
      />
      <H>编辑</H>
      <Table
        rows={[
          [`[${context.mod}][C] / [${context.mod}][X] / [${context.mod}][V]`, "复制 / 剪切 / 粘贴（剪贴板里是 MOL 文本，也能粘贴 SMILES）；编辑菜单里也有，从菜单粘贴时浏览器会先询问是否允许读取剪贴板"],
          [`[${context.mod}][D]`, "在旁边复制一份"],
          [`[Delete] / [Backspace]`, "删除"],
          [`[${context.mod}][⇧][K]`, "整理结构（键长、键角、环形状），有选中时只整理选中部分"],
          [`[${context.mod}][E]`, "把选中的片段替换成别的基团"],
          ["拖到另一个原子上", "拖动原子或键靠近别的原子时会吸附过去（目标出现蓝圈），松开后两个原子合并成一个：键就接上了；把一根键整个放在另一根键上，两根键合并"],
          [`[${context.mod}][J]`, "选中两个分子各一个原子（或各一根键），连接成一个分子：小的那个移过去，原子合并（键则并在一起）"],
          [`[${context.mod}] + 方向键`, "在选中部分旁加一个反应箭头"],
        ]}
      />
    </>
  ),
})
