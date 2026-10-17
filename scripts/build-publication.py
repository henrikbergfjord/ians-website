"""Publish only the active Axion application, never the old IANS repository copy."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def copy_group(names,folder):
 out=ROOT/folder
 if out.exists():shutil.rmtree(out)
 out.mkdir()
 for name in names:
  p=Path(name)
  if p.is_absolute() or '..' in p.parts or any(x.startswith('.') for x in p.parts) or '.backup' in name:raise ValueError(name)
  source=ROOT/p
  if not source.is_file() or source.is_symlink():raise ValueError(name)
  rel=p.relative_to('api') if folder=='dist-api' else p
  target=out/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
 return out
m=json.loads((ROOT/'publication.json').read_text())
copy_group(m['staticFiles'],'dist-public');copy_group(m['apiFiles'],'dist-api')
print('Axion publication:',len(m['staticFiles']),'static files and',len(m['apiFiles']),'API files. Old IANS pages excluded.')
