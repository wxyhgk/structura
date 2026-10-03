import type { ReactNode } from "react"

// The building blocks the guide's pages are written in: quiet type, plenty of room.

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4">{children}</p>
}

export function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-9 mb-3 text-[19px] font-semibold tracking-tight first:mt-0">{children}</h3>
}

/** Numbered steps, for doing one thing from start to end. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mb-5 list-decimal space-y-1.5 pl-5 marker:text-[#8e8e93]">{children}</ol>
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="mb-5 list-disc space-y-1.5 pl-5 marker:text-[#c7c7cc]">{children}</ul>
}

/** A key or key combination, as on the keyboard. */
export function K({ children }: { children: ReactNode }) {
  return (
    <kbd className="mx-[2px] inline-flex min-w-[1.6em] items-center justify-center rounded-[5px] border border-[#d2d2d7] bg-white px-1.5 font-[inherit] text-[12px] leading-[1.6] text-[#1d1d1f] shadow-[0_1px_0_#d2d2d7]">
      {children}
    </kbd>
  )
}

/** Something easy to miss, set apart. */
export function Tip({ children }: { children: ReactNode }) {
  return <div className="mb-5 rounded-xl bg-[#f5f5f7] px-4 py-3 text-[13px] leading-6 text-[#424245]">{children}</div>
}

/** Text with keys written in square brackets: "按住 [空格] 拖动" shows 空格 as a key. */
export function WithKeys({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\])/).map((part, index) => (/^\[.+\]$/.test(part) ? <K key={index}>{part.slice(1, -1)}</K> : part))
}

/** A table of keys (or gestures) and what they do; keys in the first column go in square brackets. */
export function Table({ rows }: { rows: Array<[string, string]> }) {
  const cell = "border-b border-[#e5e5ea] py-2.5"
  return (
    <dl className="mb-5 grid grid-cols-[minmax(8rem,max-content)_1fr] border-t border-[#e5e5ea] text-[13px]">
      {rows.map(([key, what]) => (
        <div key={key} className="contents">
          <dt className={`${cell} pr-8 text-[#6e6e73]`}>
            <WithKeys text={key} />
          </dt>
          <dd className={cell}>{what}</dd>
        </div>
      ))}
    </dl>
  )
}
