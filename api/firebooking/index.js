'use strict';
const {TableClient}=require('@azure/data-tables');
const {hasAccess}=require('../sameie-access/index.js');
const {fireSettings}=require('../booking-settings.js');
const TABLE='IansBooking',PARTITION='firecheck2026';
const WINDOWS=['08:00–10:00','10:00–12:00','12:00–14:00','14:00–16:00'];
const RESIDENT_PASSWORD='BRANN2026';
const json=(status,body)=>({status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)});
const clean=(v,n=254)=>String(v||'').trim().slice(0,n);
function principal(req){try{return JSON.parse(Buffer.from(req.headers?.['x-ms-client-principal']||'','base64').toString('utf8'));}catch{return null;}}
async function adminAllowed(req){const email=clean(principal(req)?.userDetails).toLowerCase();return !!email&&!!(await hasAccess(email,'straumsfjellet-panorama','fire')).approved;}
function residentAllowed(req){const a=Buffer.from(String(req.headers?.['x-booking-password']||'')),b=Buffer.from(RESIDENT_PASSWORD);return a.length===b.length&&require('crypto').timingSafeEqual(a,b);}
function client(){const cs=process.env.IANS_BOOKING_STORAGE||process.env.AzureWebJobsStorage;if(!cs)throw Error('storage');return TableClient.fromConnectionString(cs,TABLE);}
async function rows(tc){const all=[];for await(const r of tc.listEntities({queryOptions:{filter:`PartitionKey eq '${PARTITION}'`}}))all.push(r);return all;}
module.exports=async function(context,req){try{
 const admin=req.method==='DELETE'||(req.method==='GET'&&req.query?.admin==='1');
 if(admin?!await adminAllowed(req):!residentAllowed(req)){context.res=json(admin?403:401,{ok:false,error:admin?'Du har ikke styretilgang.':'Passord kreves.'});return;}
 const config=fireSettings(),tc=client();await tc.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
 if(config.expired){for(const r of await rows(tc))await tc.deleteEntity(PARTITION,r.rowKey).catch(e=>{if(e.statusCode!==404)throw e;});}
 if(req.method==='GET'){
  const all=await rows(tc),windows=WINDOWS.map(window=>({window,booked:all.filter(x=>x.window===window).length}));
  if(admin){context.res=json(200,{ok:true,totalBooked:all.length,windows,bookings:all.map(x=>({unit:x.rowKey,bruksenhet:x.bruksenhet||'',name:x.name||'',email:x.email||'',phone:x.phone||'',address:x.address||'',day:x.day,window:x.window,createdAt:x.createdAt,updatedAt:x.updatedAt}))});return;}
  context.res=json(200,{ok:true,...config,purged:config.expired,totalBooked:all.length,windows});return;
 }
 if(req.method==='POST'){
  if(!config.open){context.res=json(403,{ok:false,error:config.confirmed?`Booking er stengt. Planlagt åpning: ${config.opensOn}.`:'Testperioden er avsluttet. Ordinær booking venter på bekreftede kontrolldatoer.'});return;}
  const b=req.body||{},unit=String(b.unit||'').replace(/\D/g,'').slice(0,5),bruksenhet=clean(b.bruksenhet,10),day=clean(b.day,10),window=clean(b.window,30);
  if(!/^\d{3,5}$/.test(unit)||!config.days.includes(day)||!WINDOWS.includes(window)){context.res=json(400,{ok:false,error:'Kontroller leilighet, dag og tidsintervall.'});return;}
  const all=await rows(tc);if(all.some(r=>r.rowKey===unit)){context.res=json(409,{ok:false,error:'Denne leiligheten har allerede en booking. Kontakt styret via VIBBO ved endring.'});return;}
  const now=new Date().toISOString();
  // Only the current form's minimal fields are stored. Extra identity/contact fields are ignored.
  try{await tc.createEntity({partitionKey:PARTITION,rowKey:unit,bruksenhet,day,window,createdAt:now,updatedAt:now});}catch(e){if(e.statusCode===409){context.res=json(409,{ok:false,error:'Leiligheten ble nettopp booket. Kontakt styret ved behov.'});return;}throw e;}
  context.res=json(201,{ok:true,message:'Bestillingen er registrert.',booking:{unit,bruksenhet,day,window}});return;
 }
 if(req.method==='DELETE'){
  const unit=String(req.body?.unit||'').replace(/\D/g,'').slice(0,5);if(!unit){context.res=json(400,{ok:false,error:'Leilighetsnummer mangler.'});return;}
  await tc.deleteEntity(PARTITION,unit).catch(e=>{if(e.statusCode!==404)throw e;});context.res=json(200,{ok:true,message:'Bookingen er slettet.'});return;
 }
 context.res=json(405,{ok:false,error:'Metoden støttes ikke.'});
}catch(e){context.log.error(e);context.res=json(500,{ok:false,error:'Bookingserveren er ikke tilgjengelig.'});}};
