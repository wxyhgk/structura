import { formula } from "../figures/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { H, List, P, Steps, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const markushPage = definePage({
  id: "markush",
  group: "通式（Markush）",
  title: "变量和候选项",
  keywords: "通式 markush 变量 R1 X L 候选项 卤素 单键 类别 烷基 芳基 共用 相同",
  body: () => (
    <>
      <P>专利里的通式：在结构上用 R1、X、L 这类变量占位，再规定每个变量可以是什么。</P>
      <Figure panels={[{ drawing: formula(), caption: "X 在环里，R1 在链的末端，L 在两个原子之间，Ar1 在末端" }]} />
      <H>定义变量</H>
      <Steps>
        <li>双击原子，输入变量名（R、R1、X、L、Ar1、ETU……），右边出现“通式变量”面板。</li>
        <li>在变量下面的输入框里填候选项：元素或缩写，用逗号或顿号隔开，回车添加。“卤素”会展开成 F、Cl、Br、I；连接基可以填“单键”。</li>
        <li>范围类的候选项（“取代或未取代的 C1–C30 烷基”）点下面的预设按钮，或点“更多…”自己选类别、碳数或环大小、取代与否。类别会保持为类别，不展开。</li>
        <li>具体的结构（咔唑基、萘撑、N–R5……）画出来收进去，见“画出来的片段”。</li>
      </Steps>
      <H>几个变量用同一组候选项</H>
      <P>“R1 至 R4 各自独立地选自……”：先把 R1 填好，再在 R2–R4 的下拉框里选“与 R1 相同”。以后只改 R1 即可。</P>
      <H>变量的位置决定能放什么</H>
      <List>
        <li>链的末端（R1）：一价基团或原子，比如 H、Cl、Me、Ph。</li>
        <li>环里（X）：元素，比如 O、S；带取代基的原子（N–R5、CMe2）用片段。</li>
        <li>两个原子之间（L）：单键、亚芳基、O、S，或两端都有 * 的片段。</li>
      </List>
      <Tip>放不下的候选项不会报错，批量生成时会跳过并在提示里说明。</Tip>
    </>
  ),
})
