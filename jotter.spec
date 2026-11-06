# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

block_cipher = None

datas = []
# Bundle frontend static distribution if built
web_dist = Path('apps/web/dist')
jotter_dist = Path('src/jotter/dist')
if web_dist.is_dir() and (web_dist / 'index.html').is_file():
    datas.append(('apps/web/dist', 'jotter/dist'))
elif jotter_dist.is_dir() and (jotter_dist / 'index.html').is_file():
    datas.append(('src/jotter/dist', 'jotter/dist'))

icon_path = Path('docs/assets/icon.ico')
icon = str(icon_path) if icon_path.is_file() else None

a = Analysis(
    ['run.py'],
    pathex=['.', 'src'],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'anyio._backends._asyncio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='jotter-server',
    icon=icon,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
