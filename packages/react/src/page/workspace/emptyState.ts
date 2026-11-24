import type { Drawing } from "@structura/core/types"

/**
 * Why there is nothing to generate yet, as the results pane tells the user what to do next;
 * null once the drawing has a structure and at least one variable, variable attachment or
 * repeat unit [ … ]n.
 */
export function emptyReason(drawing: Drawing): { title: string; hint: string } | null {
  if (drawing.molecule.atoms.length === 0) return { title: "画布上还没有结构", hint: "先在上面的画布里画出母核，再把可变的位置改成 R1、X 这样的标签。" }
  const variables = Object.keys(drawing.variables ?? {}).length
  const attachments = drawing.attachments?.length ?? 0
  const repeats = drawing.brackets?.some((bracket) => bracket.kind === "repeat") ?? false
  if (variables === 0 && attachments === 0 && !repeats)
    return {
      title: "这个结构还没有变量",
      hint: "把画布上的原子改成 R1、X 这样的标签（或从环中心画一条可变连接线），再在右边给变量填上候选项，生成的化合物会自动列在这里。",
    }
  return null
}
