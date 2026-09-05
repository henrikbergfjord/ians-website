module.exports = async function (context, req) {
  const key = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const health = {ok:true, aiConfigured:!!key, model, service:'IANS Dinner Planner AI', runtime:'v6.1'};

  if (req.method === 'GET') {
    context.res = {status:200, headers:{'Cache-Control':'no-store','Content-Type':'application/json'}, jsonBody:health};
    return;
  }
  if (req.method !== 'POST') {
    context.res = {status:405, headers:{'Cache-Control':'no-store'}, jsonBody:{error:'Method not allowed'}};
    return;
  }

  const b = req.body || {};
  if (b.diagnostic === true) {
    context.res = {status:200, headers:{'Cache-Control':'no-store','Content-Type':'application/json'}, jsonBody:health};
    return;
  }

  const prefs = {
    days: clamp(Number(b.days)||7,1,14),
    adults: clamp(Number(b.adults)||2,1,10),
    children: clamp(Number(b.children)||0,0,10),
    priority: String(b.priority||'Sunt og økonomisk').slice(0,80),
    cuisines: Array.isArray(b.cuisines)?b.cuisines.slice(0,8).map(String):[],
    pantry: String(b.pantry||'').slice(0,4000),
    favorites: Array.isArray(b.favorites)?b.favorites.slice(0,30):[],
    budget: Math.max(0,Number(b.budget)||0),
    dessert: !!b.dessert,
    baking: !!b.baking
  };
  const image = typeof b.image==='string' && /^data:image\/(jpeg|png|webp);base64,/.test(b.image) ? b.image : null;

  if (!key) return sendFallback(context,prefs,image,{code:'missing_openai_key',message:'OPENAI_API_KEY mangler i Azure Static Web App settings.'},'AI er ikke aktivert i Azure. IANS viser en komplett lokal reserveplan.');

  const schema = `Returner KUN gyldig JSON uten markdown i denne strukturen: {"aiAvailable":true,"detected":[],"notes":[],"meals":[{"day":1,"name":"","cuisine":"","tags":[],"ingredients":["mengde + vare"],"steps":["trinn"],"tip":""}],"extras":[{"type":"dessert|bakst","name":"","ingredients":[],"steps":[],"tip":""}],"shopping":[{"item":"","quantity":"","category":""}],"savingTips":[],"cookingTips":[],"budgetTips":[]}`;
  const instructions = `Du er IANS Dinner Planner AI. Lag en norsk, praktisk, variert, sunn og økonomisk matplan. Ta hensyn til kjøkkenstil, antall voksne/barn, ukesbudsjett, mat brukeren allerede har, favoritter/tags og valgfri dessert/bakst. Unngå samme middag flere ganger. Oppskrifter skal være komplette med realistiske mengder og konkrete steg. Handlelisten skal i størst mulig grad bare inneholde det som mangler. Hvis bilde er vedlagt, identifiser bare matvarer du med rimelig sikkerhet kan se; usikre observasjoner skal i notes. Dersom dessert eller bakst er valgt, legg ved full oppskrift og ingredienser. Gi minst tre konkrete sparegrep og minst to matlagingstips. Ikke påstå live butikkpriser. ${schema}`;
  const content=[{type:'input_text',text:`Preferanser: ${JSON.stringify(prefs)}`}];
  if(image) content.push({type:'input_image',image_url:image});

  try {
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input:[{role:'user',content}]})});
    const raw=await r.text(); let body={}; try{body=raw?JSON.parse(raw):{}}catch{}
    if(!r.ok){context.log.error('Dinner Planner OpenAI error',r.status,raw.slice(0,800));return sendFallback(context,prefs,image,{code:'openai_http_error',status:r.status,message:body?.error?.message||'OpenAI request failed'},`AI svarte med feil ${r.status}. IANS viser reserveplan.`)}
    let txt=extractOutputText(body).trim(); const first=txt.indexOf('{'),last=txt.lastIndexOf('}'); if(first>=0&&last>first)txt=txt.slice(first,last+1);
    let data; try{data=JSON.parse(txt)}catch{context.log.error('Dinner Planner invalid JSON',txt.slice(0,1000));return sendFallback(context,prefs,image,{code:'invalid_ai_json',message:'AI returnerte tekst som ikke kunne valideres som plan.'},'AI svarte i ugyldig format. IANS viser reserveplan.')}
    const valid=normalizePlan(data,prefs); if(!valid.ok)return sendFallback(context,prefs,image,{code:'invalid_ai_plan',message:valid.reason},'AI-planen manglet nødvendige felter. IANS viser reserveplan.');
    data.aiAvailable=true; data.diagnostic={code:'ok',model};
    context.res={status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},jsonBody:data};
  } catch(e){context.log.error('Dinner Planner exception',e);return sendFallback(context,prefs,image,{code:'exception',message:String(e.message||e)},'AI-tjenesten kunne ikke nås. IANS viser reserveplan.')}
};

