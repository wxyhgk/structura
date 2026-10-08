import { useState } from "react"
import type { Template } from "@structura/markush"
import { MoleculeThumb } from "../common/MoleculeThumb.tsx"
import { describeAlternative } from "../markush/describe.ts"
import { SITE_NAMES } from "./templateSearch.ts"

const LINK = "text-[#1a73e8] hover:underline disabled:text-[#aaa] disabled:no-underline"

/**
 * One template in the library: its picture or what it stands for, its names, and what can
 * be done with it: adding it to the variable; and changing, deleting (asked first) or, for a
 * built-in, copying it as the user's own.
 */
export function TemplateRow({
  template,
  colorHetero,
  showSite,
  addable,
  added,
  canChange,
  onAdd,
  onEdit,
  onEditStructure,
  onCopy,
  onDelete,
}: {
  template: Template
  colorHetero: boolean
  /** Every site is listed, so each says its own. */
  showSite: boolean
  /** Why it cannot be added to this variable, or null when it can. */
  addable: string | null
  added: boolean
  /** The user's templates can be changed now (the backend is reachable). */
  canChange: boolean
  onAdd: () => void
  onEdit: () => void
  onEditStructure: () => void
  onCopy: () => void
  onDelete: () => Promise<void>
}) {
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { alternative } = template
  const mine = template.source === "user"
  const describe = describeAlternative(alternative)

  return (
    <div className="flex items-center gap-3 rounded-md border border-[#e3e3e3] bg-white px-2.5 py-1.5" data-testid="template-row">
      <div className={`flex w-16 shrink-0 items-center justify-center rounded-sm ${alternative.kind === "fragment" ? "h-12 bg-[#fafafa]" : "self-stretch border border-dashed border-[#e3e3e3]"}`}>
        {alternative.kind === "fragment" ? (
          <MoleculeThumb mol={alternative.molecule} colorHetero={colorHetero} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="px-1 text-center text-[11px] leading-tight text-[#666]">{alternative.kind === "class" ? "类别" : alternative.kind === "bond" ? "—" : describe}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-[#222]" data-testid="template-name">
            {template.name}
          </span>
          <span data-testid="template-source" className={`shrink-0 rounded-sm px-1 py-px text-[10px] ${mine ? "bg-[#e9f6ec] text-[#1e7d34]" : "bg-[#f0f0f0] text-[#777]"}`}>{mine ? "我的" : "内置"}</span>
          {showSite && <span className="shrink-0 rounded-sm border border-[#d6e4f7] px-1 py-px text-[10px] text-[#1a73e8]">{SITE_NAMES[template.site]}</span>}
        </div>
        <div className="truncate text-[11px] text-[#888]" title={describe}>
          {template.aliases?.length ? `${template.aliases.join("、")} · ` : ""}
          {describe}
        </div>
        {asking ? (
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className="text-[#d1242f]">删除“{template.name}”？不能撤销。</span>
            <button
              className="text-[#d1242f] hover:underline"
              onClick={() =>
                onDelete().catch((error: unknown) => {
                  setProblem(error instanceof Error ? error.message : String(error))
                  setAsking(false)
                })
              }
            >
              删除
            </button>
            <button className={LINK} onClick={() => setAsking(false)}>
              取消
            </button>
          </div>
        ) : (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px]">
            {mine ? (
              <>
                <button className={LINK} disabled={!canChange} onClick={onEdit}>
                  改名/分组
                </button>
                {alternative.kind === "fragment" && (
                  <button className={LINK} disabled={!canChange} onClick={onEditStructure}>
                    修改结构和位点
                  </button>
                )}
                <button className={`${LINK} hover:text-[#d1242f]`} disabled={!canChange} onClick={() => setAsking(true)}>
                  删除
                </button>
              </>
            ) : (
              <button className={LINK} disabled={!canChange} onClick={onCopy}>
                复制为我的模板
              </button>
            )}
            {problem && <span className="text-[#b26a00]">{problem}</span>}
          </div>
        )}
      </div>
      <button
        className="shrink-0 rounded-sm border border-[#9fc3ee] bg-white px-2.5 py-1 text-[#1a73e8] hover:bg-[#e8f1fb] disabled:border-[#ddd] disabled:text-[#aaa] disabled:hover:bg-transparent"
        disabled={added || addable != null}
        onClick={onAdd}
        title={addable ?? (added ? "已在候选项里" : `添加：${describe}`)}
      >
        {added ? "已添加" : "添加"}
      </button>
    </div>
  )
}
