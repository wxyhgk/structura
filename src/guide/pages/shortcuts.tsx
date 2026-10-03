import { P } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const shortcutsPage = definePage({
  id: "shortcuts",
  group: "编辑",
  title: "快捷键",
  keywords: "快捷键 按键 键盘",
  body: ({ openShortcuts }) => (
    <>
      <P>所有快捷键分成三组：悬停在原子上、悬停在键上、什么都没悬停（切换工具）。完整的表按当前版本自动生成。</P>
      <button className="rounded-sm border border-[#9fc3ee] px-2.5 py-1 text-[#1a73e8] hover:bg-[#e8f1fb]" onClick={openShortcuts}>
        打开完整快捷键表
      </button>
    </>
  ),
})
