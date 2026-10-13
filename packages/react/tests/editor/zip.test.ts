import assert from "node:assert/strict"
import test from "node:test"
import { crc32 as nodeCrc32 } from "node:zlib"
import { crc32, zip } from "../../src/editor/zip.ts"

/** Reads a stored zip back through its central directory, as unzip would: names, data, CRCs checked. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  assert.equal(view.getUint32(end, true), 0x06054b50, "end of central directory")
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = new Map<string, string>()
  const decoder = new TextDecoder()
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50)
    assert.equal(view.getUint16(at + 8, true) & 0x0800, 0x0800, "names in UTF-8")
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    assert.equal(view.getUint32(local, true), 0x04034b50)
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = bytes.subarray(dataStart, dataStart + size)
    assert.equal(nodeCrc32(data), crc, `${name}'s CRC`)
    files.set(name, decoder.decode(data))
    at += 46 + nameLength
  }
  return files
}

test("CRC-32 as zlib computes it", () => {
  const data = new TextEncoder().encode("化合物 C-1\n".repeat(50))
  assert.equal(crc32(data), nodeCrc32(data))
  assert.equal(crc32(new Uint8Array()), 0)
})

test("a zip of text files reads back whole, Chinese names and contents included", () => {
  const archive = zip([
    { path: "manifest.json", contents: '{"a":1}' },
    { path: "cdxml/化合物1.cdxml", contents: "<CDXML/>" },
    { path: "empty.txt", contents: "" },
  ])
  assert.deepEqual([...unzip(archive)], [["manifest.json", '{"a":1}'], ["cdxml/化合物1.cdxml", "<CDXML/>"], ["empty.txt", ""]])
})
