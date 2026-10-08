import type { Alternative } from "@structura/core/types"
import type { TemplateSite } from "@structura/markush"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { inList, quickPicks, templateTitle } from "./templateSearch.ts"
import type { Templates } from "./useTemplates.ts"

const CHIP = "inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5"

/**
 * The templates offered on a variable's card: the user's own newest, then favourite
 * built-ins for its site (see quickPicks), one click each, a drawn one with its picture; and the way into the whole library.
 */
export function TemplatePicker({
  templates,
  site,
  alternatives,
  colorHetero,
  onAdd,
  onLibrary,
}: {
  templates: Templates
  site: TemplateSite
  /** The variable's list, so templates already in it are marked. */
  alternatives: Alternative[]
  colorHetero: boolean
  onAdd: (alternative: Alternative) => void
  onLibrary: () => void
}) {
  const picks = quickPicks(templates.templates, site)
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="template-picker">
      <span className="text-[#888]">模板：</span>
      {picks.map((template) => {
        const added = inList(alternatives, template)
        return (
          <button
            key={template.id}
            className={`${CHIP} ${added ? "border-[#d0d0d0] text-[#999]" : "border-[#9fc3ee] text-[#1a73e8] hover:bg-[#e8f1fb]"}`}
            onClick={() => onAdd(template.alternative)}
            disabled={added}
            title={added ? `已在候选项里：${templateTitle(template)}` : `添加：${templateTitle(template)}`}
            data-testid="template-chip"
          >
            {template.alternative.kind === "fragment" && <MoleculeThumb mol={template.alternative.molecule} colorHetero={colorHetero} className="-my-0.5 h-6 w-10 object-contain" />}
            {added ? "✓" : "+"} {template.name}
          </button>
        )
      })}
      <button className="rounded-full px-2 py-0.5 font-medium text-[#1a73e8] hover:bg-[#e8f1fb]" onClick={onLibrary} title="查看全部模板：搜索、分组浏览、存自己的模板">
        模板库…
      </button>
    </div>
  )
}
