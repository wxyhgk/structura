// A stand-in for the browser's localStorage, for the tests of what is kept in it.

export class FakeStorage implements Storage {
  private items = new Map<string, string>()
  /** How many characters may be held at most; a write beyond throws, as a full browser store does. */
  capacity = Infinity

  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  setItem(key: string, value: string) {
    const others = [...this.items].filter(([name]) => name !== key).reduce((sum, [name, text]) => sum + name.length + text.length, 0)
    if (others + key.length + value.length > this.capacity) throw new DOMException("full", "QuotaExceededError")
    this.items.set(key, value)
  }
  [name: string]: unknown
}

/** Puts a fresh one where the page's code finds `localStorage`. */
export function installStorage(): FakeStorage {
  const storage = new FakeStorage()
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true })
  return storage
}
