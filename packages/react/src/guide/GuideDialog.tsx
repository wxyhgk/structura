import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog.tsx"
import type { GuidePages, GuideTopic } from "./pages/index.ts"
import type { GuideHost } from "./types.ts"

/** The system UI font, as on Apple platforms, with fallbacks for Chinese and elsewhere. */
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif'

/**
 * The user guide, beside the drawing: topics on the left, the chosen page on the right.
 * Opened from 帮助 → 使用说明 (or F1), or on one page from a "?" next to what it explains.
 */
export function GuideDialog({
  topic,
  onTopic,
  host,
  pages,
}: {
  /** The page shown; null when closed. */
  topic: GuideTopic | null
  onTopic: (topic: GuideTopic | null) => void
  host: GuideHost
  /** The pages it lists: a topic not among them opens the first. */
  pages: GuidePages
}) {
  const [query, setQuery] = useState("")
  const words = query.trim().toLowerCase()
  const found = words ? pages.filter((page) => `${page.title} ${page.group} ${page.keywords}`.toLowerCase().includes(words)) : pages
  const groups = [...new Set(found.map((page) => page.group))]
  const page = pages.find((item) => item.id === topic) ?? pages[0]

  return (
    <Dialog open={topic != null} onOpenChange={(open) => onTopic(open ? (topic ?? "start") : null)}>
      <DialogContent
        {...host.contentProps}
        className="flex h-[82vh] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-5xl"
        style={{ fontFamily: FONT }}
        data-testid="guide"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>使用说明</DialogTitle>
          <DialogDescription>怎么画、怎么改、怎么做通式。</DialogDescription>
        </DialogHeader>
        <nav className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto bg-(--c-f5f5f7) px-3 pt-5 pb-4 text-[13px] text-(--c-1d1d1f)">
          <div className="px-2 text-[15px] font-semibold">使用说明</div>
          <input
            className="h-8 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] px-3 outline-none placeholder:text-(--c-8e8e93) focus:bg-(--c-ffffff) focus:ring-2 focus:ring-(--c-0071e3)/40"
            placeholder="搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="查找说明"
          />
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-1 px-2 text-[11px] font-semibold text-(--c-8e8e93)">{group}</div>
              {found
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    className={`block w-full rounded-md px-2 py-[5px] text-left leading-snug ${item.id === page.id ? "bg-black/[0.08] dark:bg-white/[0.12] font-medium" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}`}
                    onClick={() => onTopic(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
            </div>
          ))}
          {found.length === 0 && <p className="px-2 text-[12px] text-(--c-8e8e93)">没有结果</p>}
        </nav>
        <article key={page.id} className="min-h-0 flex-1 overflow-y-auto bg-(--c-ffffff) px-12 pt-10 pb-12 text-[14px] leading-7 text-(--c-1d1d1f)" data-testid="guide-page">
          <div className="mx-auto max-w-[680px]">
            <div className="mb-1 text-[12px] font-medium text-(--c-8e8e93)">{page.group}</div>
            <h2 className="mb-6 text-[28px] leading-tight font-semibold tracking-tight">{page.title}</h2>
            {page.body(host)}
          </div>
        </article>
      </DialogContent>
    </Dialog>
  )
}
