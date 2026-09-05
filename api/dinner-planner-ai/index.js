module.exports=async function(context,req){
  if(req.method!=="POST"){context.res={status:405,jsonBody:{error:"Method not allowed"}};return}
  const b=req.body||{};
  const prefs={days:Math.max(1,Math.min(14,Number(b.days)||7)),adults:Math.max(1,Math.min(10,Number(b.adults)||2)),children:Math.max(0,Math.min(10,Number(b.children)||0)),priority:String(b.priority||"Sunt og økonomisk"),cuisines:Array.isArray(b.cuisines)?b.cuisines.slice(0,8):[],pantry:String(b.pantry||"").slice(0,3000),favorites:Array.isArray(b.favorites)?b.favorites.slice(0,30):[],budget:Math.max(0,Number(b.budget)||0),dessert:!!b.dessert,baking:!!b.baking};
  const image=typeof b.image==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(b.image)?b.image:null;
  const key=process.env.OPENAI_API_KEY;
  if(!key){const data=fallbackPlan(prefs,image);data.aiAvailable=false;data.notes.unshift("IANS AI er ikke konfigurert i Azure ennå. Planen under er laget av reservemotoren.");context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data};return}
  const sys=`Du er IANS Dinner Planner AI. Lag en praktisk, variert, sunn og økonomisk plan på norsk. Ta hensyn til kjøkkenstil, antall voksne/barn, ukesbudsjett, mat brukeren allerede har, favoritter/tags og valgfri dessert/bakst. Unngå samme middag flere ganger i planen. Hvis bilde er vedlagt, identifiser bare matvarer du med rimelig sikkerhet kan se; usikre observasjoner skal i notes. Handlelisten skal så langt mulig bare inneholde det som mangler. Gi konkrete, realistiske mengder. Legg inn budsjettips og minst ett forslag til hvordan redusere matsvinn eller bruke rester. Dersom dessert eller bakst er valgt skal dette inngå med full oppskrift og ingredienser i shopping. Returner KUN gyldig JSON uten markdown: {"aiAvailable":true,"detected":[],"notes":[],"meals":[{"day":1,"name":"","cuisine":"","tags":[],"ingredients":[],"steps":[],"tip":""}],"extras":[{"type":"dessert|bakst","name":"","ingredients":[],"steps":[],"tip":""}],"shopping":[{"item":"","quantity":"","category":""}],"savingTips":[],"cookingTips":[],"budgetTips":[]}.`;
  const content=[{type:"input_text",text:`Preferanser: ${JSON.stringify(prefs)}`}];
  if(image)content.push({type:"input_image",image_url:image});
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",instructions:sys,input:[{role:"user",content}]})});
    const body=await r.json();
    if(!r.ok){context.log.error("OpenAI",r.status,body?.error?.message);const data=fallbackPlan(prefs,image);data.aiAvailable=false;data.notes.unshift("AI-tjenesten svarte ikke. IANS viser reserveplan. Teknisk status: OpenAI "+r.status+".");context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data};return}
    let txt=typeof body.output_text==="string"?body.output_text:"";
    if(!txt)for(const item of body.output||[])for(const c of item.content||[])if(c.type==="output_text"&&c.text)txt+=c.text;
    txt=txt.trim().replace(/^```json\s*/i,"").replace(/```$/i,"");
    let data;try{data=JSON.parse(txt)}catch{context.log.error("Invalid JSON",txt.slice(0,500));data=fallbackPlan(prefs,image);data.aiAvailable=false;data.notes.unshift("AI svarte med ugyldig planformat. IANS viser reserveplan.")}
    if(!Array.isArray(data.meals)||!data.meals.length){data=fallbackPlan(prefs,image);data.aiAvailable=false;data.notes.unshift("AI svarte uten en gyldig middagsplan. IANS viser reserveplan.")}
    context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data}
  }catch(e){context.log.error(e);const data=fallbackPlan(prefs,image);data.aiAvailable=false;data.notes.unshift("AI-tjenesten er midlertidig utilgjengelig. IANS viser reserveplan.");context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data}}
};

