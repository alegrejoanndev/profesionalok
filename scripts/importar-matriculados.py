#!/usr/bin/env python3
"""
Actualiza la base de matriculados (data/matriculados.json) a partir del Excel del Colegio de Psicólogos de Santa Fe.

Uso:   python3 scripts/importar-matriculados.py ruta/al/psicologos_matriculados.xlsx
El Excel debe tener una hoja "Matriculados" con las columnas: Mat. Nº | Apellido y Nombres | Localidad.
Después de actualizar el archivo, subí los cambios (git) y volvé a publicar el sitio.
"""
import json, sys
from pathlib import Path
import openpyxl

if len(sys.argv) != 2:
    sys.exit(__doc__)
ws = openpyxl.load_workbook(sys.argv[1], read_only=True)['Matriculados']
rows, seen = [], set()
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[0] is None or not r[1]:
        continue
    num = str(r[0]).strip()
    if num in seen:
        continue
    seen.add(num)
    rows.append([num, ' '.join(str(r[1]).split()), ' '.join(str(r[2] or '').split())])
out = Path(__file__).resolve().parent.parent / 'data' / 'matriculados.json'
out.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(rows)} matriculados guardados en {out}')
