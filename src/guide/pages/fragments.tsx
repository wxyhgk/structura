import { expanded, pieces } from "../figures/markush.ts"
import { drawnPiece } from "../tutorials/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { H, P, Steps, Table, Tip } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const fragmentsPage = definePage({
  id: "fragments",
  group: "通式（Markush）",
  title: "画出来的片段",
  keywords: "片段 星号 * 连接点 咔唑 萘撑 嵌套 用选中的结构 画一个 画板 NR CMe2",
  body: (context) => (
    <>
      <Tutorial title="把画出来的片段收进变量" steps={drawnPiece(context)} />
      <P>当候选项是一个具体的结构（咔唑-9-基、2,6-萘撑、N–R5……），缩写表里没有时，就把它画出来。有两种画法。</P>
      <H>在小画板里画（最方便）</H>
      <Steps>
        <li>在变量那一行点“✎ 画一个”，弹出一个小画板，有单/双/三键、碳链、苯环和 3–7 元环、常用元素和橡皮；悬停在原子或键上按快捷键（1/2/3、a、n、o…）也照常能用。</li>
        <li>画出这个基团。不用画 *。</li>
        <li>点“◎ 设位点”，再点原子，把它设为<b>位点</b>（接到通式上的位置），原子上出现带编号的蓝圈；再点一次去掉。画板下面一行写着需要几个位点、现在设在哪里。</li>
        <li>点“添加到 R1”。在画板里画的东西不会动到主画布；以后点候选项里的结构小图，可以重新打开修改，位点照样显示在原子上。</li>
      </Steps>
      <Table
        rows={[
          ["变量在链末端（R1、Ar1）", "1 个位点；没设时默认用第一个画的原子（虚线圈“默认”）"],
          ["变量是连接基（L）", "2 个位点，两端各点一个（编号 1、2）；再点第三个原子会替换掉最早的"],
          ["变量在环里（X = O、N–R5）", "点一个原子（标“×2”），它占住环里的位置，和环成两根键"],
        ]}
      />
      <H>在主画布上画，再收进来</H>
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
