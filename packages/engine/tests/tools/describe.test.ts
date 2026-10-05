import assert from "node:assert/strict"
import test from "node:test"
import { ATOM_KEYS, BOND_KEYS } from "../../src/hotkeys/lookup.ts"
import { describeAtomAction, describeBondAction, hotkeyLabel } from "../../src/tools/describe.ts"

test("every hover key has a description", () => {
  for (const [key, action] of Object.entries(ATOM_KEYS)) {
    const text = describeAtomAction(action)
    assert.ok(text && !text.includes("undefined"), `atom key ${key}: ${text}`)
  }
  for (const [key, action] of Object.entries(BOND_KEYS)) {
    const text = describeBondAction(action)
    assert.ok(text && !text.includes("undefined"), `bond key ${key}: ${text}`)
  }
})

test("descriptions follow the tables", () => {
  assert.equal(describeAtomAction(ATOM_KEYS.N), "接硝基")
  assert.equal(describeAtomAction(ATOM_KEYS.K), "末端接叔丁基，链中间接一实一虚两根键")
  assert.equal(describeBondAction(BOND_KEYS.z), "并环戊烯")
  assert.equal(describeAtomAction(ATOM_KEYS.d), "换成 ²H")
  assert.equal(hotkeyLabel("K"), "⇧K")
  assert.equal(hotkeyLabel("+"), "+")
})
