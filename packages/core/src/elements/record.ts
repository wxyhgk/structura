export type ElementCategory =
  | "alkali"
  | "alkaline"
  | "transition"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble"
  | "lanthanide"
  | "actinide"

export type ElementRecord = {
  z: number
  symbol: string
  name: string
  mass: number
  col: number
  row: number
  category: ElementCategory
  /** Valences an uncharged atom fills up to with implicit hydrogens, lowest first. */
  valences?: number[]
  /** Higher valences accepted only when bonds reach them exactly, such as N in N(=O)=O. */
  hypervalent?: number[]
  color?: string
  shortcut?: string
  palette?: number
}
