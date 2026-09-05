from pathlib import Path
p=Path('academy/index.html')
if not p.exists():
    raise SystemExit('academy/index.html not found')
s=p.read_text()
if '/academy/kids/' not in s:
    marker='</body>'
    block='''<div style="position:fixed;right:18px;bottom:18px;z-index:9999"><a href="/academy/kids/" style="display:block;padding:12px 16px;border-radius:12px;background:#168cff;color:#fff;text-decoration:none;font:800 14px system-ui;box-shadow:0 10px 35px #0008">🚀 Academy Kids</a></div>'''
    s=s.replace(marker,block+marker)
p.write_text(s)
print('Academy Kids link ready')
