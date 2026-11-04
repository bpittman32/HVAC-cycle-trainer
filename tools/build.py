"""Inline property tables and the engine into a single self-contained index.html."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
s = (root / 'src/app.html').read_text()
s = s.replace('/*PROPS*/', 'const PROPS = ' + (root / 'src/props.json').read_text() + ';')
s = s.replace('/*ENGINE*/', (root / 'src/engine.js').read_text())
s = s.replace('/*GLOSSARY*/', (root / 'src/glossary.js').read_text())
import datetime
version = (root / 'VERSION').read_text().strip()
s = s.replace('/*VERSION*/', version).replace('/*BUILD*/', datetime.date.today().isoformat())
(root / 'index.html').write_text(s)
print('wrote index.html', len(s), 'bytes')
