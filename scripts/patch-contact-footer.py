from pathlib import Path

SKIP={'.money-planner-backup'}
TAG='<script src="/assets/js/ians-contact.js" defer></script>'
count=0
for p in Path('.').rglob('*.html'):
    if any(part in SKIP for part in p.parts):
        continue
    text=p.read_text(encoding='utf-8')
    if 'ians-contact.js' in text or '</body>' not in text.lower():
        continue
    pos=text.lower().rfind('</body>')
    text=text[:pos]+TAG+'\n'+text[pos:]
    p.write_text(text,encoding='utf-8')
    count+=1
print(f'IANS contact footer injected into {count} HTML pages')
