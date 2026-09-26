import assert from "node:assert/strict"
import test from "node:test"
import { keyLabel, matches } from "../../src/editor/keymap.ts"

const press = (key: string, mods: { meta?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
  key,
  metaKey: Boolean(mods.meta),
  ctrlKey: false,
  shiftKey: Boolean(mods.shift),
  altKey: Boolean(mods.alt),
})

test("key combinations match exactly on modifiers", () => {
  assert.equal(matches(press("z", { meta: true }), { key: "z", meta: true }), true)
  assert.equal(matches(press("Z", { meta: true, shift: true }), { key: "z", meta: true }), false, "undo is not redo")
  assert.equal(matches(press("Z", { meta: true, shift: true }), { key: "z", meta: true, shift: true }), true)
  assert.equal(matches(press("ArrowLeft", { shift: true }), { key: "ArrowLeft", shift: true }), true)
  assert.equal(matches(press("ArrowLeft", { shift: true, alt: true }), { key: "ArrowLeft", shift: true }), false)
  assert.equal(matches(press("+", { shift: true }), { key: "+" }), true, "+ needs Shift to type")
  assert.equal(matches({ ...press("a"), ctrlKey: true }, { key: "a", meta: true }), true, "Ctrl counts as meta")
})

test("combinations are labelled for menus", () => {
  assert.equal(keyLabel({ key: "z", meta: true, shift: true }, "⌘"), "⇧⌘Z")
  assert.equal(keyLabel({ key: "ArrowLeft", alt: true }, "⌘"), "⌥←")
  assert.equal(keyLabel({ key: "-", meta: true }, "Ctrl"), "Ctrl−")
})
