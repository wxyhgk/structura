import { attachment, curvedAttachments } from "../figures/markush.ts"
import { anywhereOnRing } from "../tutorials/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { P, Steps, Tip } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const attachmentPage = definePage({
  id: "attachment",
  group: "通式（Markush）",
  title: "可变连接（接在环的任意位置）",
  keywords: "可变连接 环中心 任意位置 取代基 虚线 位置 重复 (R)m (R1)n 次数 0-4 稠环 咔唑 整个 画法 椭圆 弧线 曲线 直线",
  body: (context) => (
    <>
      <Tutorial title="画一个接在环上任意位置的取代基" steps={anywhereOnRing(context)} />
      <P>表示“这个取代基可以接在这个环的任一空位上”。</P>
      <Steps>
        <li>最快：用键工具从环的中心往外拖到空白处，松开，就得到一个接在环上任意位置的 R1（已有 R1 时是 R2），再按需要改标签。</li>
        <li>已经画好的取代基：从它（或它的起点原子）画一根键，终点拖进环的中心，松开。</li>
        <li>拖动时会提示可接的位置；画好后用细线连到这些位置。</li>
        <li>批量生成时会逐个位置展开；已经接了别的基团的位置自动跳过。</li>
        <li>稠环（咔唑、二苯并呋喃、萘……）上“任意位置”：先拖进其中一个环，再在通式工作区画布下方的“概览”或“位置”里点“扩大到整个稠环体系”，所有能接取代基的位置都算上（稠合处的原子不算）。要改回单个环，撤销或重新画那根线。</li>
      </Steps>
      <Figure
        panels={[
          { drawing: attachment().drawing, caption: "R1（= Cl）可接在环的任一空位" },
          ...attachment().products.map((drawing) => ({ drawing })),
        ]}
        steps={["生成", "", ""]}
      />
      <P>接在整个稠环体系上时，像专利图那样画成曲线，跟着原子走，导出的图片里也一样：</P>
      <Steps>
        <li>椭圆：一个椭圆把整个稠环圈起来，取代基用一根直线连到椭圆上，表示“接在这些环的任意位置”。单独的取代基（R1、(R1)n）默认这样画。</li>
        <li>弧线：从连接基团（如 N–L2 里的 L2）出来的键接着绕稠环转大约四分之三圈，末端收在里面，表示“L2 接在这些环的任一位置”。本身还连着别的原子的默认这样画。</li>
        <li>只在一个环里的，仍是一根短直线连进环的中心。</li>
        <li>想换画法：在“位置”里每个可变连接下面的“画法”选 自动 / 直线 / 椭圆 / 弧线；或在画布上右键这个取代基，选“可变连接画法”。只改画法，不改能接的位置；{context.mod}Z 可撤销。</li>
      </Steps>
      <Figure
        panels={[
          { drawing: curvedAttachments().loop, caption: "(R1)n 接在萘的任意位置：椭圆" },
          { drawing: curvedAttachments().arc, caption: "L2 接在咔唑的任意位置：弧线" },
        ]}
      />
      <P>取代基出现多次，即专利里的 (R1)m，m = 0–4：</P>
      <Steps>
        <li>画好可变连接后，在通式工作区画布下方的“位置”里勾选“重复出现”。</li>
        <li>填次数的名字（m、n）和范围，比如 0 到 4；最多不能超过环上的位置数。画布上显示为 (R1)m。</li>
        <li>批量生成时，按每个次数取所有不同位置的组合，每个 R1 各自取候选项；0 次就是没有取代基。</li>
      </Steps>
      <Tip>想撤掉，按 {context.mod}Z，或删除这个取代基。</Tip>
    </>
  ),
})
