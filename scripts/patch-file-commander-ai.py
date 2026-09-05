from pathlib import Path
p=Path('tools/file-commander/index.html')
s=p.read_text()

# AI button
old='<button class="btn smart" id="refresh">↻ Oppdater</button>'
new='<button class="btn smart" id="refresh">↻ Oppdater</button><button class="btn primary" id="ai">✦ IANS AI</button>'
if old in s and 'id="ai"' not in s:s=s.replace(old,new,1)

# Add direct file picker to both Commander panes.
s=s.replace('<button class="pick choose">Velg mappe</button>','<span><button class="pick choose">📁 Mappe</button> <button class="pick files">📄 Filer</button></span>')

# Give virtual file selections a useful path label.
oldpath="pane.querySelector('.path').textContent=[s.root?.name,...s.stack.map(x=>x.name)].filter(Boolean).join(' / ')||'Ingen mappe valgt';"
newpath="pane.querySelector('.path').textContent=s.virtualLabel||([s.root?.name,...s.stack.map(x=>x.name)].filter(Boolean).join(' / ')||'Ingen mappe valgt');"
if oldpath in s:s=s.replace(oldpath,newpath,1)

needle="$('#help').onclick="
addon=r'''async function openAI(){const inventory=[];for(const side of ['left','right'])for(const x of state[side].items)inventory.push({side,name:x.name,kind:x.kind,size:x.size||0,modified:x.modified||0});if(!inventory.length)return setStatus('Åpne minst én mappe eller velg filer før AI-analyse.');openDialog('<h3>✦ IANS File Commander AI</h3><p class="legend">AI får kun katalogmetadata du ser her – fil-/mappenavn, type, størrelse og dato. Filinnhold sendes ikke.</p><textarea id="aiq" rows="4" placeholder="F.eks. Hvor bruker jeg mest plass, og hvordan bør dette organiseres?"></textarea><div class="actions"><button class="btn primary" id="airun">Analyser metadata</button></div><div id="aiout"></div>');$('#airun').onclick=async()=>{const q=$('#aiq').value.trim();$('#airun').disabled=true;$('#aiout').innerHTML='<p class="legend">IANS AI analyserer '+inventory.length+' katalogelementer…</p>';try{const r=await fetch('/api/file-commander-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,inventory})});const raw=await r.text();let b={};try{b=raw?JSON.parse(raw):{}}catch{}if(!r.ok)throw new Error(b.error||('API svarte '+r.status+(raw?' · '+raw.slice(0,160):'')));if(!b.analysis)throw new Error('AI API returnerte ikke en analyse.');$('#aiout').innerHTML='<div class="preview"><pre>'+esc(b.analysis)+'</pre></div><p class="legend">AI har kun foreslått tiltak. Ingen filer er endret.</p>'}catch(e){$('#aiout').innerHTML='<div class="report"><div><b>AI utilgjengelig</b><br>'+esc(e.message)+'</div></div>'}finally{$('#airun').disabled=false}}}$('#ai').onclick=openAI;
'''
if needle in s and "function openAI()" not in s:s=s.replace(needle,addon+needle,1)

# Direct file selection: one or many files without granting a whole folder.
file_picker=r'''async function pickFiles(side){if(!window.showOpenFilePicker)return alert('Direkte filvalg krever Edge/Chrome med File System Access API.');try{const handles=await showOpenFilePicker({multiple:true});const rows=[];for(const h of handles){const f=await h.getFile();rows.push({name:f.name,handle:h,kind:'file',size:f.size,modified:f.lastModified})}rows.sort((a,b)=>a.name.localeCompare(b.name,'nb'));Object.assign(state[side],{handle:null,root:null,stack:[],items:rows,selected:null,filter:'',virtualLabel:'Valgte filer · '+rows.length});activate(side);render(side);setStatus(side.toUpperCase()+': '+rows.length+' direkte valgte filer. Dobbeltklikk for Preview.')}catch(e){if(e.name!=='AbortError')setStatus('Kunne ikke åpne fil: '+e.message)}}
'''
marker="async function up(side){"
if marker in s and "function pickFiles(side)" not in s:s=s.replace(marker,file_picker+marker,1)

