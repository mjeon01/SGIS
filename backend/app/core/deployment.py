"""Unpack the curated deployment snapshot into an instance-local writable cache."""
from pathlib import Path
from tempfile import mkdtemp
from zipfile import ZipFile


def unpack_snapshot(archive: Path) -> Path:
    if not archive.is_file():
        raise RuntimeError('Deployment snapshot missing: run scripts/package_snapshot.py before deploying.')
    root = Path(mkdtemp(prefix='sgis-data-')).resolve()
    with ZipFile(archive) as snapshot:
        for member in snapshot.infolist():
            if not (root / member.filename).resolve().is_relative_to(root):
                raise ValueError('Invalid snapshot path')
        snapshot.extractall(root)
    return root
