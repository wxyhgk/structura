import type { RingKind } from "@structura/core/types"

// Every Chinese word the engine shows, keyed by id, so the rest of the engine holds none.
// The engine decides what to say; this file says it.

export const TOOL_NAMES = {
  lasso: "套索",
  marquee: "框选",
  chain: "碳链",
  eraser: "橡皮",
  "charge-plus": "正电荷",
  "charge-minus": "负电荷",
  ring: "环",
  "ring-current": "环（上次的种类）",
  scaffold: "模板",
}

export const BOND_NAMES = {
  single: "单键",
  double: "双键",
  triple: "三键",
  wedge: "楔形键",
  hash: "虚楔键",
  wavy: "波浪键",
  bold: "粗键",
  dashed: "虚线键",
  shadow: "阴影键",
  "double-bold": "双键（一侧加粗）",
  "double-dashed": "双键（一侧虚线）",
  any: "键",
}

export const RING_NAMES: Record<RingKind, string> = {
  benzene: "苯",
  cyclohexane: "环己烷",
  cyclopentane: "环戊烷",
  cyclopentene: "环戊烯",
  cyclobutane: "环丁烷",
  cyclopropane: "环丙烷",
  cycloheptane: "环庚烷",
  cyclooctane: "环辛烷",
}

export const RECIPE_NAMES: Record<string, string> = {
  carbonyl: "羰基（末端接成乙酰基）",
  fork: "分叉",
  "stereo-pair": "一实一虚两根键",
  sulfonyl: "磺酰基",
  nitro: "硝基",
  azide: "叠氮基",
  trifluoromethyl: "CF₃",
  "tert-butyl": "叔丁基",
  methoxy: "甲氧基",
  "magnesium-bromide": "MgBr",
  chair: "椅式环己烷",
  "chair-flipped": "椅式环己烷（另一朝向）",
}

/** The hover keys' actions, in words. */
export const ACTION_WORDS = {
  extendChain: "延长碳链",
  extendWith: (bond: string) => `接一根${bond}`,
  sproutUp: "向上加一根键",
  phenyl: "接苯环",
  ring: (ring: string) => `接${ring}；已有两根键时变成螺环`,
  recipe: (name: string) => `接${name}`,
  recipeInChain: (end: string, inChain: string) => `末端接${end}，链中间接${inChain}`,
  become: (el: string) => `换成 ${el}`,
  label: (text: string) => `接 ${text}`,
  chargePlus: "加正电荷",
  chargeMinus: "加负电荷",
  restyle: (bond: string) => `改成${bond}`,
  fuse: (ring: string) => `并${ring}`,
  fuseChair: "并椅式环己烷",
  fuseChairFlipped: "并椅式环己烷（另一朝向）",
}

/** What the sketch pad's sites still lack. */
export const SITE_PROBLEMS = {
  empty: "还没有画结构。",
  linkNeedsTwo: (none: boolean) => `连接基要两个位点（两端各一个），${none ? "还没有设" : "还差一个"}：点“设位点”，再点原子。`,
  ringNeedsOne: "环里的原子要指定由哪个原子占住环里的位置：点“设位点”，再点那个原子。",
}

/** Why a drawn piece, or a selection taken into a variable, will not do as an alternative. */
export const PIECE_PROBLEMS = {
  noStar: "片段里要有标成 * 的原子，表示从哪里接到通式上（双击原子输入 *）。",
  tooManyStars: (count: number) => `片段里有 ${count} 个 *，最多两个：接一端用一个，连接基用两个。`,
  disconnected: "画的是几块互不相连的结构，片段要连成一整块。",
  other: (message: string) => `这个片段用不了：${message}`,
  nothingSelected: "先在画布上选中画好的片段。",
  stillConnected: "选中的原子还连着别的结构。片段要单独画，并整个选中。",
}
