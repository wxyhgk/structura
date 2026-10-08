import type { Template } from "@structura/core/markush"
import { range, shelf } from "./build.ts"

// Classes kept as classes, with the size ranges claims most often state. Heteroaryl and
// heterocycloalkyl count ring members unless the carbons are named (OLED patents' C2–C30).

export const classes = (): Template[] =>
  shelf("类别", "end", [
    ["alkyl-c1-c30", "C1–C30 烷基", ["alkyl"], range("alkyl", 1, 30)],
    ["alkyl-c1-c20", "C1–C20 烷基", ["C1-C20 alkyl"], range("alkyl", 1, 20)],
    ["alkyl-c1-c10", "C1–C10 烷基", ["C1-C10 alkyl"], range("alkyl", 1, 10)],
    ["alkyl-c1-c6", "C1–C6 烷基", ["C1-C6 alkyl", "lower alkyl"], range("alkyl", 1, 6)],
    ["alkenyl-c2-c6", "C2–C6 烯基", ["C2-C6 alkenyl", "alkenyl"], range("alkenyl", 2, 6)],
    ["alkynyl-c2-c6", "C2–C6 炔基", ["C2-C6 alkynyl", "alkynyl"], range("alkynyl", 2, 6)],
    ["cycloalkyl-c3-c8", "C3–C8 环烷基", ["C3-C8 cycloalkyl", "cycloalkyl"], range("cycloalkyl", 3, 8)],
    ["heterocycloalkyl-3-8", "3–8 元杂环烷基", ["3- to 8-membered heterocycloalkyl", "heterocyclyl"], range("heterocycloalkyl", 3, 8)],
    ["alkoxy-c1-c6", "C1–C6 烷氧基", ["C1-C6 alkoxy", "alkoxy"], range("alkoxy", 1, 6)],
    ["aryl-c6-c30", "C6–C30 芳基", ["aryl"], range("aryl", 6, 30)],
    ["aryl-c6-c12", "C6–C12 芳基", ["C6-C12 aryl"], range("aryl", 6, 12)],
    ["aryloxy-c6-c30", "C6–C30 芳氧基", ["C6-C30 aryloxy", "aryloxy"], range("aryloxy", 6, 30)],
    ["heteroaryl-c2-c30", "C2–C30 杂芳基", ["heteroaryl"], range("heteroaryl", 2, 30, "carbons")],
    ["heteroaryl-5-10", "5–10 元杂芳基", ["5- to 10-membered heteroaryl"], range("heteroaryl", 5, 10)],
    ["silyl", "甲硅烷基", ["silyl"], range("silyl")],
    ["amino", "氨基", ["amino"], range("amino")],
  ])
