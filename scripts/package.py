"""Package extension contents at ZIP root so the extracted folder is loadable."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
version = json.loads((root/'extension/manifest.json').read_text())['version']
(root/'dist').mkdir(exist_ok=True)
for name in [f'study-capture-extension-{version}.zip', 'study-capture-extension.zip']:
    with ZipFile(root/'dist'/name, 'w', ZIP_DEFLATED) as archive:
        for path in sorted((root/'extension').rglob('*')):
            if path.is_file(): archive.write(path, path.relative_to(root/'extension'))
        archive.write(root/'README.md', 'README.md')
    with ZipFile(root/'dist'/name) as archive:
        assert 'manifest.json' in archive.namelist()
        manifest = json.loads(archive.read('manifest.json'))
        for path in [manifest['background']['service_worker'], manifest['side_panel']['default_path']]:
            assert path in archive.namelist()
    print(name)