function sendFallback(context,prefs,image,diagnostic,note){const data=fallbackPlan(prefs,image);data.aiAvailable=false;data.diagnostic=diagnostic;data.notes.unshift(note);context.res={status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},jsonBody:data}}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function extractOutputText(body){if(typeof body.output_text==='string')return body.output_text;let s='';for(const item of body.output||[])for(const c of item.content||[])if(c.type==='output_text'&&c.text)s+=c.text;return s}
function normalizePlan(data,p){if(!data||!Array.isArray(data.meals)||!data.meals.length)return{ok:false,reason:'Mangler meals'};if(data.meals.length<p.days)return{ok:false,reason:`For få middager: ${data.meals.length}/${p.days}`};for(const m of data.meals.slice(0,p.days))if(!m.name||!Array.isArray(m.ingredients)||m.ingredients.length<2||!Array.isArray(m.steps)||m.steps.length<2)return{ok:false,reason:`Ufullstendig oppskrift: ${m.name||'ukjent'}`};data.meals=data.meals.slice(0,p.days);for(const k of ['shopping','extras','notes','detected','savingTips','cookingTips','budgetTips'])if(!Array.isArray(data[k]))data[k]=[];return{ok:true}}

function fallbackPlan(p,image){
 const C={
  'Filippinsk':[
   ['Chicken Adobo',['1 kg kylling','4 dl jasminris','1 dl soyasaus','0,7 dl eddik','5 fedd hvitløk','1 løk'],['Brun kyllingen lett.','Fres løk og hvitløk.','Tilsett soyasaus og eddik.','La småkoke til kyllingen er gjennomstekt.','Kok ris og server.'],'Lag ekstra til lunsj.'],
   ['Pork Giniling',['700 g svinekjøttdeig','4 dl jasminris','3 gulrøtter','2 paprika','1 løk','1 boks hakkede tomater'],['Kok risen.','Stek kjøtt og løk.','Tilsett grønnsaker og tomat.','La småkoke 15 minutter.'],'Bruk grønnsaksrester.'],
   ['Chicken Tinola',['1 kg kylling','4 dl jasminris','40 g ingefær','4 fedd hvitløk','1 løk','1 pose spinat'],['Kok risen.','Fres ingefær, løk og hvitløk.','Tilsett kylling og vann.','La småkoke til kyllingen er mør.','Tilsett spinat til slutt.'],'Bruk grønne grønnsaker dere har.']
  ],
  'Nordisk':[
   ['Laks med poteter',['700 g laks','1,2 kg poteter','1 brokkoli','4 gulrøtter','1 sitron'],['Kok poteter.','Damp grønnsaker.','Bak laks ved 200 C i 12–16 minutter.','Server med sitron.'],'Familiepakke kan være rimeligst per kilo.'],
   ['Kjøttkaker og poteter',['700 g kjøttkaker','1,2 kg poteter','5 gulrøtter','5 dl brun saus'],['Kok poteter og gulrøtter.','Varm kjøttkaker i saus.','Server sammen.'],'Bruk rester til lunsj.'],
   ['Kyllingform',['900 g kyllingfilet','1 kg poteter','1 brokkoli','4 gulrøtter','1 løk'],['Sett ovnen på 210 C.','Del alt i biter.','Legg i form og krydre.','Bak til gjennomstekt.'],'Lite oppvask.']
  ],
  'Europeisk':[
   ['Ovnsbakt kylling med rotgrønnsaker',['1 kg kylling','1 kg poteter','5 gulrøtter','2 løk','2 paprika'],['Kutt grønnsaker.','Legg alt i langpanne.','Krydre.','Bak ved 210 C til gjennomstekt.'],'Lag nok til restelunsj.'],
   ['Svinegryte',['800 g svinefilet','800 g poteter','4 gulrøtter','1 løk','3 dl matfløte'],['Brun kjøttet.','Fres grønnsaker.','Tilsett poteter og fløte.','La småkoke til mørt.'],'Rimelig grytekjøtt kan brukes.'],
   ['Fisk med ovnsgrønnsaker',['800 g hvit fisk','1 kg poteter','1 brokkoli','4 gulrøtter','1 sitron'],['Bak rotgrønnsaker først.','Legg inn fisk og brokkoli.','Bak videre til fisken flaker seg.'],'Frossen fisk kan være økonomisk.']
  ],
  'Italiensk':[
   ['Spaghetti Bolognese',['600 g kjøttdeig','500 g spaghetti','2 bokser hakkede tomater','1 løk','3 gulrøtter','3 fedd hvitløk'],['Stek kjøtt og løk.','Tilsett hvitløk og gulrot.','Ha i tomat og småkok.','Kok pasta.'],'Strekk med linser eller gulrot.'],
   ['Kyllingpasta',['800 g kyllingfilet','500 g pasta','2 bokser hakkede tomater','1 løk','3 fedd hvitløk'],['Kok pasta.','Stek kylling og løk.','Tilsett tomat.','Vend inn pasta.'],'Lag ekstra saus og frys.']
  ],
  'Britisk':[['Cottage Pie',['700 g kjøttdeig','1,2 kg poteter','4 gulrøtter','1 løk','300 g erter'],['Lag potetmos.','Stek kjøtt og grønnsaker.','Ha i form.','Fordel mos over og gratiner.'],'Bruk rester.']],
  'Amerikansk':[['Homemade Burgers',['700 g kjøttdeig','6 burgerbrød','1 salat','4 tomater','1 løk','150 g ost'],['Form burgere.','Stek gjennom.','Varm brød.','Server med grønt.'],'Lag burgerne selv.']]
 };
 let keys=(p.cuisines||[]).filter(k=>C[k]);if(!keys.length)keys=['Filippinsk','Nordisk','Europeisk'];let pool=keys.flatMap(k=>C[k].map(x=>[k,...x]));while(pool.length<p.days)pool=pool.concat(pool.map(x=>x));const meals=[],used=new Set();for(let i=0;i<p.days;i++){let pick=pool.find(x=>!used.has(x[1]))||pool[i%pool.length];used.add(pick[1]);meals.push({day:i+1,cuisine:pick[0],name:pick[1],tags:['reserve'],ingredients:pick[2],steps:pick[3],tip:pick[4]})}
 const pantry=p.pantry.toLowerCase(),items=new Map();for(const m of meals)for(const ing of m.ingredients){const name=ing.replace(/^\d+[\d,.]*\s*(kg|g|dl|l|stk|boks|poser?|fedd)?\s*/i,'').trim();if(!pantry.includes(name.toLowerCase()))items.set(name,(items.get(name)||0)+1)}
 const extras=[];if(p.dessert){const x={type:'dessert',name:'Eplesmuldrepai',ingredients:['6 epler','150 g havregryn','100 g smør','80 g sukker','1 ts kanel'],steps:['Skjær epler.','Lag smuldredeig.','Bak ved 200 C til gyllen.'],tip:'Bruk epler som må spises.'};extras.push(x)}if(p.baking){const x={type:'bakst',name:'Hjemmebakte boller',ingredients:['1 kg hvetemel','5 dl melk','1 pk gjær','150 g smør','120 g sukker'],steps:['Lag deig.','Hev.','Form boller.','Etterhev og stek.'],tip:'Bak dobbel porsjon og frys.'};extras.push(x)}
 return{aiAvailable:false,mode:'local-fallback',detected:[],notes:image?['Bildeanalyse krever aktiv AI.']:[],meals,extras,shopping:[...items].map(([item,n])=>({item,quantity:n>1?`til ${n} retter`:'1 passende pakke',category:'Handleliste'})),savingTips:['Sjekk kjøleskap og fryser før du handler.','Bruk samme grønnsaker i flere retter.','Planlegg rester.'],cookingTips:['Kutt grønnsaker til flere dager samtidig.','Frys porsjoner tidlig.'],budgetTips:p.budget?[`Ukesbudsjett: ${p.budget} kr. Hold en buffer.`]:[]}
}
