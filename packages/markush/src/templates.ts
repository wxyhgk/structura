import type { Template, TemplateInput } from "@structura/core/markush"

// The templates that come with the app: read-only, the same for every user, kept in code so
// they change with the app's versions. The user's own templates live elsewhere (the backend).

/** A fixed time for built-ins, so they compare equal across runs. */
const SHIPPED = "2026-10-07T00:00:00.000Z"

const builtin = (key: string, input: TemplateInput): Template => ({ ...input, id: `builtin:${key}`, source: "builtin", createdAt: SHIPPED, updatedAt: SHIPPED })

/** Every built-in template, in the order the library shows them. */
export function builtinTemplates(): Template[] {
  return [
    builtin("alkyl-c1-c30", { name: "C1–C30 烷基", aliases: ["alkyl"], group: "类别", site: "end", alternative: { kind: "class", class: "alkyl", min: 1, max: 30 } }),
    builtin("aryl-c6-c30", { name: "C6–C30 芳基", aliases: ["aryl"], group: "类别", site: "end", alternative: { kind: "class", class: "aryl", min: 6, max: 30 } }),
    builtin("heteroaryl-c2-c30", {
      name: "C2–C30 杂芳基",
      aliases: ["heteroaryl"],
      group: "类别",
      site: "end",
      alternative: { kind: "class", class: "heteroaryl", min: 2, max: 30, unit: "carbons" },
    }),
    builtin("silyl", { name: "甲硅烷基", aliases: ["silyl"], group: "类别", site: "end", alternative: { kind: "class", class: "silyl" } }),
    builtin("amino", { name: "氨基", aliases: ["amino"], group: "类别", site: "end", alternative: { kind: "class", class: "amino" } }),
    builtin("bond", { name: "单键", aliases: ["bond", "direct bond"], group: "连接基", site: "link", alternative: { kind: "bond" } }),
    builtin("arylene-c6-c30", { name: "C6–C30 亚芳基", aliases: ["arylene"], group: "连接基", site: "link", alternative: { kind: "class", class: "arylene", min: 6, max: 30 } }),
    builtin("heteroarylene-c2-c30", {
      name: "C2–C30 亚杂芳基",
      aliases: ["heteroarylene"],
      group: "连接基",
      site: "link",
      alternative: { kind: "class", class: "heteroarylene", min: 2, max: 30, unit: "carbons" },
    }),
  ]
}
