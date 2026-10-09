#!/usr/bin/env python3
"""Build public assets from explicit file allowlists; never package local state."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
BASE_FILES = ['server.cjs', 'receipt.cjs', 'package.json', 'package-lock.json',
              'Start Bandcamp Alerts.command', 'README.md', 'LICENSE', 'NOTICE.md',
              'SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'RELEASING.md']
EXCLUDED = {'settings.json', 'seen.json', 'control-url.txt', 'helper.log', '.DS_Store', '.env'}

def collect(files, directories):
    selected = [ROOT / name for name in files]
    for name in directories:
        selected.extend(p for p in (ROOT / name).rglob('*') if p.is_file())
    result = []
    for p in sorted(set(selected)):
        if not p.is_file():
            raise RuntimeError(f'Required release file missing: {p.relative_to(ROOT)}')
        relative = p.relative_to(ROOT)
        if p.is_symlink() or any(part in {'__pycache__', '.git', 'dist', 'runtime', 'launch-lock'} for part in relative.parts):
            continue
        if p.name in EXCLUDED or p.name.startswith('.env.') or p.suffix in {'.log', '.pyc', '.eml', '.mbox'}:
            continue
        result.append(p)
    return result

def archive(filename, selected):
    with zipfile.ZipFile(DIST / filename, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for p in selected:
            relative = p.relative_to(ROOT)
            entry = zipfile.ZipInfo('bandcamp-obs-alerts/' + relative.as_posix(), (2026, 1, 1, 0, 0, 0))
            entry.create_system = 3
            mode = 0o755 if p.name.endswith('.command') else 0o644
            entry.external_attr = (0o100000 | mode) << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            output.writestr(entry, p.read_bytes(), compresslevel=9)

def main():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if not (ROOT / 'node_modules/imapflow/package.json').is_file():
        raise RuntimeError('Run npm ci --ignore-scripts before building the installer.')
    DIST.mkdir(exist_ok=True)
    names = [f'bandcamp-obs-alerts-mac-v{version}.zip', f'bandcamp-obs-alerts-source-v{version}.zip']
    archive(names[0], collect(BASE_FILES, ['web', 'docs', 'node_modules']))
    archive(names[1], collect(BASE_FILES + ['.gitignore', '.nvmrc'], ['web', 'docs', 'test', 'scripts', '.github']))
    sums = '\n'.join(hashlib.sha256((DIST / name).read_bytes()).hexdigest() + '  ' + name for name in names) + '\n'
    (DIST / 'SHA256SUMS.txt').write_text(sums)
    print('\n'.join(str(DIST / name) for name in names))

if __name__ == '__main__':
    main()
