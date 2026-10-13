// Reads back a stored zip (as Structura writes them) for tests: its files by name, in order.
export function unzipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i++) {
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    files.set(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)), bytes.subarray(start, start + size))
    at += 46 + nameLength
  }
  return files
}
