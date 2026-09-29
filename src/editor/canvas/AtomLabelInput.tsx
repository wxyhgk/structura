import { useRef, useState } from "react"

/**
 * The field that opens on an atom (Enter while hovering it) to type a label. Enter or
 * leaving the field applies it; Escape cancels. `onDone` gets the text, or null when there
 * is nothing to apply, exactly once.
 */
export function AtomLabelInput({
  initial,
  left,
  top,
  onDone,
}: {
  initial: string
  /** Where the atom sits on the canvas, in screen pixels. */
  left: number
  top: number
  onDone: (text: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  const open = useRef(true)

  function finish(text: string | null) {
    if (!open.current) return
    open.current = false
    onDone(text)
  }

  return (
    <input
      data-testid="atom-label-input"
      autoFocus
      value={value}
      aria-label="原子标签"
      className="absolute z-10 h-7 w-20 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#1a73e8] bg-white text-center font-[Arial,Helvetica,sans-serif] text-[15px] outline-none"
      style={{ left, top }}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === "Escape") {
          event.preventDefault()
          finish(null)
          event.currentTarget.blur()
        }
      }}
      onBlur={() => finish(value.trim() === initial ? null : value)}
    />
  )
}
