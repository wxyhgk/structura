import { perHost, press, Walk } from "./walk.ts"

// Walk-throughs for the drawing pages.

/** From an empty page to 4-ethyltoluene with hover keys only. */
export const firstMolecule = perHost(({ pressKey }) => {
  const walk = new Walk()
  const [left, right] = walk.act([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, angle: 0 },
  ])
  walk.step(`选键工具（按 [B]），在空白处单击，画出一根键。`, [{ kind: "click", at: left }])
  walk.step(`把鼠标移到右端的原子上，出现蓝圈：下一次按键就作用在这里。`, [{ kind: "hover", atom: right }])
  const [tip] = press(walk, pressKey, right, "1")
  walk.step(`按 [1]，接上一个碳。新的末端成为“热点”，蓝圈跟过去。`, [{ kind: "key", key: "1", atom: right }])
  walk.step(`鼠标不用动，蓝圈已经在新末端上。`, [{ kind: "hover", atom: tip }])
  const ring = press(walk, pressKey, tip, "a")
  walk.step(`按 [A]，末端变成苯环。`, [{ kind: "key", key: "A", atom: tip }])
  const para = walk.farthest(tip, ring)
  walk.step(`把鼠标移到苯环对面（对位）的原子上。`, [{ kind: "hover", atom: para }])
  press(walk, pressKey, para, "1")
  walk.step(`按 [1]，接上一个甲基。整个分子只用了鼠标悬停和三次按键。`, [{ kind: "key", key: "1", atom: para }])
  return walk.steps
})

/** Typing a label: toluene's methyl becomes OH, then a ring atom becomes N. */
export const typingLabels = perHost(({ pressKey }) => {
  const walk = new Walk()
  walk.act([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  const [end] = press(walk, pressKey, 1, "1")
  walk.step(`先画一个甲苯：苯环上悬停一个原子按 [1]。`)
  walk.step(`双击末端的原子，原子上出现输入框。`, [{ kind: "double", atom: end }])
  walk.act([{ op: "label", atom: end, text: "OH" }])
  walk.step(`输入 OH，按 [Enter]：变成羟基，氢原子数自动算出。`)
  const ring = walk.drawing.molecule.atoms.filter((atom) => atom.id <= 6).map((atom) => atom.id)
  const across = walk.farthest(1, ring)
  walk.step(`不双击也行：悬停一个原子，按 [Enter] 一样能输入。`, [{ kind: "key", key: "Enter", atom: across }])
  walk.act([{ op: "label", atom: across, text: "N" }])
  walk.step(`输入 N 回车，这个环原子换成氮。`)
  return walk.steps
})

/** Selecting one of two molecules, moving it and turning it. */
export const moveAndTurn = perHost(() => {
  const walk = new Walk()
  walk.act([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_ring", at: { x: 140, y: 0 }, kind: "cyclohexane" },
  ])
  const benzene = [1, 2, 3, 4, 5, 6]
  walk.step(`画布上有两个分子，只想动左边的苯环。`)
  walk.step(`选框选工具（按 [M]），从左上往右下拖出一个方框，把苯环框进去。`, [
    { kind: "box", from: { x: -55, y: -50 }, to: { x: 55, y: 50 } },
    { kind: "select", atoms: benzene },
  ])
  walk.act([{ op: "move", atoms: benzene, dx: 0, dy: 70 }])
  walk.step(`按住选中的部分往下拖，松开。`, [
    { kind: "select", atoms: benzene },
    { kind: "drag", from: { x: 0, y: 0 }, to: { x: 0, y: 70 } },
  ])
  walk.act([{ op: "rotate", atoms: benzene, angle: Math.PI / 12 }])
  walk.step(`按 [⌥][←] 逆时针转 15°（也可以拖选框顶上的圆点）。`, [{ kind: "select", atoms: benzene }])
  walk.step(`按 [Esc] 取消选中。`)
  return walk.steps
})
