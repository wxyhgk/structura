"""Regenerates src/chem/fixtures/rdkit-molecules.sdf and rdkit-molecules.json.

The SDF is written by RDKit, the way files arrive from other tools; the JSON records how
RDKit itself reads each record, so sdf.test.ts can check our reader against it.

    .venv/bin/python scripts/rdkit-sdf-fixture.py
"""
import json
from pathlib import Path

import rdkit
from rdkit import Chem
from rdkit.Chem import AllChem, rdDepictor, rdMolDescriptors

root = Path(__file__).resolve().parent.parent / "src" / "chem" / "fixtures"

# name, SMILES, how to write it
MOLECULES = [
    ("aspirin", "CC(=O)Oc1ccccc1C(=O)O", "2d"),
    ("caffeine", "Cn1cnc2c1c(=O)n(C)c(=O)n2C", "2d"),
    ("(S)-ibuprofen", "CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O", "2d"),
    ("sodium acetate", "[Na+].CC(=O)[O-]", "2d"),
    ("N-methylpyridinium chloride", "C[n+]1ccccc1.[Cl-]", "2d"),
    ("ammonium tetrafluoroborate", "F[B-](F)(F)F.[NH4+]", "2d"),
    ("labelled methane", "[2H][13CH3]", "2d"),
    ("DABNA-1", "c1ccc(cc1)N1c2ccccc2B2c3ccccc3N(c3ccccc3)c3cccc1c23", "2d"),
    ("aromatic bonds: pyridine, pyrrole, imidazole", "c1ccncc1.c1cc[nH]c1.c1c[nH]cn1", "aromatic"),
    ("methanol with hydrogens drawn", "CO", "explicit-h"),
    ("ethanol in 3D", "CCO", "3d"),
]

sdf = []
expected = []
for name, smiles, mode in MOLECULES:
    mol = Chem.MolFromSmiles(smiles)
    if mode == "explicit-h":
        mol = Chem.AddHs(mol)
    if mode == "aromatic":
        # Aromatic bond types lose which ring N carries the H (pyrrole vs pyridine), so
        # files written this way draw that H out; without it even RDKit cannot read them.
        nh = [a.GetIdx() for a in mol.GetAtoms() if a.GetIsAromatic() and a.GetSymbol() == "N" and a.GetTotalNumHs()]
        if nh:  # an empty onlyOnAtoms would add every hydrogen
            mol = Chem.AddHs(mol, onlyOnAtoms=tuple(nh))
    if mode == "3d":
        mol = Chem.AddHs(mol)
        AllChem.EmbedMolecule(mol, randomSeed=7)
        mol = Chem.RemoveHs(mol)
    else:
        rdDepictor.SetPreferCoordGen(True)
        rdDepictor.Compute2DCoords(mol)
    mol.SetProp("_Name", name)
    mol.SetProp("smiles", smiles)
    block = Chem.MolToMolBlock(mol, kekulize=(mode != "aromatic"))
    props = f"> <smiles>\n{smiles}\n\n> <source>\nRDKit {rdkit.__version__}\n\n"
    sdf.append(block + props + "$$$$\n")
    back = Chem.MolFromMolBlock(block, removeHs=False)
    expected.append({
        "name": name,
        "atoms": back.GetNumAtoms(),
        "bonds": back.GetNumBonds(),
        "formula": rdMolDescriptors.CalcMolFormula(back),
        "charge": Chem.GetFormalCharge(back),
        "isotopes": sorted(a.GetIsotope() for a in back.GetAtoms() if a.GetIsotope()),
        "smiles": Chem.MolToSmiles(back),
        "mode": mode,
    })

(root / "rdkit-molecules.sdf").write_text("".join(sdf))
(root / "rdkit-molecules.json").write_text(json.dumps({"rdkit": rdkit.__version__, "records": expected}, indent=1) + "\n")
print(f"wrote {len(expected)} records")

# Aromatic bond types (type 4) for rings whose kekulization depends on charges.
AROMATIC = [
    ("N-methylpyridinium", "C[n+]1ccccc1"),
    ("pyrylium", "c1cc[o+]cc1"),
    ("pyridine N-oxide", "[O-][n+]1ccccc1"),
    ("thiopyrylium", "c1cc[s+]cc1"),
    ("tropylium", "c1cc[cH+]ccc1"),
    ("cyclopentadienide", "[cH-]1cccc1"),
    ("thiophene", "c1ccsc1"),
    ("furan", "c1ccoc1"),
    ("N-methylpyrrole", "Cn1cccc1"),
    ("pyridine", "c1ccncc1"),
    ("indole", "c1ccc2[nH]ccc2c1"),
    ("quinolinium", "C[n+]1cccc2ccccc21"),
]
aromatic_sdf, aromatic_expected = [], []
for name, smiles in AROMATIC:
    mol = Chem.MolFromSmiles(smiles)
    nh = [a.GetIdx() for a in mol.GetAtoms() if a.GetIsAromatic() and a.GetSymbol() == "N" and a.GetTotalNumHs()]
    if nh:  # an empty onlyOnAtoms would add every hydrogen
        mol = Chem.AddHs(mol, onlyOnAtoms=tuple(nh))
    rdDepictor.Compute2DCoords(mol)
    mol.SetProp("_Name", name)
    block = Chem.MolToMolBlock(mol, kekulize=False)
    back = Chem.MolFromMolBlock(block, removeHs=False)
    if back is None:
        print(f"skipped {name}: RDKit cannot read its own aromatic molblock")
        continue
    aromatic_sdf.append(block + "$$$$\n")
    aromatic_expected.append({"name": name, "formula": rdMolDescriptors.CalcMolFormula(back), "smiles": Chem.MolToSmiles(back)})
(root / "rdkit-aromatic.sdf").write_text("".join(aromatic_sdf))
(root / "rdkit-aromatic.json").write_text(json.dumps({"rdkit": rdkit.__version__, "records": aromatic_expected}, indent=1) + "\n")
print(f"wrote {len(aromatic_expected)} aromatic records")
