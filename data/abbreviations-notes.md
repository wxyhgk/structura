# Abbreviation table: collisions, conflicts, exclusions

> In this repository only `data/abbreviations.json` and this note are kept. The downloaded
> source tables and `verify.py` mentioned below stayed with the original research run.
> `scripts/build-abbreviations.py` re-checks every formula with RDKit and generates
> `src/chem/templates/abbreviations.ts`.

Generated alongside `abbreviations.json` (287 entries). Every entry passes `verify.py`: the SMILES parses, the dummy atoms are numbered 1..n, and n equals `attachments`. The group formula (dummies removed, and the attachment atom does **not** get an extra H) matches the expected Hill formula. The 24 amino-acid residues and 7 sugars also have their stereo and tautomer checked: each is capped (H/OH) and compared with PubChem's isomeric SMILES (`pubchem_refs.csv`).

Source files, kept in this directory so the check can be re-run:

| key | what | file |
|---|---|---|
| `rdkit` | RDKit 2025.09 `rdAbbreviations.GetDefaultAbbreviations()` / `GetDefaultLinkers()` | read at runtime |
| `ketcher` | Ketcher "Functional Groups" templates (epam/ketcher, `packages/ketcher-react/src/templates/fg.sdf`) | `ketcher-fg.sdf` |
| `openbabel` | Open Babel `data/superatom.txt` (from OSRA) | `obabel-superatom.txt` |
| `marvin` | ChemAxon Marvin `default.abbrevgroup` (Marvin JS 6.x) | `marvin-zoranstefanic.abbrevgroup` |
| `structura-code` | `src/chem/formula.ts` ALIAS_FORMULA (formula-only check) + `hotkeys/atoms.ts` nick() | - |
| `chemdraw-hotkeys` | `data/ChemDraw快捷键表.xlsx` rows that insert a group | - |
| `greene` / `literature` | definition checked against Greene's *Protective Groups*, IUPAC/ACS usage | - |

`marvin_names.json` holds the 811 names (plus left-hand forms) from the current Marvin JS docs page. That page shows structures only as images, so it was used for names only. ChemDraw's own nickname file is not public, and ChemDraw › File › List Nicknames is the only authoritative list. The hotkey sheet is the only ChemDraw data used here.

---

## 1. Element-symbol collisions (case-sensitive)

### In our table

| text | our meaning | role in table | element |
|---|---|---|---|
| `Ac` | acetyl | label | actinium (89) |
| `Ts` | tosyl | label | tennessine (117) |
| `Pr` | n-propyl | synonym of `nPr` | praseodymium (59) |

### Deliberately NOT used as synonyms, because they collide

| text | usual meaning | element | used by |
|---|---|---|---|
| `Am` | n-amyl (pentyl) | americium | Marvin |
| `Ce` | 2-cyanoethyl | cerium | Marvin. We use `CE` instead. |
| `Np` | p-nitrophenyl (Marvin), neopentyl (lit.) | neptunium | Marvin |
| `Th` | thienyl | thorium | literature |
| `Ar` | aryl placeholder | argon | everyone (placeholder, see §4) |
| `D`, `T` | deuterium, tritium | isotopes | Open Babel. Structura already handles these through `Atom.isotope`. |
| `Pm`, `Bi`, `Cs`, `Tl`, `Ps` | none in common use as nicknames | - | - |

Near-misses that differ only in case: `CO`/Co, `NO`/No, `CS`/Cs, `SI`/Si, `BOC`, `PO`/Po. Label lookup must stay case-sensitive, or `CO` (carbonyl linker) and `NO` (nitroso) will turn into metals.

### Suggested policy

1. **Group first for a small allowlist: `Ac`, `Ts`, `Pr`.** Actinium, tennessine and praseodymium almost never appear in organic drawings, while acetyl, tosyl and propyl appear constantly. ChemDraw's own nickname list (to our knowledge; unverified here, since the list is not public) resolves "Ac" to acetyl. Only these three labels are in the allowlist. Do not add Am, Ce, Np or Th as group names at all.
2. **Keep an explicit escape to get the element.** Picking it from the periodic-table dialog, or typing it in brackets (`[Ac]`, SMILES style), always gives the element.
3. **Save the resolved choice in the document.** Store it as a Group reference or as `el`, and never re-parse the label text on load. That way files round-trip whatever the allowlist becomes later.
4. **All other labels**: element lookup first, then the group table. Since no other label or synonym equals an element symbol, the order does not matter for them.

---

## 2. Name clashes inside our own table

These are left-hand forms that read identically to another group's right-hand label. Text alone cannot tell them apart:

| typed text | as a label | as another group's `labelLeft` |
|---|---|---|
| `CN` | cyano `-C≡N` | isocyano (`NC`) drawn to the left |
| `NC` | isocyano `-N⁺≡C⁻` | cyano drawn to the left |
| `NCO` | isocyanate `-N=C=O` | cyanate (`OCN`) drawn to the left |
| `OCN` | cyanate `-O-C≡N` | isocyanate drawn to the left |
| `NCS` | isothiocyanate | thiocyanate (`SCN`) drawn to the left |
| `SCN` | thiocyanate | isothiocyanate drawn to the left |

**Rule:** when the user types a label, look it up in `label` and `synonyms` only, never in `labelLeft`. `labelLeft` is output-only (rendering), and the group keeps its identity when it flips side. RDKit, Marvin, Ketcher and Open Babel all use these same left forms.

Intentional structure duplicates (same SMILES, different label and intent): `Cbz` = `CO2Bn`, `Boc` = `CO2tBu`, `Ms` = `SO2Me`. Keep them as separate entries, because the label is what the user wants to see.

---

## 3. Cross-source conflicts (same name, different structure)

Only real disagreements are listed. The full list is in `verify_report.json → conflicts`.

| name | source | their structure | ours | recommendation |
|---|---|---|---|---|
| `iBu` | RDKit | `*C(C)CC` = **sec-butyl** | isobutyl `*CH2CH(CH3)2` | RDKit bug. Ketcher, Marvin, Open Babel and IUPAC all say isobutyl. Keep ours. |
| `iPent` | RDKit | `*C(C)CCC` = 2-pentyl | not adopted | RDKit bug. Isopentyl is `iAm`. Leave `iPent` out, or map it to `iAm` once the bug is reported. |
| `NMe` | RDKit, Open Babel | monovalent NH-CH3 | **divalent** N-CH3 (ring N-Me) | In drawings, "NMe" is almost always a ring or chain N with two bonds. Monovalent is `NHMe`. |
| `Hept`/`Oct`/`Non`/`Dec` | RDKit linkers | divalent -(CH2)n- | monovalent alkyl synonyms | Resolve by bond count if linkers are ever added. Not adopted as linkers. |
| `Mes` | Ketcher | 3-methylbenzyl (template bug) | 2,4,6-trimethylphenyl | Ketcher bug. Keep ours. |
| `SO2` | Ketcher | monovalent `*[SH](=O)=O` (hypervalent S-H) | divalent sulfonyl `-SO2-` | The ChemDraw hotkey `k` inserts divalent -SO2-. Keep ours. |
| `TBDPS` | Ketcher | 5-valent Si, isopropyl instead of tBu | tBuPh2Si- | Ketcher bug. |
| `DTBS` | Marvin | tBu2Si(CH2-)2 | tBu2Si< (directly O-bound) | Marvin bug. Di-tert-butylsilylene bonds to O directly. |
| `Asp`, `Glu` | Marvin | invalid valence (attachment on side-chain C=O carbon) | L-residue, free side chain | Marvin data error. |
| `Arg`, `His` | Marvin | other tautomer, plus a third attachment on the side-chain N | PubChem tautomer, 2 attachments | Convention difference, not an error. |
| `Ser`, `Thr`, `Cys`, `Tyr`, `Lys`, `Trp`, `Asn`, `Gln` | Marvin | extra 3rd attachment on the side chain | 2 attachments | Same residue. Counted as agreement. Marvin lets side chains carry protecting groups. |
| `OBz` / `BzO` | Open Babel | benzyl**oxy** | benzoyloxy | Open Babel bug. Bz = benzoyl. |
| `OMs` / `MsO` | Open Babel | `*CH2-SO3H` | `*O-SO2CH3` | Open Babel bug. |
| `Alloc` / `AOC` | Open Babel | vinyloxycarbonyl (that is Voc) | allyloxycarbonyl | Open Babel bug. |
| `t-Bu` / `t-Butyl` | Open Babel | isobutyl | tert-butyl | Open Babel bug. |
| `n-Oct`, `nOctyl`, `n-Octyl` | Open Babel | propyl | octyl | Open Babel bug. |
| `EE` | Open Babel | 2-ethoxyethyl | 1-ethoxyethyl | Open Babel bug. EE is the acetal PG. |
| `NHOH` | Open Babel (one of two rows) | attached through O | attached through N | Open Babel bug. |
| `Dip` | Open Babel | 2,6-diisopropylphenoxy | 2,6-diisopropylphenyl (`Dipp`) | Different meaning. `Dip` stays a synonym of Dipp, following Marvin. |
| `SEM`, `CONMe2`, `CONEt2`, `NEt3`, `Nitro`, `NO2` (pentavalent) | Open Babel | invalid SMILES | - | Open Babel data errors. |
| `MPM` | Marvin | unparsable SMILES | = PMB | Kept as a synonym of PMB. |
| `TFA` | Marvin | trifluoroacetyl | not a synonym | TFA almost always means the acid or solvent. The acyl group is `Tfa`. |
| `Ce`, `Np`, `Am`, `Pr` | Marvin | cyanoethyl, p-nitrophenyl, amyl, propyl | see §1 | Element collisions. |
| `THF` | Marvin | tetrahydrofuran-2-yl group | not adopted | Users typing THF mean the solvent. Use `THP` / draw the ring. |
| `PNB` | Marvin | p-nitrobenzoyl | not adopted | The literature mostly uses PNB for p-nitro**benzyl**. Ambiguous. |
| `Bz` | (usage) | some authors write Bz for benzyl | benzoyl | Follow IUPAC and Greene. Benzyl is `Bn` or `Bzl`. |
| `Ns` | (usage) | some authors mean 4-nitro | 2-nitrobenzenesulfonyl | `pNs` provided for the 4-isomer. |
| `DMB` | (usage) | 2,4- or 3,4-dimethoxybenzyl | 2,4- (`DMB`), 3,4- (`DMPM`) | Note shown in the UI. |
| `TPS` | (usage) | triphenylsilyl or 2,4,6-iPr3C6H2SO2 | label is `SiPh3`, TPS kept as a synonym | Consider dropping the TPS synonym. |
| `PEGn` | RDKit vs others | -(OCH2CH2)n- without a terminal O | RDKit definition | PEG unit counting varies between tools. Document it in the UI. |

