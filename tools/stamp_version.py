#!/usr/bin/env python3
"""Adds ?v=<stamp> to every local JS/CSS reference so browsers (and iPads)
always load the newest files after an update instead of a cached copy.
Run before committing:  python3 tools/stamp_version.py"""
import re, pathlib, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
V = time.strftime('%Y%m%d%H%M%S')
js_import = re.compile(r"""((?:from|import)\s*\(?\s*['"])(\.{1,2}/[^'"?]+\.(?:js|css))(?:\?v=\w+)?(['"])""")
html_ref = re.compile(r"""((?:src|href)=["'])((?!https?:|//|data:|#)[^"'?]+\.(?:js|css))(?:\?v=\w+)?(["'])""")
n = 0
for p in ROOT.rglob('*'):
    if p.is_dir() or any(part in ('.git', 'node_modules', 'tools') for part in p.relative_to(ROOT).parts): continue
    if p.suffix not in ('.js', '.html'): continue
    s = p.read_text(encoding='utf-8')
    rx = js_import if p.suffix == '.js' else html_ref
    t = rx.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={V}{m.group(3)}", s)
    if p.suffix == '.html':  # inline <script type=module> imports too
        t = js_import.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={V}{m.group(3)}", t)
    if t != s: p.write_text(t, encoding='utf-8'); n += 1
print(f'stamped {n} files with v={V}')
