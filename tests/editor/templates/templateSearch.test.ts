import assert from "node:assert/strict"
import test from "node:test"
import { builtinTemplates, type Template, type TemplateInput } from "@structura/markush"
import { readLibrary } from "../../../src/editor/templates/libraryFile.ts"
import {
  aliasesFromText,
  builtinsFirst,
  filterTemplates,
  groupNames,
  groupTemplates,
  inList,
  quickPicks,
  templateMatches,
  templateTitle,
} from "../../../src/editor/templates/templateSearch.ts"

const mine = (id: string, input: TemplateInput): Template => ({ ...input, id, source: "user", createdAt: "t", updatedAt: "t" })
const pyridyl = mine("u1", { name: "吡啶基", aliases: ["pyridyl", "Py"], group: "杂芳基", site: "end", alternative: { kind: "class", class: "heteroaryl", min: 5, max: 5 } })
const ethylene = mine("u2", { name: "亚乙基", group: "我的模板", site: "link", alternative: { kind: "class", class: "alkyl", min: 2, max: 2 } })
const builtins = builtinTemplates()
const all = [pyridyl, ...builtins, ethylene]

test("a query finds a template by its name or another name, whatever the case, spaces or dash", () => {
  assert.ok(templateMatches(pyridyl, "PYRID"))
  assert.ok(templateMatches(pyridyl, "py"))
  assert.ok(templateMatches(pyridyl, "吡啶"))
  assert.ok(templateMatches(pyridyl, "  "))
  assert.ok(!templateMatches(pyridyl, "苯"))
  const alkyl = builtins.find((template) => template.alternative.kind === "class" && template.alternative.class === "alkyl")!
  assert.ok(templateMatches(alkyl, "c1-c30"))
  assert.ok(templateMatches(alkyl, "C1 – C30 烷基"))
})

test("built-ins come first, then the user's, each kept in order", () => {
  const sorted = builtinsFirst(all)
  assert.deepEqual(sorted.slice(0, builtins.length), builtins)
  assert.deepEqual(sorted.slice(builtins.length), [pyridyl, ethylene])
})

test("filtering keeps the variable's site unless every site is asked for", () => {
  const ends = filterTemplates(all, { site: "end" })
  assert.ok(ends.length > 0 && ends.every((template) => template.site === "end"))
  assert.equal(ends.at(-1), pyridyl)
  assert.deepEqual(filterTemplates(all, { site: "link", query: "亚乙" }), [ethylene])
  assert.deepEqual(filterTemplates(all, { site: "end", query: "亚乙" }), [])
  assert.deepEqual(filterTemplates(all, { site: "end", query: "亚乙", allSites: true }), [ethylene])
})

test("a card's quick picks are the user's own newest first, then the favourite built-ins for that site", () => {
  assert.ok(quickPicks(all, "end", 3).length <= 3)
  const link = quickPicks(all, "link")
  assert.ok(link.every((template) => template.site === "link"))
  assert.equal(link[0], ethylene, "the user's own comes first")
  assert.ok(link.some((template) => template.id === "builtin:bond"), "then the single bond")
  const end = quickPicks(builtinTemplates(), "end").map((template) => template.id)
  assert.equal(end[0], "builtin:alkyl-c1-c30", "the classes claims name most lead")
  for (const site of ["end", "link", "ring"] as const) assert.ok(quickPicks(builtinTemplates(), site).length >= 5, `every favourite for ${site} exists`)
})

test("templates sit on their shelves, in the order the shelves first appear", () => {
  const shelves = groupTemplates([pyridyl, ethylene, mine("u3", { ...pyridyl, name: "嘧啶基" })])
  assert.deepEqual(
    shelves.map((shelf) => [shelf.group, shelf.templates.map((template) => template.name)]),
    [
      ["杂芳基", ["吡啶基", "嘧啶基"]],
      ["我的模板", ["亚乙基"]],
    ],
  )
})

test("shelf suggestions list each once, the user's first", () => {
  const names = groupNames(all)
  assert.deepEqual(names.slice(0, 2), ["杂芳基", "我的模板"])
  assert.equal(new Set(names).size, names.length)
})

test("a template already in the list is told apart", () => {
  assert.ok(inList([{ kind: "label", text: "H" }, pyridyl.alternative], pyridyl))
  assert.ok(!inList([{ kind: "label", text: "H" }], pyridyl))
})

test("other names are typed with commas of either kind", () => {
  assert.deepEqual(aliasesFromText(" pyridyl，Py, ,Py、吡啶 "), ["pyridyl", "Py", "吡啶"])
  assert.deepEqual(aliasesFromText(""), [])
})

test("a chip's hover text names the template, its other names and what it adds", () => {
  assert.match(templateTitle(pyridyl), /^吡啶基（也叫 pyridyl、Py）：.*杂芳基/)
})

test("a library file is read when it is one, and refused with a reason when not", () => {
  const library = { format: "structura-templates", version: 1, templates: [pyridyl] }
  assert.deepEqual(readLibrary(JSON.stringify(library)), library)
  assert.throws(() => readLibrary("{"), /不是 JSON/)
  assert.throws(() => readLibrary(JSON.stringify({ templates: [] })), /不是 Structura 模板库/)
  assert.throws(() => readLibrary(JSON.stringify({ ...library, version: 2 })), /版本/)
})
