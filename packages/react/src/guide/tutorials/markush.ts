import { type Alternative, enumerate, fragmentFrom } from "@structura/markush"
import { perHost, press, Walk } from "./walk.ts"

// Walk-throughs for the generic-formula pages.

const label = (text: string): Alternative => ({ kind: "label", text })

/** A variable from start to generated compounds: R1 on benzene, H/Cl/Me, then a class. */
export const firstVariable = perHost(({ pressKey }) => {
  const walk = new Walk()
  walk.act([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  const [end] = press(walk, pressKey, 1, "1")
  walk.step(`画一个苯环，悬停一个原子按 [1]，接出一根键。`, [{ kind: "key", key: "1", atom: 1 }])
  walk.step(`双击这根键末端的原子。`, [{ kind: "double", atom: end }])
  walk.act([{ op: "label", atom: end, text: "R1" }])
  walk.step(`输入 R1，按 [Enter]。右边出现“通式变量”面板，R1 还没有定义。`, [], { name: "R1", chips: [], note: "未定义" })
  walk.act([{ op: "set_variable", name: "R1", alternatives: [label("H"), label("Cl"), label("Me")] }])
  walk.step(`在 R1 下面的输入框里填 “H, Cl, Me”，回车。`, [], { name: "R1", chips: ["H", "Cl", "Me"] })
  walk.act([{ op: "set_variable", name: "R1", alternatives: [label("H"), label("Cl"), label("Me"), { kind: "class", class: "alkyl", min: 1, max: 30 }] }])
  walk.step(`再点 “+ C1–C30 烷基”：范围类的候选项保持为类别，不展开。`, [], { name: "R1", chips: ["H", "Cl", "Me", "取代或未取代的(C1–C30)烷基"] })
  const made = enumerate(walk.drawing, { representatives: true })
  const chloro = made.molecules[1]
  walk.show({ molecule: chloro, arrows: [], nextArrowId: 1 }, `点面板底部的“批量生成化合物…”：每个候选项生成一个化合物，烷基用甲基、乙基等代表结构。这里共 ${made.molecules.length} 个，图中是 R1 = Cl 的那个。`)
  return walk.steps
})

/** A substituent that may sit anywhere on a ring: a line into the ring's centre. */
export const anywhereOnRing = perHost(({ pressKey }) => {
  const walk = new Walk()
  walk.act([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  press(walk, pressKey, 1, "1")
  walk.step(`先画好甲苯。`)
  const [r] = walk.act([{ op: "place_atom", el: "C", at: { x: -10, y: 100 } }, { op: "label", atom: 8, text: "R1" }])
  walk.step(`在环的下方放一个原子，双击输入 R1。`, [{ kind: "double", atom: r }], { name: "R1", chips: [], note: "未定义" })
  walk.step(`选键工具，从 R1 按住拖到苯环的正中间，松开。`, [{ kind: "drag", from: r, to: { x: 0, y: 0 } }])
  walk.act([{ op: "set_attachment", atom: r, to: [2, 3, 4, 5, 6] }])
  walk.step(`松开后键变成一根指向环心的线：R1 可以接在这个环的任一空位上。`)
  walk.act([{ op: "set_variable", name: "R1", alternatives: [label("Cl")] }])
  walk.step(`在面板里给 R1 填 Cl。`, [], { name: "R1", chips: ["Cl"] })
  const made = enumerate(walk.drawing)
  walk.show({ molecule: made.molecules[1], arrows: [], nextArrowId: 1 }, `批量生成时 Cl 依次接到每个空位上，甲基所在的位置自动跳过（共 ${made.molecules.length} 个，图中是间位的那个）。`)
  return walk.steps
})

/** A drawn piece as an alternative: piperidin-1-yl for R1. */
export const drawnPiece = perHost(({ pressKey }) => {
  const walk = new Walk()
  walk.act([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  const [r] = press(walk, pressKey, 1, "1")
  walk.act([{ op: "label", atom: r, text: "R1" }])
  walk.step(`先画好通式：苯环上的 R1。现在要让 R1 可以是“哌啶-1-基”，缩写表里没有它。`, [], { name: "R1", chips: [], note: "未定义" })
  const ring = walk.act([{ op: "add_ring", at: { x: 190, y: 0 }, kind: "cyclohexane" }])
  walk.step(`在右边空白处单独画一个环己烷（环工具单击空白），不要连在通式上。`, [{ kind: "click", at: { x: 190, y: 0 } }])
  const top = walk.top(ring)
  walk.step(`双击环最上面的原子……`, [{ kind: "double", atom: top }])
  walk.act([{ op: "label", atom: top, text: "N" }])
  walk.step(`……输入 N 回车。这个 N 就是接到通式上的原子。`)
  const [star] = press(walk, pressKey, top, "1")
  walk.step(`悬停 N 按 [1]，接出一根键。`, [{ kind: "key", key: "1", atom: top }])
  walk.step(`双击新原子……`, [{ kind: "double", atom: star }])
  walk.act([{ op: "label", atom: star, text: "*" }])
  walk.step(`……输入 * 回车。* 表示“从这里接到通式上”。`)
  const piece = [...ring, star]
  walk.step(`用框选工具把整个片段框起来（包括 *）。`, [
    { kind: "box", from: { x: 135, y: -95 }, to: { x: 245, y: 55 } },
    { kind: "select", atoms: piece },
  ])
  walk.act([
    { op: "set_variable", name: "R1", alternatives: [label("H"), { kind: "fragment", molecule: fragmentFrom(walk.drawing.molecule, piece) }] },
    { op: "remove", atoms: piece },
  ])
  walk.step(`在 R1 那一行点 “+ 用选中的结构”：片段离开画布，成为 R1 的候选项（这里还填了 H）。`, [], { name: "R1", chips: ["H", "片段 C₅H₁₀N"] })
  const made = enumerate(walk.drawing)
  walk.show({ molecule: made.molecules[1], arrows: [], nextArrowId: 1 }, `批量生成：片段接在 R1 的位置上，N 和苯环相连。`)
  return walk.steps
})
