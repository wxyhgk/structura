import { attachment } from "../figures/markush.ts"
import { anywhereOnRing } from "../tutorials/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { P, Steps, Tip } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const attachmentPage = definePage({
  id: "attachment",
  group: "通式（Markush）",
  title: "可变连接（接在环的任意位置）",
  keywords: "可变连接 环中心 任意位置 取代基 虚线 位置 重复 (R)m (R1)n 次数 0-4",
  body: (context) => (
    <>
      <Tutorial title="画一个接在环上任意位置的取代基" steps={anywhereOnRing(context)} />
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
      <P>取代基出现多次，即专利里的 (R1)m，m = 0–4：</P>
      <Steps>
        <li>画好可变连接后，在右侧“通式变量 → 可变连接”里勾选“重复出现”。</li>
        <li>填次数的名字（m、n）和范围，比如 0 到 4；最多不能超过环上的位置数。画布上显示为 (R1)m。</li>
        <li>批量生成时，按每个次数取所有不同位置的组合，每个 R1 各自取候选项；0 次就是没有取代基。</li>
      </Steps>
      <Tip>想撤掉，按 {context.mod}Z，或删除这个取代基。</Tip>
    </>
  ),
})
