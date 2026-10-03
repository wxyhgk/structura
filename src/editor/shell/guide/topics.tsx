import type { ReactNode } from "react"
import { MOD } from "@/editor/browser"
import { H, K, List, P, Steps, Table, Tip } from "./parts.tsx"

// The guide's pages: how to do things in the editor, in the order a newcomer needs them.

export type GuideTopic =
  | "start"
  | "draw"
  | "labels"
  | "select"
  | "shortcuts"
  | "files"
  | "markush"
  | "attachment"
  | "fragments"
  | "enumerate"
  | "ai"

/** What a page may do besides showing text: open the full shortcut table. */
export type GuideActions = { openShortcuts: () => void }

export type Page = {
  id: GuideTopic
  group: string
  title: string
  /** Extra words to find the page by, besides its title and text. */
  keywords: string
  body: (actions: GuideActions) => ReactNode
}

export const PAGES: Page[] = [
  {
    id: "start",
    group: "入门",
    title: "快速上手",
    keywords: "开始 入门 画布 平移 缩放 热点 蓝圈 撤销",
    body: () => (
      <>
        <P>左边是工具和元素，中间是画布，画了通式变量时右边会出现“通式变量”面板。画布没有边界，视图不会自己移动或缩放。</P>
        <H>移动视图</H>
        <Table
          rows={[
            ["滚轮 / 触控板滑动", "平移"],
            [`按住 [空格] 拖动，或按住中键拖动`, "平移"],
            [`[${MOD}] + 滚轮，或触控板捏合`, "缩放"],
            [`[${MOD}][=] / [${MOD}][-] / [${MOD}][0]`, "放大 / 缩小 / 实际大小"],
          ]}
        />
        <H>最快的画法：悬停再按键</H>
        <Steps>
          <li>单击空白，画出第一根键。</li>
          <li>鼠标停在一个原子上（出现蓝圈），按键就在这里接结构：<K>1</K> 延长碳链，<K>3</K> 或 <K>A</K> 接苯环，<K>6</K> 接环己烷，<K>O</K> 换成氧……</li>
          <li>刚接上的结构末端会成为“热点”，蓝圈留在那里，鼠标不动可以连按。</li>
          <li>鼠标移到别的原子上，按键就作用在那里。</li>
        </Steps>
        <Tip>屏幕上始终只有一个蓝圈，它就是下一次按键作用的位置：先看鼠标悬停的原子，没有就看热点，再没有就看选中的原子。</Tip>
        <H>出错了</H>
        <Table
          rows={[
            [`[${MOD}][Z] / [${MOD}][⇧][Z]`, "撤销 / 重做"],
            ["[Esc]", "取消正在进行的操作 → 取消选中 → 回到套索工具"],
          ]}
        />
      </>
    ),
  },
  {
    id: "draw",
    group: "绘图",
    title: "画键、环和链",
    keywords: "键 单键 双键 三键 楔形 环 苯 碳链 橡皮 电荷 元素 周期表",
    body: () => (
      <>
        <Table
          rows={[
            [`键 [B] [X] [1]`, "单击空白画一根水平键；从原子拖出新键；单击已有的键，在单、双、三键之间切换"],
            [`双键 [2]、三键 [3] [Z]、楔形 [W]、虚楔 [⇧W]、波浪 [Y]`, "同上，画出对应的键（工具栏“键”按钮下也能选）"],
            [`碳链 [K]`, "按住拖动，画出锯齿形碳链，松开时的长度就是链长"],
            [`环 [R]`, "单击空白放一个环，单击原子接上一个环，单击键并上一个环；苯 J / A，环丙烷 T，4–8 元环按数字"],
            [`橡皮 [E]`, "点原子或键删除"],
            ["正 / 负电荷", "点原子加一个正 / 负电荷"],
            ["元素面板、周期表", "先点元素，再点空白放原子，或点原子把它换成这种元素"],
          ]}
        />
        <Tip>没有悬停在原子或键上、也没有热点时，单个字母键用来切换工具；悬停在原子上时，同样的键是在这里接结构。完整对照见“快捷键”。</Tip>
      </>
    ),
  },
  {
    id: "labels",
    group: "绘图",
    title: "原子标签和缩写",
    keywords: "标签 双击 Enter 元素 OH NH2 缩写 Me Ph OMe Boc 同位素 D 13C",
    body: () => (
      <>
        <P>
          双击原子，或悬停在原子上按 <K>Enter</K>，就能输入标签，回车确定。
        </P>
        <Table
          rows={[
            ["元素", "N、O、S、Cl、Br、Si……"],
            ["带氢的写法", "OH、NH2、SH、HO、H2N 也可以，氢原子数按价态自动计算"],
            ["缩写", "Me、Et、iPr、tBu、Ph、Bn、Ac、Bz、Boc、Cbz、Fmoc、TMS、TBS、Ts 保留为标签；OMe、CO2Me、CF3、NO2 等其他缩写会展开成原子"],
            ["同位素", "D、T，或在元素前写质量数，如 13C、15N"],
            ["变量（通式）", "R、R1、X、L、Ar1、ETU 这类名字成为占位符，见“通式：变量和候选项”"],
            ["连接点", "* 表示片段接到通式上的位置，见“通式：画出来的片段”"],
          ]}
        />
        <Tip>Ar 是氩元素，不能当变量名；写成 Ar1、Ar2。</Tip>
      </>
    ),
  },
  {
    id: "select",
    group: "编辑",
    title: "选择、移动和变换",
    keywords: "选择 套索 框选 全选 双击 移动 旋转 翻转 复制 粘贴 删除 整理 替换 箭头",
    body: () => (
      <>
        <H>选择</H>
        <Table
          rows={[
            [`套索 [V] / 框选 [M]`, "拖出范围选中"],
            [`[${MOD}][A]`, "全选"],
            ["双击键", "选中它所在的整个分子"],
            [`悬停按 [G] / [Tab] / [空格]`, "选中这个原子 / 整个分子"],
            ["选中原子后按键", "每个选中的原子都接上结构（例如全选后按 1）"],
          ]}
        />
        <H>移动和变换</H>
        <Table
          rows={[
            ["拖动选中部分", "移动"],
            ["选框上的点", "顶上的点旋转，四角缩放，四边拉伸"],
            [`[⇧] + 方向键`, "移动 10 像素"],
            [`[⌥] + 方向键`, "旋转 15°"],
            [`[⇧][⌥] + 方向键`, "3D 翻转"],
            ["结构菜单", "旋转 180°、水平 / 垂直翻转"],
          ]}
        />
        <H>编辑</H>
        <Table
          rows={[
            [`[${MOD}][C] / [${MOD}][X] / [${MOD}][V]`, "复制 / 剪切 / 粘贴（剪贴板里是 MOL 文本）"],
            [`[${MOD}][D]`, "在旁边复制一份"],
            [`[Delete] / [Backspace]`, "删除"],
            [`[${MOD}][⇧][K]`, "整理结构（键长、键角、环形状），有选中时只整理选中部分"],
            [`[${MOD}][E]`, "把选中的片段替换成别的基团"],
            [`[${MOD}] + 方向键`, "在选中部分旁加一个反应箭头"],
          ]}
        />
      </>
    ),
  },
  {
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
  },
  {
    id: "files",
    group: "文件",
    title: "保存、打开和导出",
    keywords: "保存 打开 导出 SVG MOL SDF SMILES 粘贴 拖入 structura",
    body: () => (
      <>
        <Table
          rows={[
            [`[${MOD}][S] 保存`, "存成 .structura 文件，通式变量、可变连接、片段都在里面"],
            [`[${MOD}][O] 打开`, "打开 .structura、MOL 或 SDF；也可以把文件直接拖进页面"],
            ["导出 SVG / MOL", "文件菜单；MOL 只含分子本身，不含通式变量的定义"],
            ["导入 SMILES", "文件菜单，或把 SMILES 文本直接粘贴到画布上；第一次会下载 RDKit（约 2.4 MB）"],
            [`[${MOD}][N] 新建`, "清空画布（可以撤销）"],
          ]}
        />
      </>
    ),
  },
  {
    id: "markush",
    group: "通式（Markush）",
    title: "变量和候选项",
    keywords: "通式 markush 变量 R1 X L 候选项 卤素 单键 类别 烷基 芳基 共用 相同",
    body: () => (
      <>
        <P>专利里的通式：在结构上用 R1、X、L 这类变量占位，再规定每个变量可以是什么。</P>
        <H>定义变量</H>
        <Steps>
          <li>双击原子，输入变量名（R、R1、X、L、Ar1、ETU……），右边出现“通式变量”面板。</li>
          <li>在变量下面的输入框里填候选项：元素或缩写，用逗号或顿号隔开，回车添加。“卤素”会展开成 F、Cl、Br、I；连接基可以填“单键”。</li>
          <li>范围类的候选项（“取代或未取代的 C1–C30 烷基”）点下面的预设按钮，或点“更多…”自己选类别、碳数或环大小、取代与否。类别会保持为类别，不展开。</li>
          <li>具体的结构（咔唑基、萘撑、N–R5……）画出来收进去，见“画出来的片段”。</li>
        </Steps>
        <H>几个变量用同一组候选项</H>
        <P>“R1 至 R4 各自独立地选自……”：先把 R1 填好，再在 R2–R4 的下拉框里选“与 R1 相同”。以后只改 R1 即可。</P>
        <H>变量的位置决定能放什么</H>
        <List>
          <li>链的末端（R1）：一价基团或原子，比如 H、Cl、Me、Ph。</li>
          <li>环里（X）：元素，比如 O、S；带取代基的原子（N–R5、CMe2）用片段。</li>
          <li>两个原子之间（L）：单键、亚芳基、O、S，或两端都有 * 的片段。</li>
        </List>
        <Tip>放不下的候选项不会报错，批量生成时会跳过并在提示里说明。</Tip>
      </>
    ),
  },
  {
    id: "attachment",
    group: "通式（Markush）",
    title: "可变连接（接在环的任意位置）",
    keywords: "可变连接 环中心 任意位置 取代基 虚线 位置",
    body: () => (
      <>
        <P>表示“这个取代基可以接在这个环的任一空位上”。</P>
        <Steps>
          <li>从取代基（或它的起点原子）画一根键，终点拖进环的中心，松开。</li>
          <li>拖动时会提示可接的位置；画好后用细线连到这些位置。</li>
          <li>批量生成时会逐个位置展开；已经接了别的基团的位置自动跳过。</li>
        </Steps>
        <Tip>想撤掉，按 {MOD}Z，或删除这个取代基。</Tip>
      </>
    ),
  },
  {
    id: "fragments",
    group: "通式（Markush）",
    title: "画出来的片段",
    keywords: "片段 星号 * 连接点 咔唑 萘撑 嵌套 用选中的结构 NR CMe2",
    body: () => (
      <>
        <P>当候选项是一个具体的结构（咔唑-9-基、2,6-萘撑、N–R5……），缩写表里没有时，就把它画出来。</P>
        <Steps>
          <li>在画布空白处单独画出片段，不要连在通式上。</li>
          <li>在片段上接一个原子，双击它输入 <b>*</b>，表示从这里接到通式上。</li>
          <li>用框选或套索选中整个片段（包括 *）。</li>
          <li>在右边对应变量那一行点“+ 用选中的结构”。片段离开画布，成为这个变量的候选项（可以撤销）。</li>
        </Steps>
        <H>* 怎么画</H>
        <Table
          rows={[
            ["接一端的取代基（R1、Ar1）", "一个 *，接在连接原子上"],
            ["连接基（L）", "两个 *，分别接在两端的原子上"],
            ["环里的原子（X = N–R5、CMe2、SiPh2）", "两个 *，都接在同一个原子上，这个原子会占住环里的位置"],
          ]}
        />
        <H>片段里还可以有变量</H>
        <P>片段里的 R5 也是变量，面板里会出现它（标“在片段里”），照常定义。批量生成时一起展开，最多嵌套 4 层；变量不能通过片段包含自己。</P>
        <Tip>选得不对时，面板会说明原因：没有 *、还连着通式、不是一整块等。</Tip>
      </>
    ),
  },
  {
    id: "enumerate",
    group: "通式（Markush）",
    title: "批量生成化合物",
    keywords: "批量生成 枚举 展开 代表结构 SDF 停止 上限",
    body: () => (
      <>
        <Steps>
          <li>点面板底部的“批量生成化合物…”（结构菜单里也有）。</li>
          <li>默认勾选“基团类别用代表结构展开”：烷基用甲基、乙基、异丙基、叔丁基，芳基用苯基、萘基等；不勾选时类别不展开。</li>
          <li>选择最多生成多少个（100 / 500 / 2000），组合太多时可以随时点“停止”。</li>
          <li>点“下载 SDF”：每条记录带着各变量的取值和连接位置，可以在其他软件里筛选。</li>
        </Steps>
        <Tip>对话框上方的提示会说明哪些候选项放不下被跳过、哪些位置已被占用、哪些组合生成失败及原因。</Tip>
      </>
    ),
  },
  {
    id: "ai",
    group: "通式（Markush）",
    title: "从专利文字填写",
    keywords: "AI 专利 文字 自动 填写 Claude OpenAI key",
    body: () => (
      <>
        <P>把权利要求里定义变量的那几段文字粘进去，由大模型读出每个变量的候选项。</P>
        <Steps>
          <li>先画好通式，标出变量。</li>
          <li>点面板底部的“从专利文字填写…”，粘贴文字，点“读取”。</li>
          <li>逐个检查：会列出没采用的写法和表达不了、需要人工处理的部分（取代基范围、“相邻基团可成环”等）。</li>
          <li>勾选要用的变量，点“应用”，整个填写算一步，可以撤销。</li>
        </Steps>
        <Tip>需要服务器上配置 API key（项目根目录的 .env.local，见 README）。</Tip>
      </>
    ),
  },
]

export function pageOf(id: GuideTopic): Page {
  return PAGES.find((page) => page.id === id) ?? PAGES[0]
}
