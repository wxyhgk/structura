import assert from "node:assert/strict"
import test from "node:test"
import { command, createEditor, routeFieldKey, routeKey, type HoverTarget, type KeyEvent } from "@structura/engine"

/** A key press as the browser would send it; `prevented` says whether the router claimed it. */
function key(name: string, mods: Partial<Pick<KeyEvent, "metaKey" | "shiftKey" | "altKey">> = {}) {
  const event = { key: name, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods, prevented: false, preventDefault() {
    event.prevented = true
  } }
  return event
}

/** A canvas with nothing under the pointer, whose hover keys never apply. */
const idleCanvas = { pointed: (): HoverTarget => null, handleKey: () => false, hasGesture: () => false }

test("with nothing under the pointer and nothing selected, a tool key picks the tool and an element key the element", () => {
  const editor = createEditor()
  routeKey(key("6"), { editor, canvas: idleCanvas, commands: [] })
  assert.equal(editor.get().tool, "ring")
  assert.equal(editor.get().ringKind, "cyclohexane")
  routeKey(key("n"), { editor, canvas: idleCanvas, commands: [] })
  assert.equal(editor.get().tool, "atom")
  assert.equal(editor.get().atomEl, "N")
})

test("the canvas's hover keys come first; then the selection; then commands", () => {
  const editor = createEditor()
  editor.run([{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 1 }])
  let hovered = 0
  const canvas = { pointed: (): HoverTarget => ({ type: "atom", id: 2 }), handleKey: () => (hovered++, true), hasGesture: () => false }
  routeKey(key("1"), { editor, canvas, commands: [] })
  assert.equal(hovered, 1, "the canvas took it")
  // With the canvas declining, a selection takes the key: every selected atom grows.
  editor.selectEverything()
  const before = editor.latest().molecule.atoms.length
  const event = key("1")
  routeKey(event, { editor, canvas: idleCanvas, commands: [] })
  assert.equal(editor.latest().molecule.atoms.length, before + 2)
  assert.ok(event.prevented)
  // ⌘Z is a command.
  let undone = 0
  routeKey(key("z", { metaKey: true }), { editor, canvas: idleCanvas, commands: [command("撤销", () => undone++, { keys: [{ key: "z", meta: true }] })] })
  assert.equal(undone, 1)
})

test("in a text field only commands that work anywhere take a key", () => {
  let saved = 0
  const commands = [command("保存", () => saved++, { keys: [{ key: "s", meta: true }], inFields: true }), command("全选", () => assert.fail(), { keys: [{ key: "a", meta: true }] })]
  assert.equal(routeFieldKey(key("s", { metaKey: true }), commands), true)
  assert.equal(routeFieldKey(key("a", { metaKey: true }), commands), false)
  assert.equal(saved, 1)
})
