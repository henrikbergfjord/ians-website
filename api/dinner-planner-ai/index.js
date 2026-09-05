module.exports = async function (context, req) {
  const key = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  if (req.method === 'GET') {
    context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:{ok:true,aiConfigured:!!key,model,service:'IANS Dinner Planner AI'}};
    return;
  }
  if (req.method !== 'POST') {
    context.res = {status:405,jsonBody:{error:'Method not allowed'}};
    return;
  }

  const b = req.body || {};
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

  if (!key) {
    const data = fallbackPlan(prefs,image);
    data.aiAvailable = false;
    data.diagnostic = {code:'missing_openai_key',message:'OPENAI_API_KEY mangler i Azure Static Web App settings.'};
    data.notes.unshift('AI er ikke aktivert i Azure. IANS viser en komplett lokal reserveplan.');
    context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:data};
    return;
  }

  const schemaDescription = `Returner KUN gyldig JSON uten markdown i denne strukturen:
{"aiAvailable":true,"detected":[],"notes":[],"meals":[{"day":1,"name":"","cuisine":"","tags":[],"ingredients":["mengde + vare"],"steps":["trinn"],"tip":""}],"extras":[{"type":"dessert|bakst","name":"","ingredients":[],"steps":[],"tip":""}],"shopping":[{"item":"","quantity":"","category":""}],"savingTips":[],"cookingTips":[],"budgetTips":[]}`;
  const instructions = `Du er IANS Dinner Planner AI. Lag en norsk, praktisk, variert, sunn og økonomisk matplan. Ta hensyn til kjøkkenstil, antall voksne/barn, ukesbudsjett, mat brukeren allerede har, favoritter/tags og valgfri dessert/bakst. Unngå samme middag flere ganger. Oppskrifter skal være komplette, med realistiske mengder og konkrete steg. Handlelisten skal i størst mulig grad bare inneholde det som mangler. Hvis bilde er vedlagt, identifiser bare matvarer du med rimelig sikkerhet kan se; usikre observasjoner skal i notes. Dersom dessert eller bakst er valgt, legg ved full oppskrift og ingredienser. Gi minst tre konkrete sparegrep og minst to matlagingstips. Ikke påstå live butikkpriser. ${schemaDescription}`;
  const content = [{type:'input_text',text:`Preferanser: ${JSON.stringify(prefs)}`}];
  if (image) content.push({type:'input_image',image_url:image});

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,instructions,input:[{role:'user',content}]})
    });
    const raw = await r.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {}
    if (!r.ok) {
      context.log.error('Dinner Planner OpenAI error', r.status, raw.slice(0,800));
      const data = fallbackPlan(prefs,image);
      data.aiAvailable = false;
      data.diagnostic = {code:'openai_http_error',status:r.status,message:body?.error?.message||'OpenAI request failed'};
      data.notes.unshift(`AI svarte med feil ${r.status}. IANS viser reserveplan.`);
      context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:data};
      return;
    }

    let txt = extractOutputText(body).trim();
    const first = txt.indexOf('{'), last = txt.lastIndexOf('}');
    if (first >= 0 && last > first) txt = txt.slice(first,last+1);
    let data;
    try { data = JSON.parse(txt); }
    catch (e) {
      context.log.error('Dinner Planner invalid JSON', txt.slice(0,1000));
      data = fallbackPlan(prefs,image);
      data.aiAvailable = false;
      data.diagnostic = {code:'invalid_ai_json',message:'AI returnerte tekst som ikke kunne valideres som plan.'};
      data.notes.unshift('AI svarte i ugyldig format. IANS viser reserveplan.');
      context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:data};
      return;
    }

    const valid = normalizePlan(data,prefs);
    if (!valid.ok) {
      const fallback = fallbackPlan(prefs,image);
      fallback.aiAvailable = false;
      fallback.diagnostic = {code:'invalid_ai_plan',message:valid.reason};
      fallback.notes.unshift('AI-planen manglet nødvendige felter. IANS viser reserveplan.');
      context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:fallback};
      return;
    }
    data.aiAvailable = true;
    data.diagnostic = {code:'ok',model};
    context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:data};
  } catch (e) {
    context.log.error('Dinner Planner exception',e);
    const data = fallbackPlan(prefs,image);
    data.aiAvailable = false;
    data.diagnostic = {code:'exception',message:String(e.message||e)};
    data.notes.unshift('AI-tjenesten kunne ikke nås. IANS viser reserveplan.');
    context.res = {status:200,headers:{'Cache-Control':'no-store'},jsonBody:data};
  }
};

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function extractOutputText(body){if(typeof body.output_text==='string')return body.output_text;let s='';for(const item of body.output||[])for(const c of item.content||[])if(c.type==='output_text'&&c.text)s+=c.text;return s}
function normalizePlan(data,p){
  if(!data||!Array.isArray(data.meals)||!data.meals.length)return {ok:false,reason:'Mangler meals'};
  if(data.meals.length<p.days)return {ok:false,reason:`For få middager: ${data.meals.length}/${p.days}`};
  for(const m of data.meals.slice(0,p.days)){
    if(!m.name||!Array.isArray(m.ingredients)||m.ingredients.length<2||!Array.isArray(m.steps)||m.steps.length<2)return {ok:false,reason:`Ufullstendig oppskrift: ${m.name||'ukjent'}`};
  }
  data.meals=data.meals.slice(0,p.days);if(!Array.isArray(data.shopping))data.shopping=[];if(!Array.isArray(data.extras))data.extras=[];if(!Array.isArray(data.notes))data.notes=[];if(!Array.isArray(data.detected))data.detected=[];if(!Array.isArray(data.savingTips))data.savingTips=[];if(!Array.isArray(data.cookingTips))data.cookingTips=[];if(!Array.isArray(data.budgetTips))data.budgetTips=[];return {ok:true};
}

