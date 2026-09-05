module.exports=async function(context,req){
  const key=process.env.OPENAI_API_KEY||'';
  const model=process.env.OPENAI_MODEL||'gpt-5.6-luna';
  const health={ok:true,service:'IANS File Commander AI',runtime:'v2.1',aiConfigured:!!key,model};

  if(req.method==='GET'){
    context.res={status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},jsonBody:health};
    return;
  }
  if(req.method!=='POST'){
    context.res={status:405,headers:{'Cache-Control':'no-store'},jsonBody:{error:'Method not allowed'}};
    return;
  }

  const b=req.body||{};
  if(b.diagnostic===true){
    context.res={status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},jsonBody:health};
    return;
  }

  const q=String(b.question||'').slice(0,1200);
  const raw=Array.isArray(b.inventory)?b.inventory:[];
  const inventory=raw.slice(0,2500).map(x=>({
    side:String(x.side||'').slice(0,10),
    name:String(x.name||'').slice(0,220),
    kind:x.kind==='directory'?'directory':'file',
    size:Number(x.size)||0,
    modified:Number(x.modified)||0
  }));

  if(!inventory.length){
    context.res={status:200,headers:{'Cache-Control':'no-store'},jsonBody:{analysis:'SITUASJON\nIngen katalogmetadata ble mottatt.\n\nANBEFALT PLAN\nÅpne minst én mappe i File Commander og kjør analysen på nytt.',itemsReceived:0,aiAvailable:false,diagnostic:{code:'empty_inventory'}}};
    return;
  }

  if(!key){
    return sendFallback(context,inventory,q,{code:'missing_openai_key',message:'OPENAI_API_KEY mangler i Azure Static Web App settings.'});
  }

  const system=`Du er IANS File Commander AI, en norsk filorganiseringsassistent. Du mottar kun katalogmetadata som brukeren uttrykkelig har valgt å sende: fil-/mappenavn, type, størrelse, endringstid og hvilket panel elementet kommer fra. Du har ikke filinnhold. Ikke påstå at du har lest filer. Analyser struktur, plassbruk, navnemønstre, mulige duplikater og organisering. Vær konkret og kort. Foreslå aldri sletting som allerede utført. Skill tydelig mellom observasjon, forslag og handling som krever brukerens godkjenning. Ved mulige duplikater: krev hash-verifisering før sletting. Returner norsk tekst med overskriftene SITUASJON, FUNN, ANBEFALT PLAN, SIKKERHET FØR UTFØRING.`;

  try{
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,instructions:system,input:`Brukerens spørsmål: ${q||'Analyser de åpne mappene og foreslå forbedringer.'}\n\nKatalogmetadata:\n${JSON.stringify(inventory)}`})
    });
    const rawBody=await r.text();let body={};try{body=rawBody?JSON.parse(rawBody):{}}catch{}
    if(!r.ok){
      context.log.error('File Commander OpenAI error',r.status,body?.error?.message||rawBody.slice(0,800));
      return sendFallback(context,inventory,q,{code:'openai_http_error',status:r.status,message:body?.error?.message||'OpenAI request failed'});
    }
    const parts=[];
    if(typeof body.output_text==='string')parts.push(body.output_text);
    for(const item of body.output||[])for(const c of item.content||[])if(c.type==='output_text'&&c.text)parts.push(c.text);
    const analysis=parts.join('\n').trim();
    if(!analysis)return sendFallback(context,inventory,q,{code:'empty_ai_response',message:'AI returnerte ikke tekst.'});
    context.res={status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},jsonBody:{analysis,itemsReceived:inventory.length,aiAvailable:true,diagnostic:{code:'ok',model}}};
  }catch(e){
    context.log.error('File Commander AI exception',e);
    return sendFallback(context,inventory,q,{code:'exception',message:String(e.message||e)});
  }
};

function sendFallback(context,inventory,question,diagnostic){
  const files=inventory.filter(x=>x.kind==='file');
  const dirs=inventory.filter(x=>x.kind==='directory');
  const total=files.reduce((s,x)=>s+x.size,0);
  const largest=[...files].sort((a,b)=>b.size-a.size).slice(0,5);
  const byExt=new Map();
  for(const f of files){const m=f.name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);const ext=m?m[1]:'uten filtype';const v=byExt.get(ext)||{count:0,size:0};v.count++;v.size+=f.size;byExt.set(ext,v)}
  const topTypes=[...byExt.entries()].sort((a,b)=>b[1].size-a[1].size).slice(0,5);
  const nameGroups=new Map();
  for(const f of files){const base=f.name.toLowerCase().replace(/\.[^.]+$/,'').replace(/\s*[-_(]?copy\s*\d*\)?$/i,'').replace(/\s*\(\d+\)$/,'').trim();if(!base)continue;const a=nameGroups.get(base)||[];a.push(f);nameGroups.set(base,a)}
  const possibleDupes=[...nameGroups.values()].filter(a=>a.length>1).slice(0,5);
  const fmt=n=>{for(const u of ['B','KB','MB','GB','TB']){if(n<1024)return `${n<10&&u!=='B'?n.toFixed(1):Math.round(n)} ${u}`;n/=1024}return n.toFixed(1)+' PB'};
  let out='SITUASJON\n';
  out+=`Analyserer ${files.length} filer og ${dirs.length} mapper. Registrert filstørrelse i utvalget er ca. ${fmt(total)}.`;
  if(question)out+=` Spørsmål: «${question}»`;
  out+='\n\nFUNN\n';
  if(largest.length)out+='Største filer:\n'+largest.map((f,i)=>`${i+1}. ${f.name} – ${fmt(f.size)}`).join('\n')+'\n';
  if(topTypes.length)out+='\nMest plass etter filtype:\n'+topTypes.map(([ext,v])=>`• .${ext}: ${v.count} filer, ${fmt(v.size)}`).join('\n')+'\n';
  if(possibleDupes.length)out+='\nMulige navnelikheter som bør undersøkes:\n'+possibleDupes.map(a=>'• '+a.map(x=>x.name).join(' / ')).join('\n')+'\n';
  out+='\nANBEFALT PLAN\n1. Start med de største filene hvis målet er å frigjøre plass.\n2. Samle filer med samme tema eller filtype i tydelige mapper dersom strukturen er uoversiktlig.\n3. Bruk Duplikater/SHA-256 før eventuell sletting av filer som ser like ut.\n4. Kjør AI-analysen på nytt når OpenAI-nøkkelen er konfigurert for en mer språklig og kontekstuell vurdering.';
  out+='\n\nSIKKERHET FØR UTFØRING\nIngen filer er lest eller endret. Analysen bruker bare metadata. Ingen sletting bør gjøres på grunnlag av filnavn alene; verifiser duplikater med hash først.';
  context.res={status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},jsonBody:{analysis:out,itemsReceived:inventory.length,aiAvailable:false,mode:'local-metadata-fallback',diagnostic}};
}
