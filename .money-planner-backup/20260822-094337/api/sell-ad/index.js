// Azure Static Web Apps API: /api/sell-ad
// Uses the same OPENAI_API_KEY as Money Planner AI.
// Product photos are sent only when the user explicitly runs the ad generator.

module.exports = async function(context, req){
  if(req.method!=="POST"){context.res={status:405,jsonBody:{error:"Method not allowed"}};return}
  const key=process.env.OPENAI_API_KEY;
  if(!key){context.res={status:503,jsonBody:{error:"AI is not configured."}};return}

  const b=req.body||{};
  const product=String(b.product||"").slice(0,200);
  const details=String(b.details||"").slice(0,3000);
  const condition=String(b.condition||"").slice(0,100);
  const images=Array.isArray(b.images)?b.images.slice(0,6).filter(x=>typeof x==="string"&&x.startsWith("data:image/")):[];
  if(!product){context.res={status:400,jsonBody:{error:"Product is required."}};return}

  const content=[
    {type:"input_text",text:`Produkt: ${product}\nTilstand: ${condition}\nOpplysninger fra selger: ${details||"Ingen ekstra opplysninger."}`}
  ];
  for(const img of images) content.push({type:"input_image",image_url:img});

  const instructions=`Du lager et annonseutkast for en privat selger i Norge.
Analyser bare det som faktisk kan støttes av brukerens tekst og bilder. Ikke finn på merke, modell, alder, størrelse eller tilbehør.
Skriv en troverdig norsk tittel og annonsetekst som passer bruktmarked.
Gi tre prisnivåer i NOK: priceFast, priceFair, priceTry. Prisene er grove estimater basert på tilgjengelig informasjon og modellkunnskap, IKKE live data fra FINN.no. Hvis grunnlaget er svakt, bruk brede intervaller og si det i teksten.
Ikke påstå at du har sett aktive annonser eller dagens markedspris.
Svar KUN som gyldig JSON med feltene title, body, priceFast, priceFair, priceTry.`;

  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({
      model:process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
      instructions,
      input:[{role:"user",content}]
    })});
    const data=await r.json();
    if(!r.ok){context.log.error("OpenAI sell-ad",r.status,data?.error?.message);context.res={status:502,jsonBody:{error:"AI request failed."}};return}
    const txt=extract(data);
    let parsed;
    try{parsed=JSON.parse(txt.replace(/^```json\s*|\s*```$/g,"").trim())}
    catch{context.log.error("Invalid JSON",txt);context.res={status:502,jsonBody:{error:"AI returned invalid ad data."}};return}
    context.res={status:200,headers:{"Cache-Control":"no-store"},jsonBody:parsed};
  }catch(e){context.log.error(e);context.res={status:500,jsonBody:{error:"AI service unavailable."}}}
};
function extract(body){
  if(typeof body.output_text==="string")return body.output_text;
  const p=[];for(const item of body.output||[])for(const c of item.content||[])if(c.type==="output_text"&&c.text)p.push(c.text);
  return p.join("\n");
}