function fallbackPlan(p,image){
  const C={
    'Filippinsk':[
      ['Chicken Adobo',['1 kg kyllinglår eller filet','4 dl jasminris','1 dl soyasaus','0,7 dl eddik','5 fedd hvitløk','1 løk','2 laurbærblad'],['Brun kyllingen lett i en gryte.','Tilsett løk og hvitløk og stek kort.','Ha i soyasaus, eddik og laurbærblad.','La småkoke under lokk i 25–35 minutter.','Kok ris og server ved siden av.'],'Lag gjerne ekstra til lunsj dagen etter.'],
      ['Pork Giniling',['700 g svinekjøttdeig','4 dl jasminris','3 gulrøtter','2 paprika','1 løk','1 boks hakkede tomater'],['Kok risen.','Stek kjøttdeig og løk.','Tilsett gulrot og paprika.','Ha i tomater og la småkoke 15 minutter.','Server med ris.'],'Fin måte å bruke grønnsaksrester på.'],
      ['Chicken Tinola',['1 kg kylling','4 dl jasminris','40 g ingefær','4 fedd hvitløk','1 løk','1 pose spinat eller andre grønne grønnsaker'],['Kok risen.','Fres ingefær, løk og hvitløk.','Tilsett kylling og vann så det dekker godt.','La småkoke til kyllingen er mør.','Tilsett grønne grønnsaker de siste minuttene.'],'Bruk de grønne grønnsakene dere allerede har.']
    ],
    'Nordisk':[
      ['Laks med poteter',['700 g laksefilet','1,2 kg poteter','1 brokkoli','4 gulrøtter','1 sitron'],['Kok poteter.','Del brokkoli og gulrøtter og kok eller damp dem.','Bak laksen ved 200 C i ca. 12–16 minutter, til gjennomstekt.','Server med sitron.'],'Familiepakke kan være rimeligere per kilo.'],
      ['Kjøttkaker og poteter',['700 g kjøttkaker','1,2 kg poteter','5 gulrøtter','5 dl brun saus'],['Kok poteter og gulrøtter.','Varm kjøttkaker i sausen.','Server sammen.'],'Rester fungerer godt til lunsj.'],
      ['Kyllingform',['900 g kyllingfilet','1 kg poteter','1 brokkoli','4 gulrøtter','1 løk'],['Sett ovnen på 210 C.','Del alt i jevne biter.','Legg i ildfast form og krydre.','Bak 35–45 minutter til kyllingen er gjennomstekt og potetene møre.'],'En form gir lite oppvask.']
    ],
    'Europeisk':[
      ['Ovnsbakt kylling med rotgrønnsaker',['1 kg kylling','1 kg poteter','5 gulrøtter','2 løk','2 paprika'],['Sett ovnen på 210 C.','Kutt grønnsakene og legg dem i langpanne.','Legg kyllingen over og krydre.','Bak til kyllingen er gjennomstekt og grønnsakene møre.'],'Lag nok til restelunsj.'],
      ['Svinegryte med grønnsaker',['800 g svinefilet eller rimelig grytekjøtt','800 g poteter','4 gulrøtter','1 løk','3 dl matfløte'],['Brun kjøttet i porsjoner.','Fres løk og gulrot.','Tilsett kjøtt, poteter og matfløte.','La småkoke til kjøtt og poteter er møre.'],'Rimeligere stykningsdel fungerer fint med lengre koketid.'],
      ['Fisk med ovnsgrønnsaker',['800 g hvit fisk','1 kg poteter','1 brokkoli','4 gulrøtter','1 sitron'],['Bak poteter og gulrøtter ved 210 C i 25 minutter.','Legg inn fisk og brokkoli.','Bak videre 12–15 minutter til fisken flaker seg.','Server med sitron.'],'Frossen fisk kan være økonomisk.']
    ],
    'Italiensk':[
      ['Spaghetti Bolognese',['600 g kjøttdeig','500 g spaghetti','2 bokser hakkede tomater','1 løk','3 gulrøtter','3 fedd hvitløk'],['Stek kjøttdeig og løk.','Tilsett hvitløk og revet gulrot.','Ha i tomater og la småkoke minst 20 minutter.','Kok pasta og server.'],'Strekk kjøttdeigen med linser eller ekstra gulrot.'],
      ['Kyllingpasta med tomat',['800 g kyllingfilet','500 g pasta','2 bokser hakkede tomater','1 løk','3 fedd hvitløk'],['Kok pasta.','Stek kylling og løk.','Tilsett hvitløk og tomater.','La småkoke til kyllingen er gjennomstekt.','Vend inn pasta.'],'Lag dobbel saus og frys halvparten.'],
      ['Pasta Primavera',['500 g pasta','1 brokkoli','2 paprika','4 gulrøtter','100 g parmesan'],['Kok pasta.','Stek grønnsakene raskt så de fortsatt har litt tyggemotstand.','Vend pasta og grønnsaker sammen.','Topp med parmesan.'],'Perfekt til grønnsaksrester.']
    ],
    'Britisk':[
      ['Cottage Pie',['700 g kjøttdeig','1,2 kg poteter','4 gulrøtter','1 løk','300 g erter'],['Kok poteter og lag mos.','Stek kjøttdeig, løk og gulrot.','Rør inn erter og litt kraft eller saus.','Fordel potetmos over og gratiner ved 220 C.'],'Kan lages av kjøttrester.'],
      ['Sausages and Mash',['8 middagspølser','1,2 kg poteter','2 løk','4 gulrøtter'],['Kok poteter og lag mos.','Stek pølsene gjennom.','Stek løk myk i samme panne.','Server med gulrøtter.'],'Kjøp stor pakke bare dersom resten fryses.']
    ],
    'Amerikansk':[
      ['Homemade Burgers',['700 g kjøttdeig','6 burgerbrød','1 salat','4 tomater','1 løk','150 g ost'],['Form seks burgere og krydre.','Stek burgerne helt gjennom.','Varm brødene.','Server med salat, tomat, løk og ost.'],'Hjemmelagde burgere gir kontroll på størrelse og pris.'],
      ['Chicken Fajita Bowl',['900 g kyllingfilet','4 dl ris','3 paprika','2 løk','1 boks mais'],['Kok ris.','Strimle og stek kyllingen.','Stek paprika og løk.','Fordel ris, kylling, grønnsaker og mais i skåler.'],'Rester blir en enkel lunsjbowl.']
    ]
  };
  let keys=(p.cuisines||[]).filter(k=>C[k]);if(!keys.length)keys=['Filippinsk','Nordisk','Europeisk'];
  let pool=keys.flatMap(k=>C[k].map(x=>[k,...x]));
  while(pool.length<p.days)pool=pool.concat(pool.map(x=>x));
  const meals=[];const used=new Set();for(let i=0;i<p.days;i++){let pick=pool.find(x=>!used.has(x[1]))||pool[i%pool.length];used.add(pick[1]);meals.push({day:i+1,cuisine:pick[0],name:pick[1],tags:['reserve'],ingredients:pick[2],steps:pick[3],tip:pick[4]})}
  const pantry=p.pantry.toLowerCase();const items=new Map();for(const m of meals)for(const ing of m.ingredients){const key=ing.replace(/^\d+[\d,.]*\s*(kg|g|dl|l|stk|boks|bokser|pose|fedd)?\s*/i,'').trim();if(!pantry.includes(key.toLowerCase()))items.set(key,(items.get(key)||0)+1)}
  const extras=[];
  if(p.dessert){const x={type:'dessert',name:'Eplesmuldrepai',ingredients:['6 epler','150 g havregryn','100 g hvetemel','120 g smør','80 g sukker','1 ts kanel'],steps:['Skjær eplene i biter.','Smuldre sammen havregryn, mel, smør, sukker og kanel.','Legg eplene i form og fordel smuldredeigen over.','Bak ved 200 C i ca. 25 minutter.'],tip:'Bruk epler som begynner å bli myke.'};extras.push(x)}
  if(p.baking){const x={type:'bakst',name:'Hjemmebakte havreboller',ingredients:['700 g hvetemel','200 g havregryn','1 pk tørrgjær','5 dl melk','75 g smør','1 ts salt'],steps:['Bland tørre ingredienser.','Tilsett lunken melk og smeltet smør.','Elt godt og hev til dobbel størrelse.','Form boller, etterhev og stek ved 220 C i 10–12 minutter.'],tip:'Bak dobbel porsjon og frys.'};extras.push(x)}
  for(const x of extras)for(const ing of x.ingredients)items.set(ing,(items.get(ing)||0)+1);
  return {aiAvailable:false,mode:'local-fallback',detected:[],notes:image?['Bildet ble mottatt, men bildeanalyse krever aktiv AI.']:[],meals,extras,shopping:[...items].map(([item,n])=>({item,quantity:n>1?`til ${n} retter`:'1 passende pakke',category:'Handleliste'})),savingTips:['Sjekk kjøleskap, fryser og tørrvarer før du handler.','Bruk de samme grønnsakene i flere retter.','Strekk kjøttdeig med revet gulrot, bønner eller linser der det passer.','Planlegg minst én restelunsj i uken.'],cookingTips:['Kutt grønnsaker til flere dager samtidig.','Frys porsjoner tidlig dersom de ikke skal brukes innen få dager.'],budgetTips:p.budget?[`Ukesbudsjett: ${p.budget} kr. Hold en buffer til basisvarer.`,`Sammenlign kilopris og kjøp store pakker bare når resten kan brukes eller fryses.`]:[]};
}