# Folder pick should clear virtual file selection label.
s=s.replace("Object.assign(state[side],{handle:h,root:h,stack:[],selected:null});","Object.assign(state[side],{handle:h,root:h,stack:[],selected:null,virtualLabel:''});")

# Smart Compare: selected file vs selected file -> code/text diff or binary SHA-256. Otherwise folder compare.
cs="async function compare(){"
ce="}async function findDupes(){"
if cs in s and ce in s:
    a=s.index(cs); b=s.index(ce,a)
    smart=r'''async function compare(){const A=state.left.selected,B=state.right.selected;if(A&&B&&A.kind==='file'&&B.kind==='file')return compareFiles(A,B);if(!state.left.handle||!state.right.handle)return setStatus('For mappe-compare: åpne mapper i begge paneler. For fil-compare: velg én fil i hvert panel.');await Promise.all([refresh('left'),refresh('right')]);document.querySelectorAll('.row').forEach(r=>r.classList.remove('diff','same'));const L=new Map(state.left.items.map(x=>[x.name,x])),R=new Map(state.right.items.map(x=>[x.name,x]));let same=0,diff=0,leftOnly=0,rightOnly=0;for(const [n,a]of L){const b=R.get(n);let cls='diff';if(!b)leftOnly++;else if(a.kind===b.kind&&(a.kind==='directory'||a.size===b.size)){cls='same';same++}else diff++;document.querySelector('#left .row[data-name="'+CSS.escape(n)+'"]')?.classList.add(cls);if(b)document.querySelector('#right .row[data-name="'+CSS.escape(n)+'"]')?.classList.add(cls)}for(const [n]of R)if(!L.has(n)){rightOnly++;document.querySelector('#right .row[data-name="'+CSS.escape(n)+'"]')?.classList.add('diff')}openDialog('<h3>Mappe-sammenligning</h3><div class="report"><div><b>Lik struktur/størrelse</b> '+same+'</div><div><b>Forskjellig</b> '+diff+'</div><div><b>Kun venstre</b> '+leftOnly+'</div><div><b>Kun høyre</b> '+rightOnly+'</div></div><p class="legend">Grønn = samsvar. Gul = mangler eller avviker. Velg én fil i hvert panel og trykk Sammenlign for innholds-compare.</p>',true)}async function compareFiles(a,b){setStatus('Sammenligner '+a.name+' ↔ '+b.name+'…');const fa=await a.handle.getFile(),fb=await b.handle.getFile(),textRx=/\.(txt|md|json|csv|log|js|jsx|ts|tsx|css|html|htm|xml|yml|yaml|ps1|py|sh|zsh|bash|sql|ini|conf|cfg|java|c|h|cpp|cs|go|rs|php|rb)$/i,isText=fa.type.startsWith('text/')||fb.type.startsWith('text/')||textRx.test(a.name)||textRx.test(b.name);if(isText){const [ta,tb]=await Promise.all([fa.text(),fb.text()]),la=ta.split(/\r?\n/),lb=tb.split(/\r?\n/),n=Math.max(la.length,lb.length),rows=[];let changes=0;for(let i=0;i<n;i++){const x=la[i]??'',y=lb[i]??'',same=x===y;if(!same)changes++;if(!same||i<200)rows.push('<div style="display:grid;grid-template-columns:42px 1fr 42px 1fr;gap:8px;border-bottom:1px solid #17354e;padding:4px 0;'+(same?'':'background:#4a321b55')+'"><span>'+(i+1)+'</span><code>'+esc(x)+'</code><span>'+(i+1)+'</span><code>'+esc(y)+'</code></div>')}openDialog('<h3>Code / Text Compare</h3><p class="legend"><b>'+esc(a.name)+'</b> ↔ <b>'+esc(b.name)+'</b> · '+changes+' linjer avviker</p><div style="max-height:58vh;overflow:auto;font-size:.72rem">'+rows.join('')+'</div>');setStatus('Compare ferdig · '+changes+' linjeavvik')}else{const [ha,hb]=await Promise.all([digestFile(a.handle),digestFile(b.handle)]),same=ha===hb;openDialog('<h3>Binary Compare</h3><div class="report"><div><b>'+esc(a.name)+'</b><br>'+fmt(fa.size)+'<br><small style="word-break:break-all">'+ha+'</small></div><div><b>'+esc(b.name)+'</b><br>'+fmt(fb.size)+'<br><small style="word-break:break-all">'+hb+'</small></div><div><b>'+(same?'IDENTISK ✓':'ULIK ✕')+'</b><br>SHA-256 '+(same?'matcher byte-for-byte.':'er forskjellig.')+'</div></div>',true);setStatus('Binary compare ferdig · '+(same?'identisk':'ulik'))}}
'''
    s=s[:a]+smart+s[b+1:]

