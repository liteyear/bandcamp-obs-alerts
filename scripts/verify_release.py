#!/usr/bin/env python3
"""Verify artifact content, executable mode, privacy exclusions, and checksums."""
import hashlib
import json
import re
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'package.json').read_text())['version']
dist = ROOT / 'dist'
for flavor in ['mac', 'source']:
    target = dist / f'bandcamp-obs-alerts-{flavor}-v{version}.zip'
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert 'bandcamp-obs-alerts/LICENSE' in names
        assert 'bandcamp-obs-alerts/docs/preview.png' in names
        launcher = archive.getinfo('bandcamp-obs-alerts/Start Bandcamp Alerts.command')
        assert launcher.external_attr >> 16 & 0o111, 'Launcher is not executable'
        for name in names:
            assert name.startswith('bandcamp-obs-alerts/') and '..' not in Path(name).parts
            assert not any(part in {'.git', 'runtime', 'dist', 'launch-lock', '__pycache__'} for part in Path(name).parts)
            assert Path(name).name not in {'settings.json', 'seen.json', 'control-url.txt', 'helper.log', '.env'}
            assert not name.endswith(('.eml', '.mbox', '.log'))
            if '/node_modules/' not in name and name.endswith(('.cjs', '.js', '.html', '.md', '.json', '.command', '.py')):
                data = archive.read(name).lower()
                assert not re.search(rb'[a-z0-9._%+-]+@gmail\.com', data), f'Personal Gmail address in {name}'
        if flavor == 'source':
            assert not any('/node_modules/' in name for name in names)
            assert 'bandcamp-obs-alerts/.github/workflows/ci.yml' in names
        else:
            assert 'bandcamp-obs-alerts/node_modules/imapflow/package.json' in names
            assert 'bandcamp-obs-alerts/node_modules/mailparser/package.json' in names

for line in (dist / 'SHA256SUMS.txt').read_text().splitlines():
    digest, filename = line.split('  ', 1)
    assert hashlib.sha256((dist / filename).read_bytes()).hexdigest() == digest
print('Verified both ZIPs, dependency / source separation, executable launcher, privacy exclusions, and checksums.')
