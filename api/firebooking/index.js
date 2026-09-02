const { TableClient } = require('@azure/data-tables');
const TABLE='IansBooking';
const PARTITION='firecheck2026';
const DAYS=['2026-12-16','2026-12-17'];
const WINDOWS=['08:00–10:00','10:00–12:00','12:00–14:00','14:00–16:00'];
const OPEN_AT=new Date('2026-11-16T00:00:00+01:00');
const CONTROL_END=new Date('2026-12-17T23:59:59+01:00');
const DELETE_AT=new Date('2026-12-31T23:59:59+01:00');
function json(status,body){return{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)}}
function client(){const cs=process.env.IANS_BOOKING_STORAGE||process.env.AzureWebJobsStorage;if(!cs)throw new Error('storage');return TableClient.fromConnectionString(cs,TABLE)}
function cleanUnit(v){return String(v||'').replace(/\D/g,'').slice(0,5)}
async function rows(tc){const a=[];for await(const e of tc.listEntities({queryOptions:{filter:`PartitionKey eq '${PARTITION}'`}}))a.push(e);return a}
async function purgeIfExpired(tc){if(new Date()<=DELETE_AT)return false;for(const r of await rows(tc))await tc.deleteEntity(PARTITION,r.rowKey).catch(()=>{});return true}
module.exports=async function(context,req){try{const tc=client();await tc.createTable().catch(e=>{if(e.statusCode!==409)throw e});const purged=await purgeIfExpired(tc);const now=new Date();if(req.method==='GET'){const all=await rows(tc);context.res=json(200,{ok:true,open:now>=OPEN_AT&&now<=CONTROL_END,purged,totalBooked:all.length,days:DAYS,windows:WINDOWS,retentionDeleteAfter:'2026-12-31'});return}if(req.method==='POST'){if(now<OPEN_AT){context.res=json(403,{ok:false,error:'Bookingen åpner 30 dager før kontrollen.'});return}if(now>CONTROL_END){context.res=json(403,{ok:false,error:'Bookingen er stengt.'});return}const b=req.body||{},unit=cleanUnit(b.unit),day=String(b.day||''),window=String(b.window||'');if(!/^\d{3,5}$/.test(unit)||!DAYS.includes(day)||!WINDOWS.includes(window)){context.res=json(400,{ok:false,error:'Kontroller leilighetsnummer, dag og tidsintervall.'});return}const all=await rows(tc);if(all.some(r=>r.rowKey===unit)){context.res=json(409,{ok:false,error:'Denne leiligheten har allerede en booking. Kontakt styret via VIBBO dersom den skal endres.'});return}const nowIso=now.toISOString();await tc.createEntity({partitionKey:PARTITION,rowKey:unit,day,window,createdAt:nowIso,updatedAt:nowIso});context.res=json(201,{ok:true,message:'Bestillingen er registrert.',booking:{unit,day,window}});return}context.res=json(405,{ok:false,error:'Metoden støttes ikke.'})}catch(e){context.log.error(e);context.res=json(500,{ok:false,error:'Bookingserveren er ikke tilgjengelig.'})}}
