module.exports=async function(context,req){
  if(req.method!=="POST"){context.res={status:405,jsonBody:{error:"Method not allowed"}};return}
  const b=req.body||{};
  const prefs={days:Math.max(1,Math.min(14,Number(b.days)||7)),adults:Math.max(1,Math.min(10,Number(b.adults)||2)),children:Math.max(0,Math.min(10,Number(b.children)||0)),priority:String(b.priority||"both"),cuisines:Array.isArray(b.cuisines)?b.cuisines.slice(0,6):[],pantry:String(b.pantry||"").slice(0,3000),favorites:Array.isArray(b.favorites)?b.favorites.slice(0,30):[]};
  const image=typeof b.image==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(b.image)?b.image:null;
  const key=process.env.OPENAI_API_KEY;
  if(!key){
    const data=fallbackPlan(prefs,image);
    context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data};
    return;
  }
  const sys=`Du er IANS Dinner Planner AI. Lag en praktisk, sunn og økonomisk middagsplan. Bruk norske råvarenavn og realistiske oppskrifter. Ta hensyn til kjøkkenpreferanser, antall voksne/barn, prioritet, mat brukeren oppgir at de har, og favoritter/tags. Unngå å gjenta middager i samme plan med mindre det er nødvendig. Favoritter kan inngå, men ikke nødvendigvis hver uke. Hvis et kjøleskapsbilde er vedlagt, identifiser bare matvarer du med rimelig sikkerhet kan se; marker usikre observasjoner i notes og ikke gjett. Handlelisten skal i størst mulig grad bare inneholde det som mangler. Oppskrifter skal ha ingredients og steps. Returner KUN gyldig JSON uten markdown i dette formatet: {"detected":[],"notes":[],"meals":[{"day":1,"name":"","cuisine":"","tags":[],"ingredients":[],"steps":[],"tip":""}],"shopping":[{"item":"","quantity":"","category":""}],"savingTips":[],"cookingTips":[]}.`;
  const text=`Preferanser: ${JSON.stringify(prefs)}`;
  const content=[{type:"input_text",text}];
  if(image)content.push({type:"input_image",image_url:image});
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",instructions:sys,input:[{role:"user",content}]})});
    const body=await r.json();
    if(!r.ok){context.log.error("OpenAI",r.status,body?.error?.message);const data=fallbackPlan(prefs,image);data.notes.unshift("AI-tjenesten svarte ikke. IANS viser derfor en lokal reserveplan uten bildeanalyse.");context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data};return}
    let txt=typeof body.output_text==="string"?body.output_text:"";
    if(!txt)for(const item of body.output||[])for(const c of item.content||[])if(c.type==="output_text"&&c.text)txt+=c.text;
    txt=txt.trim().replace(/^```json\s*/i,"").replace(/```$/i,"");
    let data;try{data=JSON.parse(txt)}catch{context.log.error("Invalid JSON",txt.slice(0,500));data=fallbackPlan(prefs,image);data.notes.unshift("AI returnerte et ugyldig planformat. IANS viser derfor en lokal reserveplan.")}
    context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data}
  }catch(e){context.log.error(e);const data=fallbackPlan(prefs,image);data.notes.unshift("AI-tjenesten er midlertidig utilgjengelig. IANS viser derfor en lokal reserveplan.");context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data}}
};

