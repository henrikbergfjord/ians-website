from pathlib import Path
p=Path('tools/file-commander/index.html')
s=p.read_text()
old='<button class="btn smart" id="refresh">↻ Oppdater</button>'
new='<button class="btn smart" id="refresh">↻ Oppdater</button><button class="btn primary" id="ai">✦ IANS AI</button>'
if old in s and 'id="ai"' not in s:s=s.replace(old,new,1)
needle="$('#help').onclick="
ai="""async function openAI(){const inventory=[];for(const side of ['left','right'])for(const x of state[side].items)inventory.push({side,name:x.name,kind:x.kind,size:x.size||0,modified:x.modified||0});if(!inventory.length)return setStatus('Åpne minst én mappe før AI-analyse.');openDialog('<h3>✦ IANS File Commander AI</h3><p class=\"legend\">AI får kun katalogmetadata du ser her – fil-/mappenavn, type, størrelse og dato. Filinnhold sendes ikke.</p><textarea id=\"aiq\" rows=\"4\" placeholder=\"F.eks. Hvor bruker jeg mest plass, og hvordan bør dette organiseres?\"></textarea><div class=\"actions\"><button class=\"btn primary\" id=\"airun\">Analyser metadata</button></div><div id=\"aiout\"></div>');$('#airun').onclick=async()=>{const q=$('#aiq').value.trim();$('#airun').disabled=true;$('#aiout').innerHTML='<p class=\"legend\">IANS AI analyserer '+inventory.length+' katalogelementer…</p>';try{const r=await fetch('/api/file-commander-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,inventory})}),b=await r.json();if(!r.ok)throw new Error(b.error||'AI-kall feilet');$('#aiout').innerHTML='<div class=\"preview\"><pre>'+esc(b.analysis)+'</pre></div><p class=\"legend\">AI har kun foreslått tiltak. Ingen filer er endret.</p>'}catch(e){$('#aiout').innerHTML='<div class=\"report\"><div>AI utilgjengelig: '+esc(e.message)+'</div></div>'}finally{$('#airun').disabled=false}}}$('#ai').onclick=openAI;"""
if needle in s and "function openAI()" not in s:s=s.replace(needle,ai+needle,1)
p.write_text(s)
