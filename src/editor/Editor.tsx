import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Download,
  FilePlus,
  FlipHorizontal2,
  FlipVertical2,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { sceneToSvg } from "@/chem/draw"
import { shortcutToElement } from "@/chem/elements/index"
import { toMolfile } from "@/chem/molfile"
import { readSdf, sideBySide } from "@/chem/sdf"
import type { Problem } from "@/chem/validate"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Canvas, type CanvasHandle } from "@/editor/Canvas"
import { LogoMark } from "@/editor/icons"
import { ToolPalette } from "@/editor/ToolPalette"
import { toolLabel } from "@/editor/tools"
import { useEditor } from "@/editor/useEditor"

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const PROBLEM_TEXT: Partial<Record<Problem["code"], string>> = {
  "bad-molfile": "无法读取",
  "unsupported-mol-feature": "含有暂不支持的内容",
  "missing-coordinates": "文件没有坐标，原子会重叠在一起",
  "flattened-3d": "三维坐标已投影到平面",
  "aromatic-unresolved": "部分芳香键无法确定单双键",
  valence: "有原子超价",
}

/** One line per problem, in Chinese, with the record it came from. */
function importNotes(records: ReturnType<typeof readSdf>): string[] {
  return records.flatMap((record, index) =>
    record.problems.map((problem) => {
      const where = records.length > 1 ? `第 ${index + 1} 条${record.title ? `（${record.title}）` : ""}：` : ""
      return `${where}${PROBLEM_TEXT[problem.code] ?? problem.code}。${problem.message}`
    }),
  )
}

function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent)
}

