import { expanded, formula } from "../figures/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { Steps, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const enumeratePage = definePage({
  id: "enumerate",
  group: "通式（Markush）",
  title: "批量生成化合物",
  keywords: "批量生成 枚举 展开 代表结构 SDF 停止 上限",
  body: () => (
    <>
      <Steps>
        <li>点面板底部的“批量生成化合物…”（结构菜单里也有）。</li>
        <li>默认勾选“基团类别用代表结构展开”：烷基用甲基、乙基、异丙基、叔丁基，芳基用苯基、萘基等；不勾选时类别不展开。</li>
        <li>选择最多生成多少个（100 / 500 / 2000），组合太多时可以随时点“停止”。</li>
        <li>点“下载 SDF”：每条记录带着各变量的取值和连接位置，可以在其他软件里筛选。</li>
      </Steps>
      <Figure panels={[{ drawing: formula(), caption: "通式" }, { drawing: expanded()[0], caption: "其中一个化合物" }]} steps={["批量生成"]} />
      <Tip>对话框上方的提示会说明哪些候选项放不下被跳过、哪些位置已被占用、哪些组合生成失败及原因。</Tip>
    </>
  ),
})
