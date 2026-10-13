// A .zip of text files, written in the page: stored (not compressed), which every unzip and
// Python's zipfile read; names in UTF-8, so Chinese ones survive.

/** A file of the archive: its path inside it ("cdxml/C-1.cdxml") and its contents. */
export type ZipEntry = { path: string; contents: string | Uint8Array }

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/** The CRC-32 a zip records for each file. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** MS-DOS time and date, as zip headers keep them (two-second resolution, from 1980). */
function dosTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** The files as one .zip archive. */
export function zip(entries: readonly ZipEntry[], date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const { time, day } = dosTime(date)
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const data = typeof entry.contents === "string" ? encoder.encode(entry.contents) : entry.contents
    const crc = crc32(data)
    // Version 2.0, bit 11: the name is UTF-8; method 0: stored.
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true)
    local.setUint16(10, time, true)
    local.setUint16(12, day, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    const header = new DataView(new ArrayBuffer(46))
    header.setUint32(0, 0x02014b50, true)
    header.setUint16(4, 20, true)
    header.setUint16(6, 20, true)
    header.setUint16(8, 0x0800, true)
    header.setUint16(10, 0, true)
    header.setUint16(12, time, true)
    header.setUint16(14, day, true)
    header.setUint32(16, crc, true)
    header.setUint32(20, data.length, true)
    header.setUint32(24, data.length, true)
    header.setUint16(28, name.length, true)
    header.setUint32(42, offset, true)
    parts.push(new Uint8Array(local.buffer), name, data)
    central.push(new Uint8Array(header.buffer), name)
    offset += 30 + name.length + data.length
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, directorySize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}
