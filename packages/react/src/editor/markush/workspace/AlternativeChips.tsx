import { BookmarkPlus } from "lucide-react"
import type { Alternative } from "@structura/core/types"
import { MoleculeThumb } from "../../common/MoleculeThumb.tsx"
import { describeAlternative } from "../describe.ts"

/**
 * A variable's alternatives: drawn pieces as picture tiles, everything else as chips. A click
 * opens a class or a drawn piece for changing; × takes one away; the bookmark saves a class
 * or a drawn piece as a template. Read-only for a shared list.
 */
export function AlternativeChips({
  alternatives,
  readOnly,
  colorHetero,
  editing,
  onEditClass,
  onEditFragment,
  onRemove,
  onSaveTemplate,
}: {
  alternatives: Alternative[]
  readOnly: boolean
  colorHetero: boolean
  /** The alternative open for changing, which is marked. */
  editing: number | "new" | null
  onEditClass: (index: number) => void
  onEditFragment: (index: number) => void
  onRemove: (index: number) => void
  /** Opens 存为模板 for the class or drawn piece at this index. */
  onSaveTemplate: (index: number) => void
}) {
  if (alternatives.length === 0) return <p className="text-[#999]">还没有候选项。</p>
  const remove = (index: number) =>
    !readOnly && (
      <button className="px-0.5 text-[14px] leading-none text-[#999] hover:text-[#d1242f]" onClick={() => onRemove(index)} aria-label="去掉" title="去掉">
        ×
      </button>
    )
  const keep = (index: number) => (
    <button className="px-0.5 text-[#999] hover:text-[#1a73e8]" onClick={() => onSaveTemplate(index)} aria-label="存为模板" title="存为模板：以后在模板库里一键添加">
      <BookmarkPlus size={13} />
    </button>
  )
  const frame = (index: number) => (editing === index ? "border-[#1a73e8] bg-[#f1f6fd]" : "border-[#d0d0d0] bg-white")

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {alternatives.map((item, index) =>
        item.kind === "fragment" ? (
          <div key={index} className={`flex w-32 flex-col rounded-md border ${frame(index)}`} data-testid="alternative">
            <button
              className="flex h-20 items-center justify-center rounded-t-md p-1 enabled:hover:bg-[#f5f8fd]"
              disabled={readOnly}
              onClick={() => onEditFragment(index)}
              title={readOnly ? undefined : "点击在画板里修改"}
              aria-label="修改画的结构"
            >
              <MoleculeThumb mol={item.molecule} colorHetero={colorHetero} className="max-h-full max-w-full object-contain" />
            </button>
            <div className="flex items-center gap-1 border-t border-[#eeeeee] px-1.5 py-0.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-[#555]" title={describeAlternative(item)}>
                {describeAlternative(item)}
              </span>
              {keep(index)}
              {remove(index)}
            </div>
          </div>
        ) : (
          <span key={index} className={`inline-flex h-7 items-center gap-1 rounded-full border pr-1.5 pl-2.5 ${frame(index)}`} data-testid="alternative">
            {item.kind === "class" && !readOnly ? (
              <button className="hover:text-[#1a73e8]" onClick={() => onEditClass(index)} title="点击修改范围">
                {describeAlternative(item)}
              </button>
            ) : (
              <span className="font-[Arial,Helvetica,sans-serif]">{describeAlternative(item)}</span>
            )}
            {item.kind === "class" && keep(index)}
            {remove(index)}
          </span>
        ),
      )}
    </div>
  )
}
