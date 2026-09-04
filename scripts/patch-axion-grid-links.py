from pathlib import Path

OLD = "https://axion-grid.admhenber.chatgpt.site"
NEW = "https://zealous-pond-02b149c10.7.azurestaticapps.net/"

changed = []
for path in Path('.').rglob('*.html'):
    if any(part.startswith('.') for part in path.parts):
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    if OLD not in text:
        continue
    path.write_text(text.replace(OLD, NEW), encoding='utf-8')
    changed.append(str(path))

print(f"Axion Grid links updated: {len(changed)}")
for path in changed:
    print(f" - {path}")
