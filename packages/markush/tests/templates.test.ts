import assert from "node:assert/strict"
import test from "node:test"
import { builtinTemplates, templateProblem } from "@structura/markush"

test("every built-in template is valid, suits its site, and has a unique builtin: id", () => {
  const templates = builtinTemplates()
  for (const template of templates) assert.equal(templateProblem(template), null, template.name)
  assert.ok(templates.every((template) => template.id.startsWith("builtin:") && template.source === "builtin"))
  assert.equal(new Set(templates.map((template) => template.id)).size, templates.length)
})
