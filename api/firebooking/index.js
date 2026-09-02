const { TableClient } = require('@azure/data-tables');
const crypto=require('crypto');
const TABLE='IansBooking',PARTITION='firecheck2026';
const DAYS=['2026-12-16','2026-12-17'],WINDOWS=['08:00–10:00','10:00–12:00','12:00–14:00','14:00–16:00'];
// TESTPERIODE: Åpen 2. september–2. oktober 2026. Før produksjon settes OPEN_AT tilbake til 30 dager før bekreftet kontrolldato.
const TEST_OPEN_AT=new Date('2026-09-02T00:00:00+02:00'),TEST_CLOSE_AT=new Date('2026-10-02T23:59:59+02:00');
const CONTROL_END=new Date('2026-12-17T23:59:59+01:00'),DELETE_AT=new Date('2026-12-31T23:59:59+01:00');
const RESIDENT_PASSWORD='BRANN2026';
function json(status,body){return{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)}}
function safeEqual(a,b){a=Buffer.from(String(a||''));b=Buffer.from(String(b||''));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function residentAllowed(req){return safeEqual(req.headers['x-booking-password'],RESIDENT_PASSWORD)}
function adminAllowed(req){const k=process.env.IANS_FIRE_ADMIN_KEY;return !!k&&safeEqual(req.headers['x-admin-key'],k)}
function client(){const cs=process.env.IANS_BOOKING_STORAGE||process.env.AzureWebJobsStorage;if(!cs)throw new Error('storage');return TableClient.fromConnectionString(cs,TABLE)}
function cleanUnit(v){return String(v||'').replace(/\D/g,'').slice(0,5)}
async function rows(tc){const a=[];for await(const e of tc.listEntities({queryOptions:{filter:`PartitionKey eq '${PARTITION}'`}}))a.push(e);return a}
async function purgeIfExpired(tc){if(new Date()<=DELETE_AT)return false;for(const r of await rows(tc))await tc.deleteEntity(PARTITION,r.rowKey).catch(()=>{});return true}
function bookingOpen(now){return now>=TEST_OPEN_AT&&now<=TEST_CLOSE_AT}
module.exports=async function(context,req){try{const tc=client();await tc.createTable().catch(e=>{if(e.statusCode!==409)throw e});const purged=await purgeIfExpired(tc),now=new Date();
if(req.method==='GET'&&req.query.admin==='1'){if(!adminAllowed(req)){context.res=json(401,{ok:false,error:'Feil administratorpassord.'});return}const all=await rows(tc),counts=WINDOWS.map(window=>({window,booked:all.filter(x=>x.window===window).length}));context.res=json(200,{ok:true,totalBooked:all.length,windows:counts,bookings:all.map(x=>({unit:x.rowKey,bruksenhet:x.bruksenhet||'',day:x.day,window:x.window,createdAt:x.createdAt,updatedAt:x.updatedAt}))});return}
if(req.method==='GET'){if(!residentAllowed(req)){context.res=json(401,{ok:false,error:'Passord kreves.'});return}const all=await rows(tc);context.res=json(200,{ok:true,open:bookingOpen(now),testMode:true,testOpenUntil:'2026-10-02',purged,totalBooked:all.length,days:DAYS,windows:WINDOWS.map(window=>({window,booked:all.filter(x=>x.window===window).length})),retentionDeleteAfter:'2026-12-31'});return}
if(req.method==='POST'){if(!residentAllowed(req)){context.res=json(401,{ok:false,error:'Feil passord.'});return}if(!bookingOpen(now)){context.res=json(403,{ok:false,error:'Testbookingen er stengt. Ordinær booking åpnes 30 dager før bekreftet kontroll.'});return}const b=req.body||{},unit=cleanUnit(b.unit),bruksenhet=String(b.bruksenhet||'').slice(0,10),day=String(b.day||''),window=String(b.window||'');if(!/^\d{3,5}$/.test(unit)||!DAYS.includes(day)||!WINDOWS.includes(window)){context.res=json(400,{ok:false,error:'Kontroller leilighet, dag og tidsintervall.'});return}const all=await rows(tc);if(all.some(r=>r.rowKey===unit)){context.res=json(409,{ok:false,error:'Denne leiligheten har allerede en booking. Kontakt styret via VIBBO dersom den skal endres.'});return}const nowIso=now.toISOString();await tc.createEntity({partitionKey:PARTITION,rowKey:unit,bruksenhet,day,window,createdAt:nowIso,updatedAt:nowIso});context.res=json(201,{ok:true,message:'Bestillingen er registrert.',booking:{unit,bruksenhet,day,window}});return}
if(req.method==='DELETE'){if(!adminAllowed(req)){context.res=json(401,{ok:false,error:'Feil administratorpassord.'});return}const unit=cleanUnit((req.body||{}).unit);if(!unit){context.res=json(400,{ok:false,error:'Leilighetsnummer mangler.'});return}await tc.deleteEntity(PARTITION,unit);context.res=json(200,{ok:true,message:'Bookingen er slettet.'});return}
context.res=json(405,{ok:false,error:'Metoden støttes ikke.'})}catch(e){context.log.error(e);context.res=json(500,{ok:false,error:'Bookingserveren er ikke tilgjengelig.'})}}
