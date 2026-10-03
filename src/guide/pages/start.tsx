import { hoverSteps } from "../figures/drawing.ts"
import { Figure } from "../ui/Figure.tsx"
import { H, K, P, Steps, Table, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const startPage = definePage({
  id: "start",
  group: "入门",
  title: "快速上手",
  keywords: "开始 入门 画布 平移 缩放 热点 蓝圈 撤销",
  body: ({ mod, pressKey }) => (
    <>
      <P>左边是工具和元素，中间是画布，画了通式变量时右边会出现“通式变量”面板。画布没有边界，视图不会自己移动或缩放。</P>
      <H>移动视图</H>
      <Table
        rows={[
          ["滚轮 / 触控板滑动", "平移"],
          [`按住 [空格] 拖动，或按住中键拖动`, "平移"],
          [`[${mod}] + 滚轮，或触控板捏合`, "缩放"],
          [`[${mod}][=] / [${mod}][-] / [${mod}][0]`, "放大 / 缩小 / 实际大小"],
        ]}
      />
      <H>最快的画法：悬停再按键</H>
      <Steps>
        <li>单击空白，画出第一根键。</li>
        <li>鼠标停在一个原子上（出现蓝圈），按键就在这里接结构：<K>1</K> 延长碳链，<K>3</K> 或 <K>A</K> 接苯环，<K>6</K> 接环己烷，<K>O</K> 换成氧……</li>
        <li>刚接上的结构末端会成为“热点”，蓝圈留在那里，鼠标不动可以连按。</li>
        <li>鼠标移到别的原子上，按键就作用在那里。</li>
      </Steps>
      <Figure
        panels={hoverSteps(pressKey).map((drawing, index) => ({ drawing, caption: ["单击空白：一根键", "悬停末端按 1", "再悬停新的末端按 A"][index] }))}
        steps={["按 1", "按 A"]}
      />
      <Tip>屏幕上始终只有一个蓝圈，它就是下一次按键作用的位置：先看鼠标悬停的原子，没有就看热点，再没有就看选中的原子。</Tip>
      <H>出错了</H>
      <Table
        rows={[
          [`[${mod}][Z] / [${mod}][⇧][Z]`, "撤销 / 重做"],
          ["[Esc]", "取消正在进行的操作 → 取消选中 → 回到套索工具"],
        ]}
      />
    </>
  ),
})
