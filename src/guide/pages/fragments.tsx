import { expanded, pieces } from "../figures/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { H, P, Steps, Table, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const fragmentsPage = definePage({
  id: "fragments",
  group: "通式（Markush）",
  title: "画出来的片段",
  keywords: "片段 星号 * 连接点 咔唑 萘撑 嵌套 用选中的结构 NR CMe2",
  body: () => (
    <>
      <P>当候选项是一个具体的结构（咔唑-9-基、2,6-萘撑、N–R5……），缩写表里没有时，就把它画出来。</P>
      <Steps>
        <li>在画布空白处单独画出片段，不要连在通式上。</li>
        <li>在片段上接一个原子，双击它输入 <b>*</b>，表示从这里接到通式上。</li>
        <li>用框选或套索选中整个片段（包括 *）。</li>
        <li>在右边对应变量那一行点“+ 用选中的结构”。片段离开画布，成为这个变量的候选项（可以撤销）。</li>
      </Steps>
      <H>* 怎么画</H>
      <Table
        rows={[
          ["接一端的取代基（R1、Ar1）", "一个 *，接在连接原子上"],
          ["连接基（L）", "两个 *，分别接在两端的原子上"],
          ["环里的原子（X = N–R5、CMe2、SiPh2）", "两个 *，都接在同一个原子上，这个原子会占住环里的位置"],
        ]}
      />
      <Figure
        panels={[
          { drawing: pieces().carbazolyl, caption: "咔唑-9-基：一个 *" },
          { drawing: pieces().naphthylene, caption: "2,6-萘撑：两端各一个 *" },
          { drawing: pieces().nR5, caption: "N–R5：两个 * 都在 N 上" },
        ]}
      />
      <H>片段里还可以有变量</H>
      <P>片段里的 R5 也是变量，面板里会出现它（标“在片段里”），照常定义。批量生成时一起展开，最多嵌套 4 层；变量不能通过片段包含自己。</P>
      <Tip>选得不对时，面板会说明原因：没有 *、还连着通式、不是一整块等。</Tip>
      <H>效果</H>
      <P>上面的通式里 X = O 或 N–R5（R5 = Ph），L = 单键或 2,6-萘撑，Ar1 = 咔唑-9-基，生成：</P>
      <Figure panels={expanded().map((drawing) => ({ drawing }))} />
    </>
  ),
})
