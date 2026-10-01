import type { ElementRecord } from "./record.ts"

import H from "./H.ts"
import He from "./He.ts"
import Li from "./Li.ts"
import Be from "./Be.ts"
import B from "./B.ts"
import C from "./C.ts"
import N from "./N.ts"
import O from "./O.ts"
import F from "./F.ts"
import Ne from "./Ne.ts"
import Na from "./Na.ts"
import Mg from "./Mg.ts"
import Al from "./Al.ts"
import Si from "./Si.ts"
import P from "./P.ts"
import S from "./S.ts"
import Cl from "./Cl.ts"
import Ar from "./Ar.ts"
import K from "./K.ts"
import Ca from "./Ca.ts"
import Sc from "./Sc.ts"
import Ti from "./Ti.ts"
import V from "./V.ts"
import Cr from "./Cr.ts"
import Mn from "./Mn.ts"
import Fe from "./Fe.ts"
import Co from "./Co.ts"
import Ni from "./Ni.ts"
import Cu from "./Cu.ts"
import Zn from "./Zn.ts"
import Ga from "./Ga.ts"
import Ge from "./Ge.ts"
import As from "./As.ts"
import Se from "./Se.ts"
import Br from "./Br.ts"
import Kr from "./Kr.ts"
import Rb from "./Rb.ts"
import Sr from "./Sr.ts"
import Y from "./Y.ts"
import Zr from "./Zr.ts"
import Nb from "./Nb.ts"
import Mo from "./Mo.ts"
import Tc from "./Tc.ts"
import Ru from "./Ru.ts"
import Rh from "./Rh.ts"
import Pd from "./Pd.ts"
import Ag from "./Ag.ts"
import Cd from "./Cd.ts"
import In from "./In.ts"
import Sn from "./Sn.ts"
import Sb from "./Sb.ts"
import Te from "./Te.ts"
import I from "./I.ts"
import Xe from "./Xe.ts"
import Cs from "./Cs.ts"
import Ba from "./Ba.ts"
import La from "./La.ts"
import Ce from "./Ce.ts"
import Pr from "./Pr.ts"
import Nd from "./Nd.ts"
import Pm from "./Pm.ts"
import Sm from "./Sm.ts"
import Eu from "./Eu.ts"
import Gd from "./Gd.ts"
import Tb from "./Tb.ts"
import Dy from "./Dy.ts"
import Ho from "./Ho.ts"
import Er from "./Er.ts"
import Tm from "./Tm.ts"
import Yb from "./Yb.ts"
import Lu from "./Lu.ts"
import Hf from "./Hf.ts"
import Ta from "./Ta.ts"
import W from "./W.ts"
import Re from "./Re.ts"
import Os from "./Os.ts"
import Ir from "./Ir.ts"
import Pt from "./Pt.ts"
import Au from "./Au.ts"
import Hg from "./Hg.ts"
import Tl from "./Tl.ts"
import Pb from "./Pb.ts"
import Bi from "./Bi.ts"
import Po from "./Po.ts"
import At from "./At.ts"
import Rn from "./Rn.ts"
import Fr from "./Fr.ts"
import Ra from "./Ra.ts"
import Ac from "./Ac.ts"
import Th from "./Th.ts"
import Pa from "./Pa.ts"
import U from "./U.ts"
import Np from "./Np.ts"
import Pu from "./Pu.ts"
import Am from "./Am.ts"
import Cm from "./Cm.ts"
import Bk from "./Bk.ts"
import Cf from "./Cf.ts"
import Es from "./Es.ts"
import Fm from "./Fm.ts"
import Md from "./Md.ts"
import No from "./No.ts"
import Lr from "./Lr.ts"
import Rf from "./Rf.ts"
import Db from "./Db.ts"
import Sg from "./Sg.ts"
import Bh from "./Bh.ts"
import Hs from "./Hs.ts"
import Mt from "./Mt.ts"
import Ds from "./Ds.ts"
import Rg from "./Rg.ts"
import Cn from "./Cn.ts"
import Nh from "./Nh.ts"
import Fl from "./Fl.ts"
import Mc from "./Mc.ts"
import Lv from "./Lv.ts"
import Ts from "./Ts.ts"
import Og from "./Og.ts"

export type { ElementCategory, ElementRecord } from "./record.ts"

export const ELEMENTS: readonly ElementRecord[] = [H, He, Li, Be, B, C, N, O, F, Ne, Na, Mg, Al, Si, P, S, Cl, Ar, K, Ca, Sc, Ti, V, Cr, Mn, Fe, Co, Ni, Cu, Zn, Ga, Ge, As, Se, Br, Kr, Rb, Sr, Y, Zr, Nb, Mo, Tc, Ru, Rh, Pd, Ag, Cd, In, Sn, Sb, Te, I, Xe, Cs, Ba, La, Ce, Pr, Nd, Pm, Sm, Eu, Gd, Tb, Dy, Ho, Er, Tm, Yb, Lu, Hf, Ta, W, Re, Os, Ir, Pt, Au, Hg, Tl, Pb, Bi, Po, At, Rn, Fr, Ra, Ac, Th, Pa, U, Np, Pu, Am, Cm, Bk, Cf, Es, Fm, Md, No, Lr, Rf, Db, Sg, Bh, Hs, Mt, Ds, Rg, Cn, Nh, Fl, Mc, Lv, Ts, Og]

const bySymbol = new Map(ELEMENTS.map((element) => [element.symbol, element]))
const byNumber = new Map(ELEMENTS.map((element) => [element.z, element]))
const byCell = new Map(ELEMENTS.map((element) => [`${element.col}:${element.row}`, element]))

export function elementOf(symbol: string): ElementRecord | undefined {
  return bySymbol.get(symbol)
}

export function elementByNumber(z: number): ElementRecord | undefined {
  return byNumber.get(z)
}

export function elementAt(col: number, row: number): ElementRecord | undefined {
  return byCell.get(`${col}:${row}`)
}

export function elementMass(symbol: string): number {
  return elementOf(symbol)?.mass ?? 0
}

export function elementColor(symbol: string, enabled: boolean): string {
  if (!enabled) return "#222222"
  return elementOf(symbol)?.color ?? "#222222"
}

export function paletteElements(): ElementRecord[] {
  return ELEMENTS.filter((element) => element.palette != null).sort(
    (a, b) => (a.palette ?? 0) - (b.palette ?? 0),
  )
}

export function shortcutToElement(key: string): string | undefined {
  const found = ELEMENTS.find((element) => element.shortcut === key.toLowerCase())
  return found?.symbol
}
