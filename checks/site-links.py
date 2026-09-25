"""Check local HTML links/assets, srcset, CSS assets and inline JavaScript.
Run from the repository root: python3 checks/site-links.py
No network requests or production mutations.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote
import re
import subprocess
import tempfile

ROOT = Path.cwd()

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids, self.scripts = [], set(), []
        self.script = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag in ('a', 'link') and attrs.get('href'):
            self.refs.append((tag, attrs['href']))
        if tag in ('script', 'img', 'iframe', 'source') and attrs.get('src'):
            self.refs.append((tag, attrs['src']))
        if tag in ('source', 'img') and attrs.get('srcset'):
            self.refs.extend(('asset', x.strip().split()[0]) for x in attrs['srcset'].split(',') if x.strip())
        if tag == 'script' and not attrs.get('src') and attrs.get('type', '') in ('', 'module', 'text/javascript', 'application/javascript'):
            self.script = [attrs.get('type') == 'module', '']
    def handle_data(self, data):
        if self.script is not None:
            self.script[1] += data
    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.scripts.append(self.script)
            self.script = None

def included(path):
    return not any(part.startswith('.') or part in ('qa', 'node_modules') for part in path.parts)

pages = {}
for path in ROOT.rglob('*.html'):
    name = path.relative_to(ROOT)
    if included(name):
        page = Page()
        page.feed(path.read_text())
        pages[name.as_posix()] = page
errors = []
references = 0
for name, page in pages.items():
    for tag, ref in page.refs:
        if ref.startswith(('data:', 'mailto:', 'tel:', 'javascript:', 'blob:')):
            continue
        url = urlsplit(urljoin('https://www.ians.no/' + name, ref))
        if url.netloc not in ('www.ians.no', 'ians.no'):
            continue
        path = unquote(url.path).lstrip('/')
        if path.startswith(('.auth/', 'api/')):
            continue
        if not path or path.endswith('/'):
            path += 'index.html'
        target = ROOT / path
        if target.is_dir():
            path += '/index.html'
            target = ROOT / path
        references += 1
        if not target.is_file():
            errors.append(f'{name}: missing {ref}')
        elif tag == 'a' and url.fragment and path in pages and url.fragment not in pages[path].ids:
            errors.append(f'{name}: missing anchor {ref}')
for css in ROOT.rglob('*.css'):
    if not included(css.relative_to(ROOT)):
        continue
    for ref in re.findall(r'''url\([\s"']*([^\)"']+)''', css.read_text()):
        ref = ref.strip()
        if ref.startswith(('data:', 'http', '#', 'blob:')):
            continue
        path = unquote(urlsplit(ref).path)
        target = ROOT / path.lstrip('/') if path.startswith('/') else css.parent / path
        if not target.is_file():
            errors.append(f'{css.relative_to(ROOT)}: missing {ref}')
script_count = 0
with tempfile.TemporaryDirectory(prefix='ians-syntax-') as temp:
    for name, page in pages.items():
        for module, code in page.scripts:
            script_count += 1
            path = Path(temp) / ('script.mjs' if module else 'script.js')
            path.write_text(code)
            result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
            if result.returncode:
                errors.append(f'{name}: invalid inline JavaScript\n{result.stderr[:300]}')
print(f'{len(pages)} HTML pages, {references} local references, {script_count} inline scripts checked.')
for error in errors:
    print(error)
if errors:
    raise SystemExit(1)
print('PASS: no missing local links/assets/anchors or invalid inline scripts.')
