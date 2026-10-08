/** What a tab says when it has nothing to list yet. */
export function Empty({ children }: { children: string }) {
  return <p className="px-3 py-3 text-[12px] leading-relaxed text-[#888]">{children}</p>
}
