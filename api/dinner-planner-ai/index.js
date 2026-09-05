module.exports=async function(context,req){
  if(req.method!=="POST"){context.res={status:405,jsonBody:{error:"Method not allowed"}};return}
  const b=req.body||{};
  const prefs={
    days:Math.max(1,Math.min(14,Number(b.days)||7)),adults:Math.max(1,Math.min(10,Number(b.adults)||2)),children:Math.max(0,Math.min(10,Number(b.children)||0)),priority:String(b.priority||"Sunt og økonomisk"),
    cuisines:Array.isArray(b.cuisines)?b.cuisines.slice(0,8):[],pantry:String(b.pantry||"").slice(0,3000),favorites:Array.isArray(b.favorites)?b.favorites.slice(0,30):[],
    extras:Array.isArray(b.extras)?b.extras.slice(0,6):[],weeklyBudget:Math.max(0,Math.min(20000,Number(b.weeklyBudget)||0))
  };
  const image=typeof b.image==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(b.image)?b.image:null;
  const key=process.env.OPENAI_API_KEY;
  if(!key){context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:fallbackPlan(prefs,image)};return}
  const sys=`Du er IANS Dinner Planner AI. Lag en variert, praktisk, sunn og økonomisk matplan på norsk. Matpreg kan være Filippinsk, Nordisk, Europeisk, Italiensk, Britisk eller Amerikansk. Unngå unødvendige gjentakelser. Ta hensyn til antall personer, mat de allerede har, favoritter/tags og ukesbudsjett. Dersom budsjett er oppgitt skal planen prioritere råvarer som kan brukes flere ganger og forklare hvordan brukeren kan holde seg innenfor budsjettet. Ikke påstå live butikkpriser. Pris-/spareeksempler må merkes som anslag og avhenge av lokale priser.
Hvis extras inneholder Dessert og/eller Boller/bakst, lag egne fullstendige oppskrifter for dette og ta alle manglende ingredienser med i samme handleliste. Hvis bilde er vedlagt, identifiser bare synlige matvarer med rimelig sikkerhet; ikke gjett. Handlelisten skal i størst mulig grad trekke fra det brukeren allerede har.
Gi konkrete matsparingstips, f.eks. når hjemmebakt brød/boller kan være billigere enn butikkjøpt, hvordan større kjøttpakker eller hjemmelagde kjøttdeigretter kan strekkes med grønnsaker/belgvekster, og hvordan rester kan bli lunsj, wok, suppe, omelett eller ny middag. Ikke anbefal risikabel oppbevaring.
Returner KUN gyldig JSON uten markdown: {"detected":[],"notes":[],"meals":[{"day":1,"name":"","cuisine":"","tags":[],"ingredients":[],"steps":[],"tip":""}],"extras":[{"day":"Bonus","name":"","cuisine":"Bakst/Dessert","tags":[],"ingredients":[],"steps":[],"tip":""}],"shopping":[{"item":"","quantity":"","category":""}],"budget":{"weekly":0,"strategy":"","allocation":[],"stayOnTrack":[]},"savingIdeas":[{"title":"","text":"","monthlyPotential":""}],"savingTips":[],"cookingTips":[]}.`;
  const content=[{type:"input_text",text:`Preferanser: ${JSON.stringify(prefs)}`}];if(image)content.push({type:"input_image",image_url:image});
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",instructions:sys,input:[{role:"user",content}]})});
    const body=await r.json();if(!r.ok){context.log.error("OpenAI",r.status,body?.error?.message);const d=fallbackPlan(prefs,image);d.notes.unshift("AI-tjenesten svarte ikke. IANS viser en lokal reserveplan.");context.res={status:200,jsonBody:d};return}
    let txt=typeof body.output_text==="string"?body.output_text:"";if(!txt)for(const item of body.output||[])for(const c of item.content||[])if(c.type==="output_text"&&c.text)txt+=c.text;txt=txt.trim().replace(/^```json\s*/i,"").replace(/```$/i,"");
    let data;try{data=JSON.parse(txt)}catch{data=fallbackPlan(prefs,image);data.notes.unshift("AI returnerte ugyldig planformat. IANS viser en lokal reserveplan.")}
    context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:data}
  }catch(e){context.log.error(e);const d=fallbackPlan(prefs,image);d.notes.unshift("AI-tjenesten er midlertidig utilgjengelig. IANS viser en lokal reserveplan.");context.res={status:200,jsonBody:d}}
};

