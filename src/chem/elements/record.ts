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
  valences?: number[]
  color?: string
  shortcut?: string
  palette?: number
}