export function Editor() {
  const editor = useEditor()
  const canvasRef = useRef<CanvasHandle>(null)
  const [zoom, setZoom] = useState(1)
  const [notes, setNotes] = useState<{ opened: boolean; lines: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mod = isMac() ? "⌘" : "Ctrl"

  async function openFile(file: File) {
    const records = readSdf(await file.text())
    const readable = records.filter((record) => record.mol.atoms.length > 0)
    const found = importNotes(records)
    if (readable.length === 0) {
      setNotes({ opened: false, lines: found.length > 0 ? found : ["文件里没有可以读取的分子。"] })
      return
    }
    const merged = sideBySide(readable.map((record) => record.mol), editor.mol)
    editor.openMolecule(merged)
    canvasRef.current?.fitContent(merged)
    if (found.length > 0) setNotes({ opened: true, lines: found })
  }

  useEffect(() => {
    document.title = "Structura"
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (document.querySelector("[data-slot=dialog-content]")) return
      const meta = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (meta && key === "z") {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (meta && key === "y") {
        event.preventDefault()
        editor.redo()
        return
      }
      if (meta && key === "a") {
        event.preventDefault()
        editor.selectEverything()
        return
      }
      if (meta && key === "n") {
        event.preventDefault()
        editor.newDocument()
        return
      }
      if (meta && key === "o") {
        event.preventDefault()
        fileRef.current?.click()
        return
      }
      if (meta && (event.key === "=" || event.key === "+")) {
        event.preventDefault()
        canvasRef.current?.zoomBy(1.1)
        return
      }
      if (meta && event.key === "-") {
        event.preventDefault()
        canvasRef.current?.zoomBy(1 / 1.1)
        return
      }
      if (meta && event.key === "0") {
        event.preventDefault()
        canvasRef.current?.resetView()
        return
      }
      if (event.key === "Escape") {
        if (canvasRef.current?.hasGesture()) canvasRef.current.cancelGesture()
        else editor.setTool("lasso")
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        editor.removeSelection()
        return
      }
      const arrow = arrowDirection(event.key)
      if (arrow && (meta || event.altKey || event.shiftKey)) {
        event.preventDefault()
        if (meta) editor.addArrow(arrow)
        else if (event.shiftKey && event.altKey) editor.tumbleSelection(arrow)
        else if (event.altKey) editor.rotateSelection(arrow === "left" || arrow === "up" ? Math.PI / 12 : -Math.PI / 12)
        else editor.nudgeSelection(arrow)
        return
      }
      if (event.key === "Enter" && !canvasRef.current?.hotspot()) {
        const id = editor.selectionHotspot()
        if (id != null) {
          event.preventDefault()
          canvasRef.current?.focusAtom(id)
          return
        }
      }
      if (meta || event.altKey) return
      if (key === "v") editor.setTool("lasso")
      else if (key === "m") editor.setTool("marquee")
      else if (key === "b") {
        editor.setBondStyle({ order: 1, stereo: "none" })
        editor.setTool("bond")
      } else if (key === "k") editor.setTool("chain")
      else if (key === "r") editor.setTool("ring")
      else if (key === "e") editor.setTool("eraser")
      else if (key === "1" || key === "2" || key === "3") editor.applyBondOrder(Number(key) as 1 | 2 | 3)
      else if ((event.key === "+" || event.key === "=") && editor.selection.atoms.length > 0) editor.applyCharge(1)
      else if (event.key === "-" && editor.selection.atoms.length > 0) editor.applyCharge(-1)
      else {
        const symbol = shortcutToElement(key)
        if (symbol) editor.applyElement(symbol)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editor])

  const label = toolLabel(editor.tool, editor.bondStyle, editor.ringKind, editor.atomEl)

  return (
    <div
      className="chem-app flex h-full flex-col"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files[0]
        if (file) void openFile(file)
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".mol,.sdf,.sd,.mdl"
        className="hidden"
        data-testid="open-file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void openFile(file)
        }}
      />
      <header className="flex h-8 shrink-0 items-center gap-1 border-b border-[#d0d0d0] bg-[#f2f2f2] pr-3 pl-2">
        <div className="mr-1 flex items-center gap-1.5 px-1.5 font-medium">
          <LogoMark />
          Structura
        </div>
        <MenuButton label="文件">
          <DropdownMenuItem onClick={editor.newDocument}>
            新建
            <DropdownMenuShortcut>{mod}N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            打开 MOL/SDF…
            <DropdownMenuShortcut>{mod}O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const svg = sceneToSvg(editor.mol, editor.colorHetero, editor.arrows)
              if (svg) download("未命名.svg", svg, "image/svg+xml")
            }}
          >
            导出 SVG
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => download("未命名.mol", toMolfile(editor.mol), "chemical/x-mdl-molfile")}
          >
            导出 MOL
          </DropdownMenuItem>
        </MenuButton>
        <MenuButton label="编辑">
          <DropdownMenuItem disabled={!editor.canUndo} onClick={editor.undo}>
            撤销
            <DropdownMenuShortcut>{mod}Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!editor.canRedo} onClick={editor.redo}>
            重做
            <DropdownMenuShortcut>⇧{mod}Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={editor.removeSelection}>
            删除
            <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={editor.selectEverything}>
            全选
            <DropdownMenuShortcut>{mod}A</DropdownMenuShortcut>
          </DropdownMenuItem>
        </MenuButton>
        <MenuButton label="结构">
          <DropdownMenuItem disabled={!editor.canTransform} onClick={() => editor.rotateSelection(Math.PI / 12)}>
            逆时针 15°
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!editor.canTransform} onClick={() => editor.rotateSelection(-Math.PI / 12)}>
            顺时针 15°
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!editor.canTransform} onClick={() => editor.rotateSelection(Math.PI)}>
            旋转 180°
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!editor.canTransform} onClick={() => editor.flipSelection("horizontal")}>
            水平翻转
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!editor.canTransform} onClick={() => editor.flipSelection("vertical")}>
            垂直翻转
          </DropdownMenuItem>
        </MenuButton>
        <MenuButton label="查看">
          <DropdownMenuItem onClick={() => canvasRef.current?.zoomBy(1.1)}>
            放大
            <DropdownMenuShortcut>{mod}+</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => canvasRef.current?.zoomBy(1 / 1.1)}>
            缩小
            <DropdownMenuShortcut>{mod}−</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => canvasRef.current?.resetView()}>
            实际大小
            <DropdownMenuShortcut>{mod}0</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={editor.colorHetero}
            onCheckedChange={(checked) => editor.setColorHetero(checked === true)}
          >
            杂原子着色
          </DropdownMenuCheckboxItem>
        </MenuButton>
        <MenuButton label="帮助">
          <DropdownMenuItem onClick={() => editor.setHelpOpen(true)}>快捷键</DropdownMenuItem>
        </MenuButton>
        <div className="ml-auto text-[12px] text-[#777]">未命名</div>
      </header>

      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-[#d5d5d5] bg-[#f7f7f7] px-1.5">
        <IconButton label="新建" onClick={editor.newDocument}>
          <FilePlus />
        </IconButton>
        <IconButton
          label="导出 SVG"
          onClick={() => {
            const svg = sceneToSvg(editor.mol, editor.colorHetero, editor.arrows)
            if (svg) download("未命名.svg", svg, "image/svg+xml")
          }}
        >
          <Download />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <IconButton label="撤销" disabled={!editor.canUndo} onClick={editor.undo}>
          <Undo2 />
        </IconButton>
        <IconButton label="重做" disabled={!editor.canRedo} onClick={editor.redo}>
          <Redo2 />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <IconButton label="缩小" onClick={() => canvasRef.current?.zoomBy(1 / 1.1)}>
          <ZoomOut />
        </IconButton>
        <button
          type="button"
          className="h-7 min-w-12 rounded-sm px-1 text-[12px] text-[#333] hover:bg-black/5"
          onClick={() => canvasRef.current?.resetView()}
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="放大" onClick={() => canvasRef.current?.zoomBy(1.1)}>
          <ZoomIn />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <IconButton label="逆时针 15°" disabled={!editor.canTransform} onClick={() => editor.rotateSelection(Math.PI / 12)}>
          <RotateCcw />
        </IconButton>
        <IconButton label="顺时针 15°" disabled={!editor.canTransform} onClick={() => editor.rotateSelection(-Math.PI / 12)}>
          <RotateCw />
        </IconButton>
        <IconButton label="水平翻转" disabled={!editor.canTransform} onClick={() => editor.flipSelection("horizontal")}>
          <FlipHorizontal2 />
        </IconButton>
        <IconButton label="垂直翻转" disabled={!editor.canTransform} onClick={() => editor.flipSelection("vertical")}>
          <FlipVertical2 />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <IconButton label="删除" onClick={editor.removeSelection}>
          <Trash2 />
        </IconButton>
      </div>

      <div className="flex min-h-0 flex-1">
        <ToolPalette
          tool={editor.tool}
          bondStyle={editor.bondStyle}
          ringKind={editor.ringKind}
          atomEl={editor.atomEl}
          onTool={editor.setTool}
          onBondStyle={editor.setBondStyle}
          onRingKind={editor.setRingKind}
          onElement={editor.applyElement}
        />
        <Canvas
          ref={canvasRef}
          mol={editor.mol}
          arrows={editor.arrows}
          tool={editor.tool}
          bondStyle={editor.bondStyle}
          ringKind={editor.ringKind}
          atomEl={editor.atomEl}
          selection={editor.selection}
          colorHetero={editor.colorHetero}
          commit={editor.commit}
          setSelection={editor.setSelection}
          onZoom={setZoom}
        />
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[#d0d0d0] bg-[#f2f2f2] px-3 text-[12px] text-[#333]">
        <span className="w-16 text-[#555]" data-testid="tool-label">
          {label}
        </span>
        <span className="min-w-16 font-[Arial,Helvetica,sans-serif] text-[13px] tracking-wide" data-testid="formula">
          {editor.formula || "—"}
        </span>
        <span className="text-[#666]" data-testid="mw">
          {editor.formula ? editor.weight.toFixed(2) : ""}
        </span>
        {editor.valenceErrors > 0 && (
          <span className="text-[#d1242f]">{editor.valenceErrors} 个原子价态异常</span>
        )}
        <span className="ml-auto text-[#666]">
          {editor.mol.atoms.length} 原子 · {Math.round(zoom * 100)}%
        </span>
      </footer>

      <Dialog open={notes != null} onOpenChange={(open) => !open && setNotes(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>导入提示</DialogTitle>
            <DialogDescription>{notes?.opened ? "文件已打开，但有些内容需要注意：" : "文件没有打开："}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 list-disc space-y-1 overflow-y-auto pl-5 text-[13px]" data-testid="import-notes">
            {notes?.lines.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={editor.helpOpen} onOpenChange={editor.setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>快捷键</DialogTitle>
            <DialogDescription>
              悬停在原子上（蓝圈）再按键，会直接接上结构。绿圈是下一次按键的位置，鼠标先别动可以连按。鼠标挪到别的原子上之后，按键就作用在那里。没悬停时，下面这些键仍是工具。
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <Shortcut keys="1 / 0" action="延长碳链 / 向上加一根键" />
            <Shortcut keys="2 / 8 / z" action="羰基 / 双键 / 三键" />
            <Shortcut keys="3 / a" action="原子上接苯环。键上 3 改三键，a 才并苯环" />
            <Shortcut keys="键上 2 w y" action="改成双键、实楔、波浪键" />
            <Shortcut keys="4 / 5" action="实楔 / 虚楔" />
            <Shortcut keys="6 7 v u" action="环己、环戊、环丙、环丁；已有两根键时变成螺环" />
            <Shortcut keys="j / J" action="两种朝向的椅式环己烷" />
            <Shortcut keys="9 / K" action="分叉；链中间的 K 是一实一虚，末端的 K 是叔丁基" />
            <Shortcut keys="o n s f …" action="换成 OH、NH₂、SH、F。大写 O N F 是 OMe、NO₂、CF₃" />
            <Shortcut keys="Enter / + −" action="编辑这个原子的标签 / 加减电荷" />
            <Shortcut keys="单击空白" action="画一条水平键" />
            <Shortcut keys="V / M" action="没悬停时：套索 / 框选" />
            <Shortcut keys="B / K / R / E" action="没悬停时：单键 / 碳链 / 环 / 橡皮" />
            <Shortcut keys="选中后" action="拖外框的点：顶上旋转，四角缩放，四边拉伸" />
            <Shortcut keys={`${mod}Z / ⇧${mod}Z`} action="撤销 / 重做" />
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function arrowDirection(key: string): "left" | "right" | "up" | "down" | null {
  if (key === "ArrowLeft") return "left"
  if (key === "ArrowRight") return "right"
  if (key === "ArrowUp") return "up"
  if (key === "ArrowDown") return "down"
  return null
}

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <>
      <dt className="text-[#666]">{keys}</dt>
      <dd>{action}</dd>
    </>
  )
}

function MenuButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-6 rounded-sm px-2 text-[13px] hover:bg-black/5 data-open:bg-black/5">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="size-7 rounded-sm text-[#222]"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