# Executable directional sync plan.
start="function syncPlan(){"
end="}document.querySelectorAll('.pane')"
if start in s and end in s:
    a=s.index(start); b=s.index(end,a)
    sync=r'''function syncPlan(){if(!state.left.handle||!state.right.handle)return setStatus('Synk krever mapper i begge paneler. Direkte valgte filer kan sammenlignes og kopieres, men ikke massesynkroniseres.');const L=new Map(state.left.items.map(x=>[x.name,x])),R=new Map(state.right.items.map(x=>[x.name,x])),actions=[];for(const [n,a]of L){const b=R.get(n);if(!b)actions.push({dir:'lr',name:n,item:a,label:'Venstre → Høyre'});else if(a.kind!==b.kind||a.size!==b.size)actions.push({dir:'conflict',name:n,item:a,label:'Avvik – kontroller manuelt'})}for(const [n,b]of R)if(!L.has(n))actions.push({dir:'rl',name:n,item:b,label:'Høyre → Venstre'});window.__iansSyncActions=actions;openDialog('<h3>Synkroniseringsplan</h3><div class="report">'+(actions.length?actions.map((x,i)=>'<div><b>'+esc(x.label)+'</b> · '+esc(x.name)+(x.dir==='conflict'?'':' <label style="float:right"><input class="syncPick" type="checkbox" data-i="'+i+'" checked> Utfør</label>')+'</div>').join(''):'<div>Mappene ser synkroniserte ut på navn/type/størrelse.</div>')+'</div>'+(actions.some(x=>x.dir!=='conflict')?'<div class="actions"><button class="btn primary" id="executeSync">Utfør valgte handlinger</button></div>':'')+'<p class="legend">Avvik med samme filnavn overskrives ikke automatisk. De må kontrolleres først.</p>');if($('#executeSync'))$('#executeSync').onclick=executeSync}async function executeSync(){const picks=[...document.querySelectorAll('.syncPick:checked')].map(x=>Number(x.dataset.i)),actions=window.__iansSyncActions||[];if(!picks.length)return setStatus('Ingen synkhandlinger valgt.');if(!confirm('Utføre '+picks.length+' valgte synkhandlinger?'))return;$('#executeSync').disabled=true;let done=0;try{for(const i of picks){const a=actions[i];if(!a||a.dir==='conflict')continue;const dst=a.dir==='lr'?state.right.handle:state.left.handle;setStatus('Synkroniserer '+(done+1)+'/'+picks.length+' · '+a.name);await copyEntry(a.item.handle,dst,a.name);done++}await Promise.all([refresh('left'),refresh('right')]);closeDialog();setStatus('Synkronisering ferdig · '+done+' handlinger utført.')}catch(e){setStatus('Synkronisering stoppet: '+e.message);$('#executeSync').disabled=false}}
'''
    s=s[:a]+sync+s[b+1:]

# Bind file picker buttons after base handlers exist.
bind="document.querySelectorAll('.files').forEach(b=>b.onclick=e=>{e.stopPropagation();pickFiles(b.closest('.pane').dataset.side)});"
anchor="document.querySelectorAll('.choose').forEach"
if bind not in s and anchor in s:
    idx=s.index(anchor)
    # Insert binding before the existing choose binding.
    s=s[:idx]+bind+s[idx:]

p.write_text(s)
