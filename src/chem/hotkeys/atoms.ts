import { bumpCharge, sproutAt } from "../molecule.ts"
import type { Molecule } from "../types.ts"
import {
  addAzide,
  addCarbonyl,
  addChair,
  addFork,
  addMagnesiumBromide,
  addMethoxy,
  addNitro,
  addPhenyl,
  addRing,
  addStereoPair,
  addSulfonyl,
  addTertButyl,
  addTrifluoromethyl,
  become,
  extend,
  isotopeOf,
  nick,
} from "./groups.ts"
import { atomNext, degree, DOUBLE, HASH, SINGLE, TRIPLE, WEDGE, type HotResult } from "./shared.ts"

export function atomHotkey(mol: Molecule, id: number, key: string): HotResult | null {
  switch (key) {
    case "0": {
      const grown = sproutAt(mol, id, Math.PI / 2, SINGLE, "C")
      return atomNext(grown.mol, grown.id)
    }
    case "1":
      return extend(mol, id, SINGLE)
    case "2":
      return addCarbonyl(mol, id)
    case "3":
    case "a":
      return addPhenyl(mol, id)
    case "4":
      return extend(mol, id, WEDGE)
    case "5":
      return extend(mol, id, HASH)
    case "6":
      return addRing(mol, id, "cyclohexane")
    case "7":
      return addRing(mol, id, "cyclopentane")
    case "8":
      return extend(mol, id, DOUBLE)
    case "9":
      return addFork(mol, id)
    case "z":
      return extend(mol, id, TRIPLE)
    case "Z":
      return addAzide(mol, id)
    case "v":
      return addRing(mol, id, "cyclopropane")
    case "u":
      return addRing(mol, id, "cyclobutane")
    case "k":
      return addSulfonyl(mol, id)
    case "K":
      return degree(mol, id) >= 2 ? addStereoPair(mol, id) : addTertButyl(mol, id)
    case "j":
      return addChair(mol, id, 1)
    case "J":
      return addChair(mol, id, -1)
    case "o":
    case "q":
      return become(mol, id, "O")
    case "O":
      return addMethoxy(mol, id)
    case "n":
    case "w":
      return become(mol, id, "N")
    case "N":
      return addNitro(mol, id)
    case "s":
      return become(mol, id, "S")
    case "S":
      return become(mol, id, "Si")
    case "p":
      return become(mol, id, "P")
    case "P":
      return nick(mol, id, "Ph")
    case "f":
      return become(mol, id, "F")
    case "F":
      return addTrifluoromethyl(mol, id)
    case "l":
    case "C":
      return become(mol, id, "Cl")
    case "b":
      return become(mol, id, "Br")
    case "i":
      return become(mol, id, "I")
    case "h":
      return become(mol, id, "H")
    case "d":
      return isotopeOf(mol, id, "H", 2)
    case "L":
      return become(mol, id, "Li")
    case "m":
      return nick(mol, id, "Me")
    case "c":
      return nick(mol, id, "CH3")
    case "e":
      return nick(mol, id, "Et")
    case "A":
      return nick(mol, id, "Ac")
    case "E":
      return nick(mol, id, "CO2Me")
    case "B":
      return become(mol, id, "B")
    case "M":
      return addMagnesiumBromide(mol, id)
    case "H":
      return nick(mol, id, "Cbz")
    case "y":
      return nick(mol, id, "Boc")
    case "Q":
      return nick(mol, id, "Fmoc")
    case "+":
    case "=":
      return atomNext(bumpCharge(mol, [id], 1), id)
    case "-":
      return atomNext(bumpCharge(mol, [id], -1), id)
    default:
      return null
  }
}