function fallbackPlan(p,image){
  const catalog={
    fil:[
      ["Chicken Adobo","Filippinsk",["kyllingfilet","jasminris","soyasaus","eddik","hvitløk","løk"],["Brun kyllingen lett.","Tilsett soyasaus, eddik, hvitløk og løk.","La småkoke til kyllingen er gjennomstekt og mør.","Server med ris."],"Lag gjerne ekstra adobo til lunsj dagen etter."],
      ["Pork Giniling","Filippinsk",["svinekjøttdeig","jasminris","gulrot","paprika","tomat","løk"],["Stek kjøtt og løk.","Tilsett grønnsaker og tomat.","La småkoke til grønnsakene er møre.","Server med ris."],"Bruk grønnsaksrester fra kjøleskapet."],
      ["Chicken Tinola","Filippinsk",["kylling","jasminris","ingefær","hvitløk","løk","grønne grønnsaker"],["Kok kylling med ingefær, løk og hvitløk.","Tilsett grønnsaker mot slutten.","Smak til og server med ris."],"En god rett for å bruke opp grønne grønnsaker."]
    ],
    thai:[
      ["Thai Chicken Stir-fry","Thai",["kyllingfilet","jasminris","brokkoli","paprika","hvitløk","lime"],["Wok kyllingen raskt.","Tilsett grønnsakene.","Smak til med lime og litt soyasaus.","Server med ris."],"Kutt grønnsakene på forhånd for rask middag."],
      ["Thai Coconut Curry","Thai",["kyllingfilet","jasminris","kokosmelk","brokkoli","paprika","currypaste"],["Stek currypaste kort.","Tilsett kokosmelk og kylling.","Ha i grønnsakene og la småkoke.","Server med ris."],"Frys resten av kokosmelken dersom boksen ikke brukes opp."],
      ["Thai Pork Noodles","Thai",["svinefilet","nudler","gulrot","vårløk","hvitløk","lime"],["Kok nudlene.","Wok svinekjøtt og grønnsaker.","Vend inn nudler og lime."],"God restemiddag med små mengder grønnsaker."]
    ],
    nord:[
      ["Laks med poteter","Nordisk",["laks","poteter","brokkoli","gulrot","sitron"],["Kok poteter og grønnsaker.","Bak eller stek laksen til den er gjennomstekt.","Server med sitron."],"Kjøp familiepakke når kiloprisen er lavere."],
      ["Kjøttkaker og poteter","Nordisk",["kjøttkaker","poteter","gulrot","brun saus"],["Kok poteter og gulrøtter.","Varm kjøttkaker og saus.","Server sammen."],"Bruk rester til lunsj eller brødmat dagen etter."],
      ["Kyllingform","Nordisk",["kyllingfilet","poteter","brokkoli","gulrot","løk"],["Del alt i jevne biter.","Legg i ildfast form.","Bak til kyllingen er gjennomstekt og potetene møre."],"Én form gir lite oppvask og kan bruke mange rester."]
    ]
  };
  const keys=p.cuisines.length?p.cuisines.filter(k=>catalog[k]):["fil","thai","nord"];
  const pool=keys.flatMap(k=>catalog[k]);
  const favNames=(p.favorites||[]).map(x=>String(x.name||x)).filter(Boolean);
  const used=new Set(),meals=[];
  for(let i=0;i<p.days;i++){
    let pick=null;
    if(i===0&&favNames.length){pick=pool.find(m=>favNames.some(f=>m[0].toLowerCase().includes(f.toLowerCase())))}
    if(!pick)pick=pool.find(m=>!used.has(m[0]))||pool[i%pool.length];
    used.add(pick[0]);
    meals.push({day:i+1,name:pick[0],cuisine:pick[1],tags:favNames.some(f=>pick[0].toLowerCase().includes(f.toLowerCase()))?["favoritt"]:[],ingredients:pick[2],steps:pick[3],tip:pick[4]});
  }
  const pantry=p.pantry.toLowerCase();
  const items=new Map();
  for(const m of meals)for(const ing of m.ingredients){if(!pantry.includes(ing.toLowerCase()))items.set(ing,(items.get(ing)||0)+1)}
  return {mode:"local-fallback",detected:[],notes:["AI-nøkkel er ikke konfigurert i Azure akkurat nå. Denne planen er laget lokalt av IANS-reservemotoren.",...(image?["Bildet ble mottatt, men kan ikke analyseres uten aktiv AI-tilkobling."]:[])],meals,shopping:[...items].map(([item,n])=>({item,quantity:n>1?`til ${n} middager`:"1 passende pakke",category:"Handleliste"})),savingTips:["Sjekk kjøleskap, fryser og tørrvarer før du handler.","Bruk de samme grønnsakene på tvers av flere middager.","Velg butikkens egne merkevarer når kvaliteten er god.","Frys porsjoner tidlig hvis de ikke skal brukes innen få dager."],cookingTips:["Planlegg kutting av grønnsaker for flere dager samtidig.","Kjøl kokt ris raskt ned og oppbevar kaldt før eventuell gjenoppvarming.","Bruk rester i wok, suppe, omelett eller lunsj dagen etter."]};
}
