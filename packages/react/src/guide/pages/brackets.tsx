import { groupBracket, labelledBracket, longerRepeat, repeatBracket } from "../figures/brackets.ts"
import { Figure } from "../ui/Figure.tsx"
import { H, P, Steps, Table, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const bracketsPage = definePage({
  id: "brackets",
  group: "绘图",
  title: "方括号",
  keywords: "方括号 括号 [ ] 重复单元 聚合物 (CH2)n n 次数 基团 稠环 SRU Sgroup",
  body: (context) => (
    <>
      <P>方括号是结构的一部分，不是另外画上去的线：它属于一组原子，按这些原子的位置画出来。原子移动、增删时括号跟着变，原子全删掉括号也就没了；保存、导出 SVG 和 MOL、复制粘贴都带着它。</P>
      <H>加方括号</H>
      <Steps>
        <li>选中要括起来的原子（框选、套索，或按住 Shift 点选）。</li>
        <li>结构菜单 → “加方括号”，或在选中的部分上右键 → “加方括号”。先加的是“基团”括号。</li>
        <li>在括号的竖线上右键，可以改成“重复单元”、设“重复次数…”、选中括号里的原子、删除括号。用选择工具点括号的竖线，选中它括住的原子，拖动就一起移动。</li>
      </Steps>
      <H>两种括号</H>
      <Table
        rows={[
          ["基团", "括住的片段当作一个整体，比如一个稠环体系，外面的键可以接在它的任意位置（专利里“接在括号内基团的任意位置”）"],
          ["重复单元", "[ … ]n、(CH2)n：括号横穿两边断开的键，次数的名字写在右括号右下角；“重复次数…”里填名字（n、m）和范围，比如 n = 1 到 4"],
        ]}
      />
      <Figure
        panels={[
          { drawing: groupBracket(), caption: "基团：括住整个菲环" },
          { drawing: repeatBracket(), caption: "重复单元：–(CH2)n–，键从括号中间穿过" },
        ]}
      />
      <Figure
        panels={[
          { drawing: longerRepeat(), caption: "两个碳一起重复，次数叫 m" },
          { drawing: labelledBracket(), caption: "括住带标签的基团，标签留在括号里面" },
        ]}
      />
      <H>文件里的括号</H>
      <P>保存的 .structura 文件原样保留括号和次数。导出 MOL 时，重复单元写成 SRU（右下角的名字作标签），基团写成 GEN，其他软件也能读出括号；打开或粘贴这样的 MOL 文件，括号会回到原子上。MOL 文件只记名字，不记次数范围，读回来是 1 到 4，需要时再改。</P>
      <Tip>改错了按 {context.mod}Z 撤销：加括号、改种类、改次数各算一步。</Tip>
    </>
  ),
})
