import type { Template } from "@structura/core/markush"
import { label, shelf } from "./build.ts"

// Atoms and small groups at a branch end (R1 = H, F, Me, OMe…): plain labels, each an element
// or a known abbreviation, so they are drawn and expanded the way the user types them.

export const smallGroups = (): Template[] =>
  shelf("卤素与小基团", "end", [
    ["h", "氢", ["H", "hydrogen"], label("H")],
    ["d", "氘", ["D", "deuterium"], label("D")],
    ["f", "氟", ["F", "fluoro"], label("F")],
    ["cl", "氯", ["Cl", "chloro"], label("Cl")],
    ["br", "溴", ["Br", "bromo"], label("Br")],
    ["i", "碘", ["I", "iodo"], label("I")],
    ["cn", "氰基", ["CN", "cyano"], label("CN")],
    ["oh", "羟基", ["OH", "hydroxy"], label("OH")],
    ["nh2", "氨基（NH2）", ["NH2", "amino"], label("NH2")],
    ["no2", "硝基", ["NO2", "nitro"], label("NO2")],
    ["me", "甲基", ["Me", "methyl"], label("Me")],
    ["et", "乙基", ["Et", "ethyl"], label("Et")],
    ["n-pr", "正丙基", ["nPr", "n-propyl"], label("nPr")],
    ["i-pr", "异丙基", ["iPr", "isopropyl"], label("iPr")],
    ["n-bu", "正丁基", ["nBu", "n-butyl"], label("nBu")],
    ["t-bu", "叔丁基", ["tBu", "tert-butyl"], label("tBu")],
    ["cf3", "三氟甲基", ["CF3", "trifluoromethyl"], label("CF3")],
    ["ome", "甲氧基", ["OMe", "methoxy"], label("OMe")],
    ["oet", "乙氧基", ["OEt", "ethoxy"], label("OEt")],
    ["ocf3", "三氟甲氧基", ["OCF3", "trifluoromethoxy"], label("OCF3")],
    ["sme", "甲硫基", ["SMe", "methylthio"], label("SMe")],
    ["nme2", "二甲氨基", ["NMe2", "dimethylamino"], label("NMe2")],
    ["co2h", "羧基", ["CO2H", "carboxy"], label("CO2H")],
    ["co2me", "甲氧羰基", ["CO2Me", "methoxycarbonyl"], label("CO2Me")],
    ["ac", "乙酰基", ["Ac", "acetyl"], label("Ac")],
    ["tms", "三甲基硅基", ["TMS", "SiMe3", "trimethylsilyl"], label("TMS")],
  ])
