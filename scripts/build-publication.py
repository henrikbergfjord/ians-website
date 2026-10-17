"""Build only the exact reviewed file list; do not upload the repository root."""
import argparse,json,shutil
from pathlib import Path

def build(root,output):
    root=root.resolve();output=output.resolve()
    if output==root or root.is_relative_to(output):raise ValueError('Unsafe output directory')
    manifest=json.loads((root/'publication.json').read_text())
    files=manifest['files']
    if len(files)!=len(set(files)):raise ValueError('Duplicate publication entry')
    for name in files:
        p=Path(name)
        if p.is_absolute() or '..' in p.parts or any(x.startswith('.') for x in p.parts):raise ValueError('Hidden/unsafe publication entry: '+name)
        if p.parts[0] in ('api','checks','scripts','tests','docs','qa','node_modules') or '.backup' in name:raise ValueError('Internal publication entry: '+name)
        source=root/p
        if source.is_symlink() or not source.is_file():raise ValueError('Missing/non-regular publication entry: '+name)
    ignored={'api','checks','scripts','tests','docs','qa','node_modules','dist-public'}
    actual_html={p.relative_to(root).as_posix() for p in root.rglob('*.html') if not any(x.startswith('.') or x in ignored for x in p.relative_to(root).parts)}
    listed_html={n for n in files if n.endswith('.html')}
    if actual_html != listed_html:raise ValueError('HTML manifest mismatch: '+str(sorted(actual_html ^ listed_html)))
    if output.exists():shutil.rmtree(output)
    output.mkdir(parents=True)
    for name in files:
        target=output/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,target)
    print(f'Publication: {len(files)} reviewed files, {sum(n.endswith(".html") for n in files)} HTML pages. Internal files and snapshots excluded.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='dist-public');args=parser.parse_args()
    build(Path(__file__).resolve().parents[1],Path(args.output))
