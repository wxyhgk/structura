import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import type { Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { run } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"
import { builtinTemplates, enumerate, templateProblem, type Template } from "@structura/markush"

const { canonical } = await chemistry()

test("every built-in template is valid, suits its site, and has a unique builtin: id", () => {
  const templates = builtinTemplates()
  for (const template of templates) assert.equal(templateProblem(template), null, template.name)
  assert.ok(templates.every((template) => /^builtin:[a-z0-9]+(-[a-z0-9]+)*$/.test(template.id) && template.source === "builtin"))
  assert.equal(new Set(templates.map((template) => template.id)).size, templates.length)
  const groups = new Set(templates.map((template) => template.group))
  for (const group of groups) {
    const names = templates.filter((template) => template.group === group).map((template) => template.name)
    assert.equal(new Set(names).size, names.length, `names repeat in ${group}`)
  }
})

test("the first shipped templates keep their ids", () => {
  const ids = new Set(builtinTemplates().map((template) => template.id))
  for (const key of ["alkyl-c1-c30", "aryl-c6-c30", "heteroaryl-c2-c30", "silyl", "amino", "bond", "arylene-c6-c30", "heteroarylene-c2-c30"]) assert.ok(ids.has(`builtin:${key}`), key)
})

test("the library hands out copies: changing one does not change the next call", () => {
  const first = builtinTemplates()
  first[0].name = "changed"
  assert.notEqual(builtinTemplates()[0].name, "changed")
})

// What each template makes, written down by hand: on benzene for a group (R1), between two
// phenyls for a linker (Ph–L–Ph), and in a cyclopentane for a ring atom (X). Classes are
// shown by their representatives.
const EXPECTED: Record<string, string[]> = {
  // 卤素与小基团
  h: ["c1ccccc1"],
  d: ["[2H]c1ccccc1"],
  f: ["Fc1ccccc1"],
  cl: ["Clc1ccccc1"],
  br: ["Brc1ccccc1"],
  i: ["Ic1ccccc1"],
  cn: ["N#Cc1ccccc1"],
  oh: ["Oc1ccccc1"],
  nh2: ["Nc1ccccc1"],
  no2: ["O=[N+]([O-])c1ccccc1"],
  me: ["Cc1ccccc1"],
  et: ["CCc1ccccc1"],
  "n-pr": ["CCCc1ccccc1"],
  "i-pr": ["CC(C)c1ccccc1"],
  "n-bu": ["CCCCc1ccccc1"],
  "t-bu": ["CC(C)(C)c1ccccc1"],
  cf3: ["FC(F)(F)c1ccccc1"],
  ome: ["COc1ccccc1"],
  oet: ["CCOc1ccccc1"],
  ocf3: ["FC(F)(F)Oc1ccccc1"],
  sme: ["CSc1ccccc1"],
  nme2: ["CN(C)c1ccccc1"],
  co2h: ["OC(=O)c1ccccc1"],
  co2me: ["COC(=O)c1ccccc1"],
  ac: ["CC(=O)c1ccccc1"],
  tms: ["C[Si](C)(C)c1ccccc1"],
  // 芳基
  phenyl: ["c1ccc(-c2ccccc2)cc1"],
  naphthyl: ["c1ccc(-c2cccc3ccccc23)cc1", "c1ccc(-c2ccc3ccccc3c2)cc1"],
  "biphenyl-4-yl": ["c1ccc(-c2ccc(-c3ccccc3)cc2)cc1"],
  anthryl: ["c1ccc(-c2cccc3cc4ccccc4cc23)cc1", "c1ccc(-c2ccc3cc4ccccc4cc3c2)cc1", "c1ccc(-c2c3ccccc3cc3ccccc23)cc1"],
  phenanthryl: [
    "c1ccc(-c2cccc3c2ccc2ccccc23)cc1",
    "c1ccc(-c2ccc3c(c2)ccc2ccccc23)cc1",
    "c1ccc(-c2ccc3ccc4ccccc4c3c2)cc1",
    "c1ccc(-c2cccc3ccc4ccccc4c23)cc1",
    "c1ccc(-c2cc3ccccc3c3ccccc23)cc1",
  ],
  "9-9-dimethylfluoren-2-yl": ["CC1(C)c2ccccc2-c2ccc(-c3ccccc3)cc21"],
  triphenylenyl: ["c1ccc(-c2cccc3c2c2ccccc2c2ccccc32)cc1", "c1ccc(-c2ccc3c(c2)c2ccccc2c2ccccc32)cc1"],
  // 杂芳基
  pyridyl: ["c1ccc(-c2ccccn2)cc1", "c1ccc(-c2cccnc2)cc1", "c1ccc(-c2ccncc2)cc1"],
  pyrimidinyl: ["c1ccc(-c2ncccn2)cc1", "c1ccc(-c2ccncn2)cc1", "c1ccc(-c2cncnc2)cc1"],
  pyrazinyl: ["c1ccc(-c2cnccn2)cc1"],
  triazinyl: ["c1ccc(-c2ncncn2)cc1"],
  diphenyltriazinyl: ["c1ccc(-c2nc(-c3ccccc3)nc(-c3ccccc3)n2)cc1"],
  thienyl: ["c1ccc(-c2cccs2)cc1", "c1ccc(-c2ccsc2)cc1"],
  furyl: ["c1ccc(-c2ccco2)cc1", "c1ccc(-c2ccoc2)cc1"],
  pyrrolyl: ["c1ccc(-n2cccc2)cc1", "c1ccc(-c2ccc[nH]2)cc1", "c1ccc(-c2cc[nH]c2)cc1"],
  pyrazolyl: ["c1ccc(-n2cccn2)cc1", "c1ccc(-c2cc[nH]n2)cc1", "c1ccc(-c2cn[nH]c2)cc1"],
  imidazolyl: ["c1ccc(-n2ccnc2)cc1", "c1ccc(-c2ncc[nH]2)cc1", "c1ccc(-c2c[nH]cn2)cc1"],
  thiazolyl: ["c1ccc(-c2nccs2)cc1", "c1ccc(-c2cscn2)cc1", "c1ccc(-c2cncs2)cc1"],
  oxazolyl: ["c1ccc(-c2ncco2)cc1", "c1ccc(-c2cocn2)cc1", "c1ccc(-c2cnco2)cc1"],
  indolyl: [
    "c1ccc(-n2ccc3ccccc32)cc1",
    "c1ccc(-c2cc3ccccc3[nH]2)cc1",
    "c1ccc(-c2c[nH]c3ccccc23)cc1",
    "c1ccc(-c2cccc3[nH]ccc23)cc1",
    "c1ccc(-c2ccc3[nH]ccc3c2)cc1",
    "c1ccc(-c2ccc3cc[nH]c3c2)cc1",
    "c1ccc(-c2cccc3cc[nH]c23)cc1",
  ],
  quinolyl: [
    "c1ccc(-c2ccc3ccccc3n2)cc1",
    "c1ccc(-c2cnc3ccccc3c2)cc1",
    "c1ccc(-c2ccnc3ccccc23)cc1",
    "c1ccc(-c2cccc3ncccc23)cc1",
    "c1ccc(-c2ccc3ncccc3c2)cc1",
    "c1ccc(-c2ccc3cccnc3c2)cc1",
    "c1ccc(-c2cccc3cccnc23)cc1",
  ],
  isoquinolyl: [
    "c1ccc(-c2nccc3ccccc23)cc1",
    "c1ccc(-c2cc3ccccc3cn2)cc1",
    "c1ccc(-c2cncc3ccccc23)cc1",
    "c1ccc(-c2cccc3cnccc23)cc1",
    "c1ccc(-c2ccc3cnccc3c2)cc1",
    "c1ccc(-c2ccc3ccncc3c2)cc1",
    "c1ccc(-c2cccc3ccncc23)cc1",
  ],
  benzofuranyl: [
    "c1ccc(-c2cc3ccccc3o2)cc1",
    "c1ccc(-c2coc3ccccc23)cc1",
    "c1ccc(-c2cccc3occc23)cc1",
    "c1ccc(-c2ccc3occc3c2)cc1",
    "c1ccc(-c2ccc3ccoc3c2)cc1",
    "c1ccc(-c2cccc3ccoc23)cc1",
  ],
  benzothienyl: [
    "c1ccc(-c2cc3ccccc3s2)cc1",
    "c1ccc(-c2csc3ccccc23)cc1",
    "c1ccc(-c2cccc3sccc23)cc1",
    "c1ccc(-c2ccc3sccc3c2)cc1",
    "c1ccc(-c2ccc3ccsc3c2)cc1",
    "c1ccc(-c2cccc3ccsc23)cc1",
  ],
  benzimidazolyl: ["c1ccc(-n2cnc3ccccc32)cc1", "c1ccc(-c2nc3ccccc3[nH]2)cc1", "c1ccc(-c2cccc3[nH]cnc23)cc1", "c1ccc(-c2ccc3[nH]cnc3c2)cc1"],
  benzoxazolyl: ["c1ccc(-c2nc3ccccc3o2)cc1", "c1ccc(-c2cccc3ocnc23)cc1", "c1ccc(-c2ccc3ocnc3c2)cc1", "c1ccc(-c2ccc3ncoc3c2)cc1", "c1ccc(-c2cccc3ncoc23)cc1"],
  benzothiazolyl: ["c1ccc(-c2nc3ccccc3s2)cc1", "c1ccc(-c2cccc3scnc23)cc1", "c1ccc(-c2ccc3scnc3c2)cc1", "c1ccc(-c2ccc3ncsc3c2)cc1", "c1ccc(-c2cccc3ncsc23)cc1"],
  "carbazol-9-yl": ["c1ccc(-n2c3ccccc3c3ccccc32)cc1"],
  "9-phenylcarbazol-3-yl": ["c1ccc(-c2ccc3c(c2)c2ccccc2n3-c2ccccc2)cc1"],
  dibenzofuranyl: ["c1ccc(-c2cccc3oc4ccccc4c23)cc1", "c1ccc(-c2ccc3oc4ccccc4c3c2)cc1", "c1ccc(-c2ccc3c(c2)oc2ccccc23)cc1", "c1ccc(-c2cccc3c2oc2ccccc23)cc1"],
  dibenzothienyl: ["c1ccc(-c2cccc3sc4ccccc4c23)cc1", "c1ccc(-c2ccc3sc4ccccc4c3c2)cc1", "c1ccc(-c2ccc3c(c2)sc2ccccc23)cc1", "c1ccc(-c2cccc3c2sc2ccccc23)cc1"],
  "phenoxazin-10-yl": ["c1ccc(-n2c3ccccc3oc3ccccc32)cc1"],
  "phenothiazin-10-yl": ["c1ccc(-n2c3ccccc3sc3ccccc32)cc1"],
  // 饱和环
  cyclopropyl: ["c1ccc(C2CC2)cc1"],
  cyclobutyl: ["c1ccc(C2CCC2)cc1"],
  cyclopentyl: ["c1ccc(C2CCCC2)cc1"],
  cyclohexyl: ["c1ccc(C2CCCCC2)cc1"],
  cycloheptyl: ["c1ccc(C2CCCCCC2)cc1"],
  adamantyl: ["c1ccc(C23CC4CC(CC(C4)C2)C3)cc1"],
  "pyrrolidin-1-yl": ["c1ccc(N2CCCC2)cc1"],
  "piperidin-1-yl": ["c1ccc(N2CCCCC2)cc1"],
  "piperazin-1-yl": ["c1ccc(N2CCNCC2)cc1"],
  "4-methylpiperazin-1-yl": ["CN1CCN(c2ccccc2)CC1"],
  morpholino: ["c1ccc(N2CCOCC2)cc1"],
  tetrahydropyranyl: ["c1ccc(C2CCOCC2)cc1", "c1ccc(C2CCCCO2)cc1", "c1ccc(C2CCCOC2)cc1"],
  // 连接基 (Ph–L–Ph)
  bond: ["c1ccc(-c2ccccc2)cc1"],
  "p-phenylene": ["c1ccc(-c2ccc(-c3ccccc3)cc2)cc1"],
  "m-phenylene": ["c1ccc(-c2cccc(-c3ccccc3)c2)cc1"],
  "o-phenylene": ["c1ccc(-c2ccccc2-c2ccccc2)cc1"],
  "4-4-biphenylene": ["c1ccc(-c2ccc(-c3ccc(-c4ccccc4)cc3)cc2)cc1"],
  "2-6-naphthylene": ["c1ccc(-c2ccc3cc(-c4ccccc4)ccc3c2)cc1"],
  "1-4-naphthylene": ["c1ccc(-c2ccc(-c3ccccc3)c3ccccc23)cc1"],
  "9-9-dimethylfluorene-2-7-diyl": ["CC1(C)c2cc(-c3ccccc3)ccc2-c2ccc(-c3ccccc3)cc21"],
  "2-5-pyridinediyl": ["c1ccc(-c2ccc(-c3ccccc3)nc2)cc1"],
  "thiophene-2-5-diyl": ["c1ccc(-c2ccc(-c3ccccc3)s2)cc1"],
  oxy: ["c1ccc(Oc2ccccc2)cc1"],
  thio: ["c1ccc(Sc2ccccc2)cc1"],
  imino: ["c1ccc(Nc2ccccc2)cc1"],
  methylene: ["c1ccc(Cc2ccccc2)cc1"],
  carbonyl: ["O=C(c1ccccc1)c1ccccc1"],
  ethynylene: ["c1ccc(C#Cc2ccccc2)cc1"],
  "arylene-c6-c30": ["c1ccc(-c2ccc(-c3ccccc3)cc2)cc1", "c1ccc(-c2cccc(-c3ccccc3)c2)cc1", "c1ccc(-c2ccc(-c3ccc(-c4ccccc4)cc3)cc2)cc1"],
  "heteroarylene-c2-c30": ["c1ccc(-c2ccc(-c3ccccc3)nc2)cc1"],
  // 环内原子 (X in cyclopentane)
  "ring-o": ["C1CCOC1"],
  "ring-s": ["C1CCSC1"],
  "ring-nh": ["C1CCNC1"],
  "ring-ch2": ["C1CCCC1"],
  "ring-nme": ["CN1CCCC1"],
  "ring-nph": ["c1ccc(N2CCCC2)cc1"],
  "ring-cme2": ["CC1(C)CCCC1"],
  "ring-sime2": ["C[Si]1(C)CCCC1"],
  "ring-siph2": ["c1ccc([Si]2(c3ccccc3)CCCC2)cc1"],
  "ring-co": ["O=C1CCCC1"],
  "ring-so2": ["O=S1(=O)CCCC1"],
  // 类别 (by their representatives)
  ...Object.fromEntries(["alkyl-c1-c30", "alkyl-c1-c20", "alkyl-c1-c10", "alkyl-c1-c6"].map((key) => [key, ["Cc1ccccc1", "CCc1ccccc1", "CC(C)c1ccccc1", "CC(C)(C)c1ccccc1", "FC(F)(F)c1ccccc1"]])),
  "alkenyl-c2-c6": ["C=Cc1ccccc1", "C=CCc1ccccc1"],
  "alkynyl-c2-c6": ["C#Cc1ccccc1", "C#CCc1ccccc1"],
  "cycloalkyl-c3-c8": ["c1ccc(C2CC2)cc1", "c1ccc(C2CCCCC2)cc1"],
  "heterocycloalkyl-3-8": ["c1ccc(C2CCCCO2)cc1"],
  "alkoxy-c1-c6": ["COc1ccccc1", "CCOc1ccccc1"],
  ...Object.fromEntries(
    ["aryl-c6-c30", "aryl-c6-c12"].map((key) => [
      key,
      [
        "c1ccc(-c2ccccc2)cc1",
        "c1ccc(-c2cccc3ccccc23)cc1",
        "c1ccc(-c2ccc3ccccc3c2)cc1",
        "c1ccc(-c2ccc(-c3ccccc3)cc2)cc1",
        "Cc1ccc(-c2ccccc2)cc1",
        "Cc1cc(C)c(-c2ccccc2)c(C)c1",
      ],
    ]),
  ),
  "aryloxy-c6-c30": ["c1ccc(Oc2ccccc2)cc1"],
  ...Object.fromEntries(
    ["heteroaryl-c2-c30", "heteroaryl-5-10"].map((key) => [
      key,
      ["c1ccc(-c2ccccn2)cc1", "c1ccc(-c2ccco2)cc1", "c1ccc(-c2cccs2)cc1", "c1ccc(-c2ncccn2)cc1", "c1ccc(-c2c[nH]c3ccccc23)cc1"],
    ]),
  ),
  silyl: ["[SiH3]c1ccccc1", "C[Si](C)(C)c1ccccc1", "c1ccc([Si](c2ccccc2)(c2ccccc2)c2ccccc2)cc1"],
  amino: ["Nc1ccccc1", "CN(C)c1ccccc1", "c1ccc(Nc2ccccc2)cc1"],
}

/** A formula with one placeholder where the template stands: R1 on benzene, Ph–L–Ph, or X in cyclopentane. */
function probe(template: Template): Drawing {
  const define: Op = { op: "set_variable", name: "", alternatives: [template.alternative] }
  if (template.site === "ring") return run(emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, size: 5 }, { op: "label", atom: 1, text: "X" }, { ...define, name: "X" }])
  const ops: Op[] = [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "p" },
    { op: "label", atom: "p", text: template.site === "link" ? "L" : "R1" },
  ]
  if (template.site === "link") ops.push({ op: "add_atom", el: "C", to: "p", as: "ph" }, { op: "label", atom: "ph", text: "Ph" })
  return run(emptyDrawing(), [...ops, { ...define, name: template.site === "link" ? "L" : "R1" }])
}

test("every built-in template has the compounds written down for it, and no others", () => {
  const keys = builtinTemplates().map((template) => template.id.slice("builtin:".length))
  assert.deepEqual([...keys].sort(), Object.keys(EXPECTED).sort())
})

for (const template of builtinTemplates()) {
  const key = template.id.slice("builtin:".length)
  test(`built-in ${template.group} · ${template.name} makes what its name says`, () => {
    const result = enumerate(probe(template), { representatives: true })
    assert.equal(result.failed, 0, JSON.stringify(result.failures))
    assert.deepEqual(result.misfits, {})
    assert.deepEqual(result.molecules.map(canonical).sort(), (EXPECTED[key] ?? []).map(canonical).sort())
  })
}
