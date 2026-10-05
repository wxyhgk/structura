import { labelled } from "../figures/drawing.ts"
import { typingLabels } from "../tutorials/drawing.ts"
import { Figure } from "../ui/Figure.tsx"
import { K, P, Table, Tip } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const labelsPage = definePage({
  id: "labels",
  group: "绘图",
  title: "原子标签和缩写",
  keywords: "标签 双击 Enter 元素 OH NH2 缩写 Me Ph OMe Boc 同位素 D 13C 展开 收起 位阻",
  body: (context) => (
    <>
      <Tutorial title="输入标签" steps={typingLabels(context)} />
      <P>
        双击原子，或悬停在原子上按 <K>Enter</K>，就能输入标签，回车确定。
      </P>
      <Table
        rows={[
          ["元素", "N、O、S、Cl、Br、Si……"],
          ["带氢的写法", "OH、NH2、SH、HO、H2N 也可以，氢原子数按价态自动计算"],
          ["缩写", "Me、Et、iPr、tBu、Ph、Bn、Ac、Boc、OMe、CO2Me、CF3、NO2 等，输入后画成真实的原子"],
          ["收起成标签", "Me、Et、iPr、tBu、Ph、Bn、Ac、Bz、Boc、Cbz、Fmoc、Ts、TBS、TMS 默认显示为标签，移动、删除、复制时整组一起；分子式按全部原子算"],
          ["展开 / 收起", "结构菜单的“展开缩写”“收起缩写”：有选中时只作用于选中的，没选中时作用于全部；看位阻时展开"],
          ["同位素", "D、T，或在元素前写质量数，如 13C、15N"],
          ["变量（通式）", "R、R1、X、L、Ar、Ar1、ETU 这类名字成为占位符，见“通式：变量和候选项”"],
          ["连接点", "* 表示片段接到通式上的位置，见“通式：画出来的片段”"],
        ]}
      />
      <Figure panels={[{ drawing: labelled(), caption: "在苯环的四个取代位上依次输入 OH、NH2、Me、OMe 的结果" }]} />
      <Tip>接在键上的 Ar 是芳基变量（和 Ar1、Ar' 一样），不是氩；要画氩原子，用元素周期表选 Ar，或给没有连键的单个原子输入 Ar。</Tip>
    </>
  ),
})
