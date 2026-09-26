"""Regenerates src/chem/fixtures/rdkit-hydrogens.json, the reference for formula.ts.

For each element, formal charge and sum of bond orders, builds the atom with that many
single bonds to carbon and records how many implicit hydrogens RDKit gives it, or null
when RDKit rejects the valence.

    python3 -m venv .venv && .venv/bin/pip install rdkit
    .venv/bin/python scripts/rdkit-hydrogens.py > src/chem/fixtures/rdkit-hydrogens.json
"""
import json
import rdkit
from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
ELEMENTS = ["B", "C", "N", "O", "F", "Si", "P", "S", "Cl", "As", "Se", "Br", "Te", "I"]

cases = []
for el in ELEMENTS:
    for charge in range(-2, 3):
        for bonds in range(0, 8):
            mol = Chem.RWMol()
            center = mol.AddAtom(Chem.Atom(el))
            mol.GetAtomWithIdx(center).SetFormalCharge(charge)
            for _ in range(bonds):
                mol.AddBond(center, mol.AddAtom(Chem.Atom("C")), Chem.BondType.SINGLE)
            ok = Chem.SanitizeMol(mol, catchErrors=True) == Chem.SanitizeFlags.SANITIZE_NONE
            h = mol.GetAtomWithIdx(center).GetTotalNumHs() if ok else None
            cases.append({"el": el, "charge": charge, "bonds": bonds, "h": h})

print(json.dumps({"rdkit": rdkit.__version__, "cases": cases}, indent=0).replace("{\n", "{").replace("\n}", "}").replace(",\n\"", ", \""))