`structura-code` (ALIAS_FORMULA) agrees on all 8 overlapping names (Me, CH3, Et, Ac, Ph, Boc, Cbz, Fmoc, CO2Me). The ChemDraw hotkey sheet agrees on all 19 group rows.

---

## 4. Excluded: cannot be a simple group with attachment points

**Placeholders / generic groups.** These belong to an R-group or Markush feature, not a Group template:

- `R`, `R1`…`Rn`, `R'`, `R''`, `X`, `Y`, `Z` (note: `Z` is also a Cbz synonym here, so the placeholder meaning needs a separate UI path), `Ar` (also argon), `Het`, `HetAr`, `Hal`, `Alk`, `Nu`, `E`, `El`, `L`, `Ln`, `M`, `LG`, `PG`, `EWG`, `EDG`.
- Open Babel's `OR`, `RO`, `CO2R`, `COOR`, `RO2C`, `ROOC`. These contain a nested placeholder.

**Ion pairs / salts.** These need two fragments:

- `CO2Na`, `CO2K`, `COONa`, `COOK`, `ONa`, `OK`, `OLi`, `SNa`, `SK`, `SLi` (Marvin); `BF3K`; ammonium or phosphonium salts with a counter-ion.
- Counter-ions on their own: `NBu4`, `NEt4`, `PF6`, `BF4`, `BArF`, `OTf⁻`, `TfO⁻`, `Cl⁻`. Draw these as separate charged fragments.
- The single-charge groups `CO2-`, `SO3-`, `NMe3+`, `N2+` and `PPh3+` are kept, because each is one fragment.

**Whole molecules (reagents / solvents).** No attachment point, so they are out of scope for Group. They could live in a separate "reagent label" or template library:

- Ketcher "Salts and Solvents": 135 molecules (acids, alcohols, ethers, esters, hydrocarbons, halocarbons, amines, inorganic salts, buffers such as TRIS).
- Marvin whole molecules (30): AcOH, AlCl3, Br2, Cl2, DMS, H2, H2O, H2O2, H2SO4, HNO2, HNO3, I2, KMnO4, KNO2, KNO3, Me3N, MnO2, NBS, NBu4, NEt4, NaNO2, NaNO3, O2, PBr3, PCl3, PF6, PI3, POBr3, POCl3, POI3.
- Reagent names in the newer Marvin JS name list: DMF, DMSO, DMAP, DCC, DIC, EDC(I), HATU, HBTU, HOBt, HOAt, PyBOP, COMU, Oxyma, DIAD, DEAD, DDQ, PCC, IBX, TEMPO, TBAF, NBS, NIS, AIBN, CDI, DPPA, HMPA, NMP, DCM, DCE, TFE, HFIP, MTBE, DME, DIPEA/DIEA, TEA, TFMSA, Pd(PPh3)4, PdCl2, and so on.

**Multidentate or η-bonded ligands.** One group with 1 or 2 attachment points cannot express chelation or hapticity:

