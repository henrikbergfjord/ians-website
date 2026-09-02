const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const crypto = require('crypto');

const TABLE = 'IansContact';
const PARTITION = 'messages';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function storageClient(){
  const cs = process.env.IANS_BOOKING_STORAGE || process.env.AzureWebJobsStorage;
  if(!cs) throw new Error('Storage is not configured');
  return TableClient.fromConnectionString(cs, TABLE);
}
function clean(v,max){ return String(v||'').trim().slice(0,max); }
function json(status,body){ return {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body}; }

module.exports = async function(context, req){
  try{
    const b=req.body||{};
    const name=clean(b.name,120), type=clean(b.type,20), company=clean(b.company,160), email=clean(b.email,254).toLowerCase(), subject=clean(b.subject,180), message=clean(b.message,5000), website=clean(b.website,200);
    if(website) return context.res=json(200,{ok:true}); // honeypot
    if(name.length<2 || !['privat','firma'].includes(type) || !emailRe.test(email) || subject.length<3 || message.length<10){
      return context.res=json(400,{ok:false,error:'Kontroller navn, type, e-post, emne og melding.'});
    }
    if(type==='firma' && company.length<2) return context.res=json(400,{ok:false,error:'Skriv inn firmanavn.'});
    const client=storageClient(); await client.createTable().catch(()=>{});
    const now=new Date();
    const entity={partitionKey:PARTITION,rowKey:`${now.toISOString()}-${crypto.randomUUID()}`,name,type,company,email,subject,message,createdAt:now.toISOString(),status:'new',source:clean(b.source,300)};
    await client.createEntity(entity);
    context.res=json(201,{ok:true,message:'Takk. Henvendelsen er mottatt av IANS.'});
  }catch(e){ context.log.error(e); context.res=json(500,{ok:false,error:'Kunne ikke sende henvendelsen akkurat nå.'}); }
};
