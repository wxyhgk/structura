import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PAGES, pageOf, type GuideTopic } from "./pages/index.ts"
import type { GuideHost } from "./types.ts"

/**
 * The user guide, beside the drawing: topics on the left, the chosen page on the right.
 * Opened from 帮助 → 使用说明 (or F1), or on one page from a "?" next to what it explains.
 */
export function GuideDialog({
  topic,
  onTopic,
  host,
}: {
  /** The page shown; null when closed. */
  topic: GuideTopic | null
  onTopic: (topic: GuideTopic | null) => void
  host: GuideHost
}) {
  const [query, setQuery] = useState("")
  const words = query.trim().toLowerCase()
  const found = words ? PAGES.filter((page) => `${page.title} ${page.group} ${page.keywords}`.toLowerCase().includes(words)) : PAGES
  const groups = [...new Set(found.map((page) => page.group))]
  const page = pageOf(topic ?? "start")

  return (
    <Dialog open={topic != null} onOpenChange={(open) => onTopic(open ? (topic ?? "start") : null)}>
      <DialogContent {...host.contentProps} className="flex h-[80vh] flex-col gap-3 overflow-hidden sm:max-w-4xl" data-testid="guide">
        <DialogHeader>
          <DialogTitle>使用说明</DialogTitle>
          <DialogDescription>怎么画、怎么改、怎么做通式。左边选主题，或输入关键词查找。</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 gap-4">
          <nav className="flex w-48 shrink-0 flex-col gap-2 overflow-y-auto pr-1 text-[13px]">
            <input
              className="h-7 rounded-sm border border-[#d0d0d0] px-2 outline-none focus:border-[#1a73e8]"
              placeholder="查找，如 片段、快捷键"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="查找说明"
            />
            {groups.map((group) => (
              <div key={group}>
                <div className="mb-0.5 text-[11px] text-[#888]">{group}</div>
                {found
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      key={item.id}
                      className={`block w-full rounded-sm px-2 py-1 text-left ${item.id === page.id ? "bg-[#e8f1fb] text-[#1a73e8]" : "hover:bg-black/5"}`}
                      onClick={() => onTopic(item.id)}
                    >
                      {item.title}
                    </button>
                  ))}
              </div>
            ))}
            {found.length === 0 && <p className="text-[12px] text-[#888]">没有找到。</p>}
          </nav>
          <article className="min-h-0 flex-1 overflow-y-auto border-l border-[#eee] pl-4 text-[13px] text-[#333]" data-testid="guide-page">
            <h2 className="mb-3 text-[16px] font-semibold text-[#111]">{page.title}</h2>
            {page.body(host)}
          </article>
        </div>
      </DialogContent>
    </Dialog>
  )
}
