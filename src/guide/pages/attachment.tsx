import { attachment } from "../figures/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { P, Steps, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const attachmentPage = definePage({
  id: "attachment",
  group: "通式（Markush）",
  title: "可变连接（接在环的任意位置）",
  keywords: "可变连接 环中心 任意位置 取代基 虚线 位置",
  body: ({ mod }) => (
    <>
      <P>表示“这个取代基可以接在这个环的任一空位上”。</P>
      <Steps>
        <li>从取代基（或它的起点原子）画一根键，终点拖进环的中心，松开。</li>
        <li>拖动时会提示可接的位置；画好后用细线连到这些位置。</li>
        <li>批量生成时会逐个位置展开；已经接了别的基团的位置自动跳过。</li>
      </Steps>
      <Figure
        panels={[
          { drawing: attachment().drawing, caption: "R1（= Cl）可接在环的任一空位" },
          ...attachment().products.map((drawing) => ({ drawing })),
        ]}
        steps={["生成", "", ""]}
      />
      <Tip>想撤掉，按 {mod}Z，或删除这个取代基。</Tip>
    </>
  ),
})