function fallbackPlan(p,image){
  const C={
    "Filippinsk":[
      ["Chicken Adobo",["kyllingfilet","jasminris","soyasaus","eddik","hvitløk","løk"],["Brun kyllingen.","Tilsett soyasaus, eddik, hvitløk og løk.","La småkoke til gjennomstekt.","Server med ris."],"Lag ekstra til lunsj."],
      ["Pork Giniling",["svinekjøttdeig","jasminris","gulrot","paprika","tomat","løk"],["Stek kjøtt og løk.","Tilsett grønnsaker og tomat.","La småkoke og server med ris."],"Strekk kjøttet med ekstra grønnsaker."],
      ["Chicken Tinola",["kylling","jasminris","ingefær","hvitløk","løk","grønne grønnsaker"],["Kok kylling med ingefær, løk og hvitløk.","Tilsett grønnsaker mot slutten.","Server med ris."],"Bruk grønnsaker som må spises først."]],
    "Nordisk":[
      ["Laks med poteter",["laks","poteter","brokkoli","gulrot","sitron"],["Kok poteter og grønnsaker.","Bak laks til gjennomstekt.","Server med sitron."],"Familiepakke kan gi lavere kilopris."],
      ["Kjøttkaker og poteter",["kjøttkaker","poteter","gulrot","brun saus"],["Kok poteter og gulrot.","Varm kjøttkaker og saus.","Server sammen."],"Bruk rester på brød eller til lunsj."],
      ["Kyllingform",["kyllingfilet","poteter","brokkoli","gulrot","løk"],["Del i biter.","Legg i form.","Bak til alt er mørt og gjennomstekt."],"Én form gir lite oppvask."]],
    "Europeisk":[
      ["Kyllinggryte med grønnsaker",["kyllingfilet","poteter","gulrot","løk","paprika","kraft"],["Brun kylling.","Tilsett grønnsaker og kraft.","La småkoke til mørt."],"Lag dobbelt og frys porsjoner."],
      ["Ovnsbakt svin med rotgrønnsaker",["svinefilet","poteter","gulrot","løk","urter"],["Krydre kjøttet.","Bak med grønnsaker til gjennomstekt."],"Bruk sesonggrønnsaker."],
      ["Vegetarisk linsegryte",["linser","tomat","gulrot","løk","hvitløk","brød"],["Stek løk og hvitløk.","Tilsett linser, tomat og gulrot.","La småkoke."],"Billig middag med god metthet."]],
    "Italiensk":[
      ["Spaghetti Bolognese",["kjøttdeig","spaghetti","hakkede tomater","løk","gulrot","hvitløk"],["Stek kjøtt og løk.","Tilsett tomat og finrevet gulrot.","La sausen koke og server med pasta."],"Gulrot eller linser kan strekke kjøttdeigen."],
      ["Kylling pasta",["kyllingfilet","pasta","tomat","spinat","hvitløk"],["Stek kylling.","Kok pasta.","Vend sammen med tomat, spinat og hvitløk."],"Bruk rester i lunsjboks."],
      ["Minestrone",["bønner","pasta","tomat","gulrot","løk","selleri"],["Kutt grønnsaker.","Kok med tomat og bønner.","Tilsett pasta mot slutten."],"Perfekt restesuppe."]],
    "Britisk":[
      ["Cottage Pie",["kjøttdeig","poteter","gulrot","løk","erter"],["Lag kjøttsaus med grønnsaker.","Topp med potetmos.","Bak gyllen."],"Kan lages av rester av kjøttsaus."],
      ["Fish Pie",["hvit fisk","poteter","gulrot","erter","melk"],["Kok poteter til mos.","Legg fisk og grønnsaker i form.","Topp med mos og bak."],"Bruk rimelig hvit fisk."],
      ["Sausage & Mash",["middagspølser","poteter","løk","gulrot","saus"],["Stek pølser.","Lag potetmos.","Server med løk og grønnsaker."],"Enkel familierett."]],
    "Amerikansk":[
      ["Chicken Tacos",["kyllingfilet","tortilla","salat","tomat","mais","rømme"],["Stek krydret kylling.","Kutt grønnsaker.","Fyll tortillaene."],"Bruk rester til wrap dagen etter."],
      ["Homemade Burgers",["kjøttdeig","burgerbrød","poteter","salat","tomat"],["Form burgere.","Stek gjennom.","Server med ovnspoteter og salat."],"Hjemmelagde burgere gir kontroll på porsjonene."],
      ["Chicken & Rice Bowl",["kyllingfilet","ris","mais","bønner","paprika","lime"],["Stek kylling og paprika.","Kok ris.","Bygg skåler med bønner og mais."],"Rimelig måte å bruke rester av ris og grønt."]]
  };
  const keys=p.cuisines.length?p.cuisines.filter(k=>C[k]):["Filippinsk","Nordisk","Europeisk","Italiensk"];
  let pool=keys.flatMap(k=>C[k].map(x=>[x[0],k,x[1],x[2],x[3]]));if(!pool.length)pool=C["Nordisk"].map(x=>[x[0],"Nordisk",x[1],x[2],x[3]]);
  const used=new Set(),meals=[];for(let i=0;i<p.days;i++){const pick=pool.find(m=>!used.has(m[0]))||pool[i%pool.length];used.add(pick[0]);meals.push({day:i+1,name:pick[0],cuisine:pick[1],tags:[],ingredients:pick[2],steps:pick[3],tip:pick[4]})}
  const extras=[];
  if(p.extras.includes("Dessert"))extras.push({day:"Bonus",name:"Eplecrumble",cuisine:"Dessert",tags:["dessert","økonomisk"],ingredients:["epler","havregryn","hvetemel","smør","sukker","kanel"],steps:["Skjær epler i biter.","Bland havregryn, mel, smør, sukker og kanel til smuler.","Bak til eplene er møre og toppen gyllen."],tip:"Bruk epler som begynner å bli myke."});
  if(p.extras.includes("Boller/bakst"))extras.push({day:"Bonus",name:"Hjemmelagde havreboller",cuisine:"Bakst",tags:["bakst","frysbar"],ingredients:["hvetemel","havregryn","gjær","melk","smør","salt"],steps:["Lag en myk gjærdeig.","La heve.","Form boller og etterhev.","Stek til gylne og gjennomstekte."],tip:"Frys ned og ta opp etter behov."});
  const pantry=p.pantry.toLowerCase(),items=new Map();for(const m of [...meals,...extras])for(const ing of m.ingredients)if(!pantry.includes(ing.toLowerCase()))items.set(ing,(items.get(ing)||0)+1);
  const budget=p.weeklyBudget||0;
  return {mode:"local-fallback",detected:[],notes:["Planen er laget av IANS-reservemotoren.",...(image?["Bildet kan ikke analyseres uten aktiv AI-tilkobling."]:[])],meals,extras,shopping:[...items].map(([item,n])=>({item,quantity:n>1?`til ${n} retter`:"1 passende pakke",category:category(item)})),budget:{weekly:budget,strategy:budget?`Planlegg innkjøpet rundt ${budget} kr, bruk det dere har først og behold en liten buffer til melk/brød/frukt.`:"Legg inn et ukesbudsjett for mer målrettede råd.",allocation:budget?[`Ca. 35–40 % protein/fisk/kjøtt`,`Ca. 20–25 % frukt og grønt`,`Ca. 15–20 % meieri/brød`,`Resten til tørrvarer og buffer`]:[],stayOnTrack:["Skriv handleliste før butikken og unngå impulskjøp.","Sammenlign kilopris, ikke bare pakkepris.","Planlegg minst én restemiddag/lunsj.","Frys ned porsjoner før de blir dårlige."]},savingIdeas:[{title:"Bak brød eller boller selv",text:"Mel, havre og gjær er ofte rimelige basisvarer. Sammenlign kostnaden per brød med det du vanligvis kjøper; gevinsten blir størst hvis du baker flere om gangen og fryser.",monthlyPotential:"Mulig månedsbesparelse avhenger av hvor mange brød dere kjøper og lokale priser."},{title:"Strekk kjøttdeigen",text:"Bland inn finrevet gulrot, bønner eller linser i enkelte gryter og sauser. Det kan gi flere porsjoner uten å kjøpe mer kjøtt.",monthlyPotential:"Kan redusere kjøttforbruket over tid uten at alle middager blir vegetariske."},{title:"Restemat som planlagt måltid",text:"Sett av én lunsj eller middag i uken til rester. Wok, suppe, omelett og wraps er gode måter å bruke små mengder på.",monthlyPotential:"Mindre matsvinn betyr at en større del av ukesbudsjettet faktisk blir spist."}],savingTips:["Bruk samme råvare i flere retter samme uke.","Velg egne merkevarer når kvalitet og kilopris er gode.","Kjøp større pakker bare når resten kan fryses eller planlegges brukt."],cookingTips:["Forbered grønnsaker til flere middager samtidig.","Kjøl rester raskt ned og oppbevar dem forsvarlig.","Merk fryseposer med innhold og dato."]};
}
function category(x){x=x.toLowerCase();if(/kylling|kjøtt|svin|laks|fisk|pølse/.test(x))return"Kjøtt og fisk";if(/potet|gulrot|løk|tomat|salat|brokkoli|epl|lime|paprika|spinat|selleri/.test(x))return"Frukt og grønt";if(/melk|smør|rømme/.test(x))return"Kjøl";if(/mel|havre|gjær|sukker|ris|pasta|spaghetti|linser|bønner/.test(x))return"Tørrvarer";return"Annet"}
