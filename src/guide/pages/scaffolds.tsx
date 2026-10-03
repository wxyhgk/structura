import { templates } from "../tutorials/drawing.ts"
import { H, P, Table, Tip } from "../ui/parts.tsx"
import { Tutorial } from "../ui/Tutorial.tsx"
import { definePage } from "../types.ts"

export const scaffoldsPage = definePage({
  id: "scaffolds",
  group: "绘图",
  title: "模板分子",
  keywords: "模板 环系 咔唑 二苯并呋喃 吡啶 三嗪 位点 编号 并环 接上 scaffold",
  body: (context) => (
    <>
      <Tutorial title="用模板拼出一个分子" steps={templates(context)} />
      <P>常用的环系都在“模板”里：苯、吡啶、嘧啶、吡嗪、三嗪、呋喃、噻吩、吡咯，萘、喹啉、吲哚、苯并呋喃/噻吩/咪唑/噁唑/噻唑，蒽、菲、芴、咔唑、二苯并呋喃/噻吩、吩噁嗪、吩噻嗪。</P>
      <H>三种放法</H>
      <Table
        rows={[
          ["点画布空白处", "放一个完整的模板"],
          ["点一个原子", "用选好的位点（如咔唑的 N9、吡啶的 C2）接到这个原子上，模板朝外摆好"],
          ["点一根键", "用选好的边（a、b、c……）并到这根键上，双键自动重新排"],
        ]}
      />
      <H>位点和边的名字</H>
      <P>原子按 IUPAC 编号：C1、C2……，稠合处的原子是 C4a、C9a，杂原子带元素符号（N9、O5）。外圈的键按编号顺序依次叫 a、b、c……，例如萘的 a 是 C1–C2，b 是 C2–C3。在模板面板右边的大图上点编号或字母就能选。</P>
      <Tip>只有还带氢的原子能接东西；稠合处的 C4a 这类原子不会出现在可选的编号里。</Tip>
    </>
  ),
})
