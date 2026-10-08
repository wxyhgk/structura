import type { PointerEvent } from "react"

/**
 * A divider between two panes, dragged to move it: `onMove` gets the pointer's place as a
 * fraction of `container` across (`axis` x) or down (y). A double click puts it back.
 */
export function SplitHandle({
  axis,
  container,
  onMove,
  onReset,
  label,
}: {
  axis: "x" | "y"
  container: () => HTMLElement | null
  onMove: (fraction: number) => void
  onReset: () => void
  label: string
}) {
  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const move = (next: globalThis.PointerEvent) => {
      const box = container()?.getBoundingClientRect()
      if (!box) return
      onMove(axis === "x" ? (next.clientX - box.left) / box.width : (next.clientY - box.top) / box.height)
    }
    const stop = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", stop)
      handle.removeEventListener("pointercancel", stop)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", stop)
    handle.addEventListener("pointercancel", stop)
  }
  const shape = axis === "x" ? "w-[5px] cursor-col-resize -mx-[2px]" : "h-[5px] cursor-row-resize -my-[2px]"
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      title="拖动调整大小，双击恢复"
      className={`group relative z-10 shrink-0 ${shape} flex items-center justify-center`}
      onPointerDown={start}
      onDoubleClick={onReset}
    >
      <div className={`${axis === "x" ? "h-full w-px" : "h-px w-full"} bg-[#d0d0d0] transition-colors group-hover:bg-[#1a73e8] group-active:bg-[#1a73e8]`} />
    </div>
  )
}