- `COD`, `nbd`, `dba`, `acac`, `hfacac`, `bpy`/`bipy`, `dtbpy`, `phen`, `terpy`, `dppm`, `dppe`, `dppp`, `dppb`, `dppf` (ferrocene), `BINAP`, `Xantphos`, `DPEphos`, `TMEDA`, `en`, `salen`, `Tp`, `Tp*`, `pybox`, `box`, η6-arenes (`p-cymene`, `C6Me6`), NHCs `IMes`, `IPr`, `SIPr` (`IPr` also differs from `iPr` only in case).
- `Fc` (ferrocenyl) needs a sandwich representation.
- `Cp` and `Cp*` **are** included, but stored as σ-C5H5 / σ-C5Me5 (as Ketcher does). The η5 bonding is not captured.
- The monodentate L-ligands `PPh3`, `PCy3`, `PtBu3` and `PMe3` are included with a **dative** attachment bond (`[*:1]<-P...`). This needs dative-bond support in Structura. Drop them if that support is not planned.

**Polymers / repeat units:** `(CH2)n`, `PEG` with a variable n, `PS`, `PMMA`, and SRU brackets. These need a bracket or S-group feature. Fixed-length `PEG3`–`PEG6` (RDKit) are included as linkers.

**Formula-style alkyl labels:** `C3H7`…`C25H51`, Marvin's `C3`…`C25`, `c-C8H15`…`c-C25H49` and `ringN`. A generic "CnH2n+1 / c-CnH2n-1" parser handles these better than a table. The table keeps only the common ones (C2H5, C3H7, C4H9, C5H11, C6H13, C7H15, C8H17, C10H21, C12H25) as synonyms.

**Complex biomolecular labels, left out for scope:** nucleotides (`AMP`, `GMP`, `UMP`, `CMP`, `dA`, `dC`, `dG`, `dT`), `CoA`, dyes and fluorophores (`TAMRA`, `EDANS`, `AMCA`, `Dansyl` is kept), `Biotinyl`. There are also about 50 Marvin sugar variants: every aldose and ketose in α/β, pyranose and furanose, attached via the anomeric O. Only 7 common glycosyl groups are kept.

**Element-plus-H labels:** `OH`, `NH2`, `SH`, `SiH3`, `PH2`, `BH2`, `NH`, `CH2`, and `D`/`T` from the hotkey sheet. These are atoms with implicit or explicit H, which the existing element-label parser already handles. They are not groups.

**Ambiguous, left out rather than guessed:** `Xyl` (2,6- or 3,5-xylyl), `ArF` (3,5-(CF3)2C6H3 or C6F5), `Np`, `PNB`, `Tris`, `Pip` (piperidinyl or pipecolyl), `Pyr` (pyridyl, pyrrolyl or pyrrolidinyl), `Mor`, `Pht` as a monovalent label, `Ind` (indolyl or indenyl), `Hex` as cyclohexyl (we use Hex = n-hexyl), `Acyl`/`Ace` (generic in Open Babel), `Prop` (Marvin propyl, clashes with propargyl and propionyl).

---

## 5. Entries worth a human look

- **Naming choices**
  - `Tipp` (label), with `Trip` as a synonym.
  - `Thex`, `Biph`, `COiPr`, `Suc`, `CE`, `Nap`.
  - `iAm` as the canonical isopentyl label.
  - `nPr`/`nBu`/`nPent` as labels, with `Pr`/`Bu` as synonyms. ChemDraw displays plain `Pr`/`Bu`. If you want the display text to be "Pr" and "Bu", swap label and synonym. `Pr` then becomes an element-collision label (see the policy in §1).
- **labelLeft strings for acyl and P groups** are hand-chosen: `EtC(O)`, `iPrC(O)`, `(EtO)2P(O)`, `MeS(O)`, `H2O3PO`. Marvin uses `EtOC` or `(EtO)2OP`, which read like different groups. Formula-style synonyms such as `C2H5` or `CH3` have no own `labelLeft` (Marvin: `H5C2`, `H3C`). The renderer needs a per-synonym left form or a formula-reversal rule.
- **Sugars**: the anomer is fixed (β-Glc, β-Gal, α-Man, α-L-Fuc, β-GlcNAc, β-Rib, β-dRib), and they attach through the anomeric carbon. Marvin attaches them through the anomeric O. Decide which convention the product wants before shipping.
- **`CO` (divalent carbonyl) and `SO2` (divalent sulfonyl)**: the same text can mean carbon monoxide or sulfur dioxide. They work as groups only when the atom has two bonds.
- **Dative-ligand entries** (`PPh3`, `PCy3`, `PtBu3`, `PMe3`): see §4.
- **Unspecified stereocentres**: `sBu`, `EE` and `THP` carry an unspecified stereocentre. `Cinnamyl` is fixed as E.
- **2-attachment "NX" entries** (`NMe`, `NBn`, `NBoc`, `NTs`, `NCbz`, `NPh`, `NAc`): useful for ring nitrogens. If the Group feature matches a template by label and bond count, the monovalent versions (`NHMe`, `NHBoc`, …) cover the one-bond case.
