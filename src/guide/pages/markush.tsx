import { formula } from "../figures/markush.ts"
import { firstVariable } from "../tutorials/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { H, K, List, P, Steps, Tip } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const markushPage = definePage({
  id: "markush",
  group: "通式（Markush）",
  title: "变量和候选项",
  keywords: "取代基 任选被取代 成环 一起成环 R1和R2成环 但书 附加条件 排除 provided 通式 markush 变量 R1 X L 候选项 卤素 单键 类别 烷基 芳基 共用 相同",
  body: (context) => (
    <>
      <Tutorial title="定义一个变量并批量生成" steps={firstVariable(context)} />
      <P>专利里的通式：在结构上用 R1、X、L 这类变量占位，再规定每个变量可以是什么。</P>
      <Figure panels={[{ drawing: formula(), caption: "X 在环里，R1 在链的末端，L 在两个原子之间，Ar1 在末端" }]} />
      <H>定义变量</H>
      <Steps>
        <li>双击原子，输入变量名（R、R1、X、L、Ar、Ar1、ETU……），右边出现“通式变量”面板。Ar、Ar1、Ar' 都是芳基变量，不是氩。</li>
        <li>在变量下面的输入框里填候选项：元素或缩写，用逗号或顿号隔开，回车添加。“卤素”会展开成 F、Cl、Br、I；连接基可以填“单键”。</li>
        <li>范围类的候选项（“取代或未取代的 C1–C30 烷基”）点下面“模板：”一行里的模板（更多在“模板库…”里，见“模板库”），或点“+ 类别…”自己选类别、碳数或环原子数、取代与否。类别会保持为类别，不展开。</li>
        <li>“任选被 1～3 个选自 F、Cl、CN 的基团取代”：在“更多…”里填“取代基选自”和个数。批量生成时，代表结构除了本身，还会带上这些取代基（放在离连接点最远的位置，如苯基的对位；最多示例 2 个），名字写成“Ph（F、Cl）”。</li>
        <li>具体的结构（咔唑基、萘撑、N–R5……）画出来收进去，见“画出来的片段”。</li>
      </Steps>
      <H>几个变量用同一组候选项</H>
      <P>“R1 至 R4 各自独立地选自……”：先把 R1 填好，再在 R2–R4 的下拉框里选“与 R1 相同”。以后只改 R1 即可。</P>
      <H>两个变量一起成环</H>
      <Steps>
        <li>“R1 和 R2 与所连原子一起形成 5～6 元环”：在面板“成环”里点“两个变量可以一起成环”，选 R1 与 R2，写能成的环，如 <K>(CH2)3-4</K>、<K>OCH2O</K>（苯并二氧戊环）、<K>CH=CHCH=CH</K>（并苯环）、<K>C(=O)NH</K>。</li>
        <li>批量生成时，除了 R1、R2 各自取值的组合，还会加上每一种成环的结构，取值写成“R1+R2 = (CH2)3”；库大小也一并计入。</li>
        <li>R1、R2 要各出现一次、都在链末端，才能一起成环。</li>
      </Steps>
      <H>附加条件（但书）</H>
      <Steps>
        <li>“当 X 为 O 时，R1 不为 H”“R1 和 R2 不同时为 H”：在面板“附加条件”里点“排除一种组合”，选变量、勾选取值，可以再加一个变量（几个条件同时成立才排除）。条件里可以选基团类别，代表结构都会被排除。</li>
        <li>“条件是该化合物不是……”：点“排除一个化合物”，填它的 SMILES；生成时按标准 SMILES 比对（需要勾选“去掉重复的化合物”）。</li>
        <li>批量生成时被排除的组合不会出现，上方会写排除了几个。用到某个变量的条件存在时，这个变量不能删。</li>
      </Steps>
      <H>变量的位置决定能放什么</H>
      <List>
        <li>链的末端（R1）：一价基团或原子，比如 H、Cl、Me、Ph。</li>
        <li>环里（X）：元素，比如 O、S；“X 为 N 或 CR3”直接输入 <K>N, CR3</K>（也可以 NR5、CR3R4，CH 就是 C），R3 再单独定义；其他带取代基的原子用片段。</li>
        <li>两个原子之间（L）：单键、亚芳基、O、S，或两端都有 * 的片段；链长可变的 (CH₂)ₙ 直接输入 <K>(CH2)1-4</K>，每个长度一个候选项，从 0 开始时 0 就是单键。</li>
      </List>
      <Tip>放不下的候选项不会报错，批量生成时会跳过并在提示里说明。</Tip>
    </>
  ),
})
