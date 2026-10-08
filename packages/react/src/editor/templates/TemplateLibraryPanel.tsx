import { useRef, useState, type KeyboardEvent } from "react"
import type { Alternative } from "@structura/core/types"
import type { ImportReport, Template, TemplateSite } from "@structura/markush"
import { PaneHeader } from "../markush/workspace/PaneHeader.tsx"
import { SaveTemplateForm } from "./SaveTemplateForm.tsx"
import { filterTemplates, groupTemplates, inList, SITE_NAMES } from "./templateSearch.ts"
import { TemplateRow } from "./TemplateRow.tsx"
import { OFFLINE_NOTE, type Templates } from "./useTemplates.ts"

const ACTION = "rounded-sm border border-[#d0d0d0] bg-white px-2 py-0.5 text-[#333] hover:bg-[#f3f3f3] disabled:text-[#aaa] disabled:hover:bg-white"

/** "导入了 3 个，跳过 1 个（已有）", and what was wrong with the rest. */
function reportText(report: ImportReport): string {
  const parts = [`导入了 ${report.added} 个模板`]
  if (report.skipped) parts.push(`跳过 ${report.skipped} 个（已有）`)
  if (report.problems.length) parts.push(`${report.problems.length} 个有问题没有导入：${report.problems.join("；")}`)
  return parts.join("，")
}

/**
 * The whole template library, taking over the variables pane for one variable: searched by
 * name or other name, on its shelves, the variable's site only unless every site is asked
 * for. A click adds a template to the variable; the user's own can be renamed, moved to
 * another shelf, redrawn or deleted, a built-in copied as the user's, and the user's saved
 * to or read from a file.
 */
export function TemplateLibraryPanel({
  templates,
  name,
  site,
  alternatives,
  colorHetero,
  onAdd,
  onEditStructure,
  onClose,
}: {
  templates: Templates
  /** The variable templates are added to. */
  name: string
  site: TemplateSite
  alternatives: Alternative[]
  colorHetero: boolean
  onAdd: (alternative: Alternative) => void
  /** Opens the sketch pad on one of the user's drawn templates. */
  onEditStructure: (template: Template) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [allSites, setAllSites] = useState(false)
  /** The template whose form is open: being changed, or a built-in being copied. */
  const [form, setForm] = useState<{ template: Template; copy: boolean } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const ready = templates.status === "ready"
  const shelves = groupTemplates(filterTemplates(templates.templates, { query, site, allSites }))
  const mineCount = templates.templates.filter((template) => template.source === "user").length

  async function act(work: () => Promise<string | null>) {
    try {
      setNote(await work())
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    }
  }

  /** Keys typed here stay here; Escape goes back to the variables. */
  function keepKeys(event: KeyboardEvent) {
    event.stopPropagation()
    if (event.key === "Escape" && !form) onClose()
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-[12px] text-[#333]" onKeyDown={keepKeys} onKeyUp={(event) => event.stopPropagation()} data-testid="template-library">
      <PaneHeader title="模板库">
        <button className="order-first -ml-1 rounded-sm px-1.5 py-0.5 text-[#1a73e8] hover:bg-[#eef3fb]" onClick={onClose} title="返回变量（Esc）">
          ← 返回
        </button>
        <span className="text-[#888]">
          添加到 <b className="font-[Arial,Helvetica,sans-serif] text-[#333]">{name}</b>（{SITE_NAMES[site]}）
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <button className={ACTION} disabled={!ready} onClick={() => file.current?.click()} title="从 JSON 文件导入模板，加到我的模板里">
            导入…
          </button>
          <button className={ACTION} disabled={!ready || mineCount === 0} onClick={() => void act(async () => (await templates.exportFile(), null))} title="把我的模板存成 JSON 文件，备份或分享">
            导出
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="template-import"
            onChange={(event) => {
              const picked = event.target.files?.[0]
              event.target.value = ""
              if (picked) void act(async () => reportText(await templates.importFile(picked)))
            }}
          />
        </span>
      </PaneHeader>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#eeeeee] bg-white px-3 py-2">
        <input
          className="h-8 min-w-40 flex-1 rounded-sm border border-[#d0d0d0] bg-white px-2.5 text-[13px] outline-none focus:border-[#1a73e8]"
          placeholder="搜索模板：名称或其他名称，如 芳基、pyridyl"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索模板"
          autoFocus
        />
        <label className="flex items-center gap-1.5 text-[#555]">
          <input type="checkbox" checked={allSites} onChange={(event) => setAllSites(event.target.checked)} />
          显示全部位置
        </label>
      </div>
      {templates.status !== "ready" && (
        <p className="shrink-0 bg-[#fff8e6] px-3 py-1.5 text-[#8a5a00]" data-testid="templates-offline">
          {templates.status === "loading" ? "正在读取我的模板…" : `${OFFLINE_NOTE}。现在只能用内置模板。`}
        </p>
      )}
      {note && (
        <p className="flex shrink-0 items-start gap-2 bg-[#eef5ff] px-3 py-1.5 text-[#1a4f99]" data-testid="template-note">
          <span className="flex-1">{note}</span>
          <button className="text-[#888] hover:text-[#333]" onClick={() => setNote(null)} aria-label="关闭提示">
            ×
          </button>
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {shelves.length === 0 && (
          <p className="text-[#999]">{query ? `没有找到“${query}”。` : `还没有能放在${SITE_NAMES[site]}的模板。`}可以在画板里画好后点“存为模板…”。</p>
        )}
        {shelves.map((shelf) => (
          <section key={shelf.group} className="mb-4" data-testid="template-group">
            <h3 className="mb-1.5 text-[12px] font-semibold text-[#555]">
              {shelf.group} <span className="font-normal text-[#999]">{shelf.templates.length}</span>
            </h3>
            <div className="space-y-1.5">
              {shelf.templates.map(item)}
            </div>
          </section>
        ))}
      </div>
    </div>
  )

  /** A row, and the form for changing or copying it when that is open. */
  function item(template: Template) {
    const open = form?.template.id === template.id ? form : null
    return (
      <div key={template.id} className="space-y-1.5">
        <TemplateRow
          template={template}
          colorHetero={colorHetero}
          showSite={allSites}
          addable={template.site === site ? null : `这个模板放在${SITE_NAMES[template.site]}，${name} 在${SITE_NAMES[site]}，不能添加`}
          added={inList(alternatives, template)}
          canChange={ready}
          onAdd={() => {
            onAdd(template.alternative)
            setNote(`已把“${template.name}”添加到 ${name}`)
          }}
          onEdit={() => setForm({ template, copy: false })}
          onEditStructure={() => onEditStructure(template)}
          onCopy={() => setForm({ template, copy: true })}
          onDelete={async () => {
            await templates.remove(template.id)
            setNote(`已删除“${template.name}”`)
          }}
        />
        {open && (
          <SaveTemplateForm
            templates={templates}
            site={template.site}
            alternative={template.alternative}
            initial={{ name: template.name, group: open.copy ? undefined : template.group, aliases: template.aliases }}
            id={open.copy ? undefined : template.id}
            title={open.copy ? `复制“${template.name}”为我的模板` : `修改“${template.name}”`}
            onDone={(saved) => {
              setForm(null)
              setNote(open.copy ? `已复制为我的模板“${saved.name}”` : `已保存“${saved.name}”`)
            }}
            onCancel={() => setForm(null)}
          />
        )}
      </div>
    )
  }
}
