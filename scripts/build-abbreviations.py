"""Builds src/chem/templates/abbreviations.ts from data/abbreviations.json.

Each abbreviation's SMILES marks attachment points with [*:1], [*:2]. RDKit parses it,
checks the group formula, kekulizes it and lays it out in 2D, so the editor never has to
parse SMILES at run time. Coordinates are in editor pixels (one bond = 40 px, y down),
with the anchor at the origin and the [*:1] bond pointing left, along -x. Each group is
scaled so its median bond is one editor bond.

Sugars and dative ligands are left out until the editor supports them.

    .venv/bin/python scripts/build-abbreviations.py > src/chem/templates/abbreviations.ts
"""
import json
import math
import sys
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import rdDepictor, rdMolDescriptors

BOND_PX = 40.0
root = Path(__file__).resolve().parent.parent
entries = json.loads((root / "data" / "abbreviations.json").read_text())


def hill(formula_counts):
    keys = sorted(formula_counts, key=lambda el: (el != "C", el != "H", el) if "C" in formula_counts else el)
    return "".join(el + (str(n) if n > 1 else "") for el, n in ((k, formula_counts[k]) for k in keys))


def group_formula(mol):
    counts = {}
    for atom in mol.GetAtoms():
        if atom.GetAtomicNum() == 0:
            continue
        counts[atom.GetSymbol()] = counts.get(atom.GetSymbol(), 0) + 1
        hs = atom.GetTotalNumHs()
        if hs:
            counts["H"] = counts.get("H", 0) + hs
    charge = sum(atom.GetFormalCharge() for atom in mol.GetAtoms())
    suffix = "" if charge == 0 else ("+" if charge > 0 else "-") + (str(abs(charge)) if abs(charge) > 1 else "")
    return hill(counts) + suffix


def bond_lengths(mol):
    conf = mol.GetConformer()
    return sorted(
        (conf.GetAtomPosition(b.GetBeginAtomIdx()) - conf.GetAtomPosition(b.GetEndAtomIdx())).Length()
        for b in mol.GetBonds()
    )


def depict(smiles):
    """Lays the group out with CoordGen and with RDKit's own depictor and keeps whichever
    has the most even bond lengths. Returns the molecule and the median bond length."""
    best = None
    for coordgen in (True, False):
        mol = Chem.MolFromSmiles(smiles)
        rdDepictor.SetPreferCoordGen(coordgen)
        rdDepictor.Compute2DCoords(mol)
        lengths = bond_lengths(mol)
        median = lengths[len(lengths) // 2] if lengths else 1.5
        spread = max((abs(length / median - 1) for length in lengths), default=0)
        if best is None or spread < best[0]:
            best = (spread, mol, median)
    return best[1], best[2]


def build(entry):
    mol, median = depict(entry["smiles"])
    Chem.Kekulize(mol, clearAromaticFlags=True)
    conf = mol.GetConformer()
    dummies = {a.GetAtomMapNum(): a for a in mol.GetAtoms() if a.GetAtomicNum() == 0}
    anchors = {n: d.GetNeighbors()[0].GetIdx() for n, d in dummies.items()}
    if len(set(anchors.values())) != 1:
        return None, "attachment points on different atoms"
    anchor = anchors[1]
    if group_formula(mol) != entry["formula"]:
        raise SystemExit(f"{entry['label']}: formula {group_formula(mol)} != {entry['formula']}")

    ax, ay = conf.GetAtomPosition(anchor).x, conf.GetAtomPosition(anchor).y
    dx, dy = conf.GetAtomPosition(dummies[1].GetIdx()).x - ax, conf.GetAtomPosition(dummies[1].GetIdx()).y - ay
    # Rotate so the first attachment bond points along -x, then flip y for screen space.
    turn = math.pi - math.atan2(dy, dx)
    cos, sin = math.cos(turn), math.sin(turn)
    scale = BOND_PX / median
    keep = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() != 0]
    order = [anchor] + [i for i in keep if i != anchor]
    index = {old: new for new, old in enumerate(order)}
    atoms = []
    for i in order:
        atom = mol.GetAtomWithIdx(i)
        p = conf.GetAtomPosition(i)
        x, y = p.x - ax, p.y - ay
        rx, ry = x * cos - y * sin, x * sin + y * cos
        item = {"el": atom.GetSymbol(), "x": round(rx * scale, 2), "y": round(-ry * scale, 2)}
        if atom.GetFormalCharge():
            item["charge"] = atom.GetFormalCharge()
        if atom.GetIsotope():
            item["isotope"] = atom.GetIsotope()
        atoms.append(item)
    bonds = []
    for bond in mol.GetBonds():
        a, b = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        if a not in index or b not in index:
            continue
        kind = bond.GetBondType()
        order_ = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3}.get(kind)
        if order_ is None:
            raise SystemExit(f"{entry['label']}: unsupported bond {kind}")
        bonds.append([index[a], index[b], order_])
    if any(atom.GetChiralTag() != Chem.ChiralType.CHI_UNSPECIFIED for atom in mol.GetAtoms()):
        return None, "stereocentres need wedges"
    template = {
        "label": entry["label"],
        "synonyms": [s for s in entry["synonyms"] if s != entry["label"]],
        "attachments": entry["attachments"],
        "formula": entry["formula"],
        "atoms": atoms,
        "bonds": bonds,
    }
    if entry.get("labelLeft"):
        template["labelLeft"] = entry["labelLeft"]
    return template, None


templates, skipped = [], []
for entry in entries:
    if entry["category"] == "sugar" or "<-" in entry["smiles"]:
        skipped.append((entry["label"], "not supported yet"))
        continue
    template, reason = build(entry)
    if template:
        templates.append(template)
    else:
        skipped.append((entry["label"], reason))

print(f"{len(templates)} templates, {len(skipped)} skipped", file=sys.stderr)
for label, reason in skipped:
    print(f"  skipped {label}: {reason}", file=sys.stderr)

print("// Generated by scripts/build-abbreviations.py from data/abbreviations.json. Do not edit.")
print('import type { GroupTemplate } from "../templates.ts"')
print()
print("export const ABBREVIATIONS: GroupTemplate[] = [")
for t in templates:
    print("  " + json.dumps(t, ensure_ascii=False, separators=(", ", ": ")) + ",")
print("]")
