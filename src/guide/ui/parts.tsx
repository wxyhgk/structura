import type { ReactNode } from "react"

// The building blocks the guide's pages are written in.

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 leading-relaxed">{children}</p>
}

export function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-4 mb-1.5 text-[13px] font-semibold text-[#222] first:mt-0">{children}</h3>
}

/** Numbered steps, for doing one thing from start to end. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mb-2 list-decimal space-y-1 pl-5 leading-relaxed">{children}</ol>
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="mb-2 list-disc space-y-1 pl-5 leading-relaxed">{children}</ul>
}

/** A key or key combination, as on the keyboard. */
export function K({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded-[3px] border border-[#cfcfcf] bg-[#f6f6f6] px-1 py-px font-[inherit] text-[11px] text-[#333]">{children}</kbd>
}

/** Something easy to miss, set apart. */
export function Tip({ children }: { children: ReactNode }) {
  return <div className="mb-2 rounded-sm border-l-2 border-[#e0a800] bg-[#fff8e1] px-2.5 py-1.5 leading-relaxed text-[#5c4400]">{children}</div>
}

/** Text with keys written in square brackets: "按住 [空格] 拖动" shows 空格 as a key. */
function WithKeys({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\])/).map((part, index) => (/^\[.+\]$/.test(part) ? <K key={index}>{part.slice(1, -1)}</K> : part))
}

/** A table of keys (or gestures) and what they do; keys in the first column go in square brackets. */
export function Table({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {rows.map(([key, what]) => (
        <div key={key} className="contents">
          <dt className="whitespace-nowrap text-[#555]">
            <WithKeys text={key} />
          </dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  )
}