function fallbackPlan(p,image){
  const catalog={
    "Filippinsk":[
      ["Chicken Adobo","Filippinsk",["kyllingfilet","jasminris","soyasaus","eddik","hvitløk","løk"],["Brun kyllingen lett.","Tilsett soyasaus, eddik, hvitløk og løk.","La småkoke til kyllingen er mør og gjennomstekt.","Server med ris."],"Lag ekstra til lunsj dagen etter."],
      ["Pork Giniling","Filippinsk",["svinekjøttdeig","jasminris","gulrot","paprika","tomat","løk"],["Stek kjøtt og løk.","Tilsett grønnsaker og tomat.","La småkoke til grønnsakene er møre.","Server med ris."],"Bruk grønnsaksrester fra kjøleskapet."],
      ["Chicken Tinola","Filippinsk",["kylling","jasminris","ingefær","hvitløk","løk","grønne grønnsaker"],["Kok kylling med ingefær, løk og hvitløk.","Tilsett grønnsaker mot slutten.","Smak til og server med ris."],"God for å bruke opp grønne grønnsaker."]
    ],
    "Nordisk":[
      ["Laks med poteter","Nordisk",["laks","poteter","brokkoli","gulrot","sitron"],["Kok poteter og grønnsaker.","Bak eller stek laksen til den er gjennomstekt.","Server med sitron."],"Kjøp familiepakke når kiloprisen er lavere."],
      ["Kjøttkaker og poteter","Nordisk",["kjøttkaker","poteter","gulrot","brun saus"],["Kok poteter og gulrøtter.","Varm kjøttkaker og saus.","Server sammen."],"Bruk rester til lunsj dagen etter."],
      ["Kyllingform","Nordisk",["kyllingfilet","poteter","brokkoli","gulrot","løk"],["Del alt i jevne biter.","Legg i ildfast form.","Bak til kyllingen er gjennomstekt og potetene møre."],"Én form gir lite oppvask og bruker rester godt."]
    ],
    "Europeisk":[
      ["Ovnsbakt kylling med rotgrønnsaker","Europeisk",["kylling","poteter","gulrot","løk","paprika"],["Kutt grønnsakene.","Legg alt i en form.","Krydre og bak til kyllingen er gjennomstekt."],"Lag nok til restelunsj."],
      ["Svinegryte med grønnsaker","Europeisk",["svinefilet","poteter","gulrot","løk","matfløte"],["Brun kjøttet.","Tilsett grønnsaker og væske.","La småkoke til mørt."],"Kan lages med rimeligere stykningsdel."],
      ["Fisk med ovnsgrønnsaker","Europeisk",["hvit fisk","poteter","brokkoli","gulrot","sitron"],["Bak grønnsakene først.","Legg fisken inn mot slutten.","Server med sitron."],"Frossen fisk kan være økonomisk."]
    ],
    "Italiensk":[
      ["Spaghetti Bolognese","Italiensk",["kjøttdeig","spaghetti","hakkede tomater","løk","gulrot","hvitløk"],["Stek kjøtt og løk.","Tilsett tomat og revet gulrot.","La sausen småkoke og server med pasta."],"Strekk kjøttdeigen med ekstra gulrot eller linser."],
      ["Kyllingpasta med tomat","Italiensk",["kyllingfilet","pasta","hakkede tomater","løk","hvitløk"],["Stek kylling og løk.","Tilsett tomat.","Vend inn kokt pasta."],"Lag dobbel saus og frys halvparten."],
      ["Pasta Primavera","Italiensk",["pasta","brokkoli","paprika","gulrot","parmesan"],["Kok pasta.","Stek grønnsakene raskt.","Vend alt sammen og topp med ost."],"Perfekt til grønnsaksrester."]
    ],
    "Britisk":[
      ["Cottage Pie","Britisk",["kjøttdeig","poteter","gulrot","løk","erter"],["Lag kjøttfyll med grønnsaker.","Lag potetmos.","Fordel mosen over fyllet og gratiner."],"Kan lages av rester fra kjøttmiddag."],
      ["Sausages and Mash","Britisk",["middagspølser","poteter","løk","gulrot"],["Stek pølsene.","Lag potetmos.","Server med løk og grønnsaker."],"Velg pølser på tilbud og frys resten."],
      ["Chicken Traybake","Britisk",["kylling","poteter","gulrot","løk","brokkoli"],["Legg alt på stekebrett.","Krydre.","Bak til gjennomstekt."],"Lite oppvask og enkelt å skalere."]
    ],
    "Amerikansk":[
      ["Homemade Burgers","Amerikansk",["kjøttdeig","burgerbrød","salat","tomat","løk","ost"],["Form burgere.","Stek dem gjennom.","Server med grønnsaker og brød."],"Lag burgerne selv fremfor ferdigformede."],
      ["Chicken Fajita Bowl","Amerikansk",["kyllingfilet","ris","paprika","løk","mais"],["Stek kylling og grønnsaker.","Server over ris.","Topp med mais."],"Bruk rester som lunsjbowl."],
      ["Mac & Cheese med grønnsaker","Amerikansk",["makaroni","ost","melk","brokkoli","gulrot"],["Kok makaroni.","Lag enkel ostesaus.","Vend inn grønnsaker og pasta."],"Bruk ost som allerede er åpnet."]
    ]
  };
  let keys=(p.cuisines||[]).filter(k=>catalog[k]);if(!keys.length)keys=["Filippinsk","Nordisk","Europeisk"];
  const pool=keys.flatMap(k=>catalog[k]||[]);const used=new Set(),meals=[];
  for(let i=0;i<p.days;i++){let pick=pool.find(m=>!used.has(m[0]))||pool[i%pool.length];if(!pick)break;used.add(pick[0]);meals.push({day:i+1,name:pick[0],cuisine:pick[1],tags:[],ingredients:pick[2],steps:pick[3],tip:pick[4]})}
  const pantry=p.pantry.toLowerCase(),items=new Map();for(const m of meals)for(const ing of m.ingredients)if(!pantry.includes(ing.toLowerCase()))items.set(ing,(items.get(ing)||0)+1);
  const extras=[];
  if(p.dessert){const x={type:"dessert",name:"Enkel eplesmuldrepai",ingredients:["epler","havregryn","smør","sukker","kanel"],steps:["Skjær eplene.","Bland havregryn, smør, sukker og kanel.","Fordel over eplene og bak til gyllen."],tip:"Bruk epler som begynner å bli myke."};extras.push(x);for(const ing of x.ingredients)if(!pantry.includes(ing.toLowerCase()))items.set(ing,(items.get(ing)||0)+1)}
  if(p.baking){const x={type:"bakst",name:"Hjemmebakte boller",ingredients:["hvetemel","melk","gjær","smør","sukker","kardemomme"],steps:["Lag en myk gjærdeig.","Hev til dobbel størrelse.","Form boller og etterhev.","Stek til gylne."],tip:"Bak dobbel porsjon og frys."};extras.push(x);for(const ing of x.ingredients)if(!pantry.includes(ing.toLowerCase()))items.set(ing,(items.get(ing)||0)+1)}
  return {aiAvailable:false,mode:"local-fallback",detected:[],notes:[...(image?["Bildet er mottatt, men bildeanalyse krever aktiv AI-tilkobling."]:[])],meals,extras,shopping:[...items].map(([item,n])=>({item,quantity:n>1?`til ${n} retter`:"1 passende pakke",category:"Handleliste"})),savingTips:["Sjekk kjøleskap, fryser og tørrvarer før du handler.","Bruk de samme grønnsakene i flere retter.","Hjemmebakt brød kan ofte gi lavere kostnad per brød enn butikkbrød; sammenlign med prisen du faktisk betaler.","Strekk kjøttdeig med revet gulrot, bønner eller linser der det passer.","Planlegg minst én restelunsj eller restemiddag i uken."],cookingTips:["Kutt grønnsaker til flere dager samtidig.","Frys porsjoner tidlig dersom de ikke skal brukes innen få dager.","Bruk rester i wok, suppe, omelett, wraps eller pastasaus."],budgetTips:p.budget?[`Ukesbudsjettet er ${p.budget} kr. Hold en liten buffer og prioriter planlagte varer fremfor impulskjøp.`,`Sammenlign kilopris og kjøp store pakker bare når resten faktisk kan brukes eller fryses.`]:[]};
}
