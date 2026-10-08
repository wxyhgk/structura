import { useState } from "react"
import type { Alternative } from "@structura/core/types"
import type { Template, TemplateSite } from "@structura/markush"
import { Button } from "@/components/ui/button"
import { aliasesFromText, groupNames, SITE_NAMES } from "./templateSearch.ts"
import { OFFLINE_NOTE, type Templates } from "./useTemplates.ts"

/** The shelf a new template goes on when the user names none. */
export const DEFAULT_GROUP = "我的模板"

const FIELD = "h-7 rounded-sm border border-[#d0d0d0] bg-white px-1.5 outline-none focus:border-[#1a73e8]"

/**
 * Saving an alternative as one of the user's templates: its name, shelf (suggesting the
 * shelves there are) and other names; where it stands is the variable's. With `id` it
 * changes that template instead. A drawn piece takes the template's name as its own, so it
 * is called that wherever it is added.
 */
export function SaveTemplateForm({
  templates,
  site,
  alternative,
  initial,
  id,
  title = "存为模板",
  onDone,
  onCancel,
}: {
  templates: Templates
  site: TemplateSite
  alternative: Alternative
  initial?: { name?: string; group?: string; aliases?: string[] }
  /** The user's template being changed, if this changes one. */
  id?: string
  title?: string
  onDone: (template: Template) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [group, setGroup] = useState(initial?.group ?? DEFAULT_GROUP)
  const [aliases, setAliases] = useState((initial?.aliases ?? []).join(", "))
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const offline = templates.status !== "ready"
  const listId = `template-groups-${id ?? "new"}`

  async function save() {
    setBusy(true)
    setProblem(null)
    try {
      const named = alternative.kind === "fragment" ? { ...alternative, name: name.trim() } : alternative
      const others = aliasesFromText(aliases)
      onDone(await templates.save({ name: name.trim(), group: group.trim() || DEFAULT_GROUP, ...(others.length ? { aliases: others } : {}), site, alternative: named }, id))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 rounded-sm border border-[#d6e4f7] bg-[#f8fbff] p-2.5 text-[12px]"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Escape") onCancel()
      }}
      data-testid="save-template-form"
    >
      <span className="col-span-2 font-medium text-[#333]">
        {title}
        <span className="ml-2 font-normal text-[#888]">位置：{SITE_NAMES[site]}</span>
      </span>
      <label htmlFor={`${listId}-name`}>名称</label>
      <input id={`${listId}-name`} className={FIELD} value={name} onChange={(event) => setName(event.target.value)} placeholder="如 吡啶基" maxLength={60} autoFocus aria-label="模板名称" />
      <label htmlFor={`${listId}-group`}>分组</label>
      <input id={`${listId}-group`} className={FIELD} value={group} onChange={(event) => setGroup(event.target.value)} list={listId} maxLength={30} aria-label="模板分组" />
      <datalist id={listId}>
        {[...new Set([DEFAULT_GROUP, ...groupNames(templates.templates)])].map((shelf) => (
          <option key={shelf} value={shelf} />
        ))}
      </datalist>
      <label htmlFor={`${listId}-aliases`}>其他名称</label>
      <input
        id={`${listId}-aliases`}
        className={FIELD}
        value={aliases}
        onChange={(event) => setAliases(event.target.value)}
        placeholder="可不填；用逗号分开，如 pyridyl, Py"
        aria-label="模板的其他名称"
      />
      {offline && <p className="col-span-2 text-[#b26a00]">{templates.status === "loading" ? "正在连接后端…" : OFFLINE_NOTE}</p>}
      {problem && <p className="col-span-2 text-[#b26a00]">{problem}</p>}
      <span className="col-span-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" size="sm" disabled={busy || offline || !name.trim()}>
          {id ? "保存修改" : "存为模板"}
        </Button>
      </span>
    </form>
  )
}
