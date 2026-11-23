import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import { download, writeClipboard } from "../../src/editor/browser.ts"
import { selectionClipboard } from "../../src/editor/clipboard.ts"

type Globals = Record<string, unknown>
const saved: Globals = {}
/** Stands in for browser globals in node; undone after each test. */
function stub(values: Globals) {
  for (const [name, value] of Object.entries(values)) {
    if (!(name in saved)) saved[name] = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
}
afterEach(() => {
  for (const [name, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor as PropertyDescriptor)
    else delete (globalThis as Globals)[name]
    delete saved[name]
  }
})

/** A page whose clipboard API and execCommand("copy") answer as given; `copied` holds what the API took. */
function page({ api, exec }: { api?: "ok" | "denied" | "none"; exec?: boolean | "throws" }) {
  const copied: string[] = []
  const area = { value: "", style: {} as Record<string, string>, select() {}, remove() {} }
  stub({
    window: { isSecureContext: api !== "none" },
    navigator: {
      userAgent: "",
      clipboard:
        api === "none"
          ? undefined
          : {
              writeText: async (text: string) => {
                if (api === "denied") throw new DOMException("not focused", "NotAllowedError")
                copied.push(text)
              },
            },
    },
    document: {
      body: { appendChild() {} },
      createElement: () => area,
      execCommand: () => {
        if (exec === "throws") throw new Error("unsupported")
        return exec ?? false
      },
    },
  })
  return copied
}

test("writeClipboard says whether the browser took the text", async () => {
  const copied = page({ api: "ok" })
  assert.equal(await writeClipboard("CCO"), true)
  assert.deepEqual(copied, ["CCO"])

  page({ api: "denied", exec: true })
  assert.equal(await writeClipboard("CCO"), true, "the selection-based copy is the way out of a refused API")
  page({ api: "denied", exec: false })
  assert.equal(await writeClipboard("CCO"), false)
  page({ api: "none", exec: "throws" })
  assert.equal(await writeClipboard("CCO"), false)
})

const fakeEditor = () => {
  const calls = { removed: 0 }
  const editor = {
    selectionMolfile: () => "molfile text",
    removeSelection: () => void calls.removed++,
  }
  return { calls, editor: editor as unknown as Parameters<typeof selectionClipboard>[0] }
}

test("cut deletes the selection only once the clipboard has it", async () => {
  const flashed: string[] = []
  page({ api: "denied", exec: false })
  const refused = fakeEditor()
  await selectionClipboard(refused.editor, () => {}, (message) => flashed.push(message)).cut()
  assert.equal(refused.calls.removed, 0)
  assert.match(flashed[0], /没能剪切.*没有删除/)

  page({ api: "ok" })
  const taken = fakeEditor()
  await selectionClipboard(taken.editor, () => {}, (message) => flashed.push(message)).cut()
  assert.equal(taken.calls.removed, 1)
  assert.equal(flashed.length, 1)
})

test("a refused copy says so", async () => {
  const flashed: string[] = []
  page({ api: "denied", exec: false })
  await selectionClipboard(fakeEditor().editor, () => {}, (message) => flashed.push(message)).copy()
  assert.match(flashed[0], /没能复制/)
})

test("a download's link is on the page while it is clicked, and its URL outlives the click", async () => {
  const events: string[] = []
  const link = {
    href: "",
    download: "",
    style: {} as Record<string, string>,
    click: () => events.push(`click attached=${attached}`),
    remove: () => {
      attached = false
      events.push("remove")
    },
  }
  let attached = false
  const timers: Array<() => void> = []
  stub({
    document: {
      createElement: () => link,
      body: {
        appendChild: () => {
          attached = true
          events.push("append")
        },
      },
    },
    setTimeout: (run: () => void) => void timers.push(run),
  })
  const realCreate = URL.createObjectURL
  const realRevoke = URL.revokeObjectURL
  URL.createObjectURL = () => "blob:x"
  URL.revokeObjectURL = () => void events.push("revoke")
  try {
    download("a.txt", "hello", "text/plain")
    assert.deepEqual(events, ["append", "click attached=true", "remove"], "not revoked yet")
    timers[0]()
    assert.equal(events.at(-1), "revoke")
  } finally {
    URL.createObjectURL = realCreate
    URL.revokeObjectURL = realRevoke
  }
})
