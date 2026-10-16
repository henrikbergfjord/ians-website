'use strict';
const {TableClient}=require('@azure/data-tables');
const {hasAccess}=require('../sameie-access/index.js');
const TABLE='IansBooking',PARTITION='sprinkler2028',SLOT='__slot_';
const WINDOWS=['08:00–10:00','10:00–12:00','12:00–14:00','14:00–16:00'],CAPACITY=24;
const json=(status,body)=>({status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)});
const clean=(v,n=254)=>String(v||'').trim().slice(0,n);
const storageConnection=()=>process.env.IANS_BOOKING_STORAGE||process.env.AzureWebJobsStorage;
function client(){if(!storageConnection())throw Error('storage');return TableClient.fromConnectionString(storageConnection(),TABLE);}
const cleanPhone=v=>String(v||'').replace(/[^0-9+]/g,'').slice(0,16);
const cleanUnit=v=>clean(v,80).replace(/[\\/#?\u0000-\u001f\u007f]/g,'-').replace(/[^A-Za-z0-9 ._\-]/g,' ').replace(/\s+/g,' ').trim();
function principal(req){try{return JSON.parse(Buffer.from(req.headers?.['x-ms-client-principal']||'','base64').toString('utf8'));}catch{return null;}}
async function adminAllowed(req){const email=clean(principal(req)?.userDetails).toLowerCase();return !!email&&!!(await hasAccess(email,'straumsfjellet-panorama','sprinkler')).approved;}
const isBooking=r=>!String(r.rowKey||'').startsWith(SLOT);
async function entities(tc){const all=[];for await(const e of tc.listEntities({queryOptions:{filter:`PartitionKey eq '${PARTITION}'`}}))all.push(e);return all;}
function summary(all){const rows=all.filter(isBooking);return{capacity:CAPACITY,totalBooked:rows.length,windows:WINDOWS.map(window=>{const booked=rows.filter(r=>r.window===window).length;return{window,booked,available:Math.max(0,CAPACITY-booked)};})};}
module.exports=async function(context,req){try{
 if(req.method==='GET'&&String(req.query?.health||'')==='1'){context.res=json(200,{ok:true,service:'IANS Booking API',storageConfigured:!!storageConnection()});return;}
 const admin=req.method==='DELETE'||(req.method==='GET'&&String(req.query?.admin||'')==='1');
 if(admin&&!await adminAllowed(req)){context.res=json(403,{ok:false,error:'Du har ikke styretilgang.'});return;}
 const tc=client();await tc.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
 if(req.method==='GET'){
  const all=await entities(tc),rows=all.filter(isBooking);
  if(admin){context.res=json(200,{ok:true,...summary(all),bookings:rows.map(r=>({unit:r.rowKey,address:r.address||'',name:r.name||'',email:r.email||'',phone:r.phone||'',window:r.window||'',updatedAt:r.updatedAt||'',createdAt:r.createdAt||''})).sort((a,b)=>a.window.localeCompare(b.window)||a.unit.localeCompare(b.unit,'no',{numeric:true}))});return;}
  context.res=json(200,{ok:true,...summary(all)});return;
 }
 if(req.method==='POST'){
  const b=req.body||{},unit=cleanUnit(b.unit),phone=cleanPhone(b.phone),window=clean(b.window,30);
  if(!unit||unit.startsWith(SLOT)||!/^\+?\d{8,15}$/.test(phone)||!WINDOWS.includes(window)){context.res=json(400,{ok:false,error:'Velg leilighet, gyldig telefonnummer og tidsvindu.'});return;}
  const all=await entities(tc),rows=all.filter(isBooking);
  if(rows.some(r=>r.rowKey===unit)){context.res=json(409,{ok:false,error:'Denne leiligheten er allerede booket. Kontakt styret ved endring.'});return;}
  if(rows.filter(r=>r.window===window).length>=CAPACITY){context.res=json(409,{ok:false,error:'Dette tidsvinduet er fullt. Velg et annet.',summary:summary(all)});return;}
  // Legacy bookings occupy an implicit prefix. New bookings and their unique capacity
  // slot are created in one Azure transaction, so concurrent requests cannot exceed 24.
  const legacy=rows.filter(r=>r.window===window&&!r.slotRowKey).length;
  const occupied=new Set(all.filter(r=>!isBooking(r)).map(r=>r.rowKey));
  for(let i=legacy;i<CAPACITY;i++){
   const slotRowKey=`${SLOT}${WINDOWS.indexOf(window)}_${i}`;if(occupied.has(slotRowKey))continue;
   const now=new Date().toISOString();
   try{
    await tc.submitTransaction([
     ['create',{partitionKey:PARTITION,rowKey:unit,phone,window,slotRowKey,createdAt:now,updatedAt:now}],
     ['create',{partitionKey:PARTITION,rowKey:slotRowKey,unit,window,kind:'capacity-slot'}]
    ]);
    context.res=json(201,{ok:true,message:'Leiligheten er booket.',booking:{unit,window},summary:summary(await entities(tc))});return;
   }catch(e){
    if(e.statusCode!==409)throw e;
    try{await tc.getEntity(PARTITION,unit);context.res=json(409,{ok:false,error:'Leiligheten ble nettopp booket. Kontakt styret ved behov.'});return;}catch(found){if(found.statusCode!==404)throw found;}
   }
  }
  context.res=json(409,{ok:false,error:'Tidsvinduet ble nettopp fullt. Velg et annet.',summary:summary(await entities(tc))});return;
 }
 if(req.method==='DELETE'){
  const unit=cleanUnit(req.body?.unit||req.query?.unit);if(!unit||unit.startsWith(SLOT)){context.res=json(400,{ok:false,error:'Leilighet mangler.'});return;}
  let row;try{row=await tc.getEntity(PARTITION,unit);}catch(e){if(e.statusCode!==404)throw e;}
  if(row?.slotRowKey){await tc.submitTransaction([['delete',{partitionKey:PARTITION,rowKey:unit}],['delete',{partitionKey:PARTITION,rowKey:row.slotRowKey}]]);}
  else if(row)await tc.deleteEntity(PARTITION,unit);
  context.res=json(200,{ok:true,message:'Bestillingen er slettet.'});return;
 }
 context.res=json(405,{ok:false,error:'Metoden støttes ikke.'});
}catch(e){context.log.error(e);context.res=json(500,{ok:false,error:'Bookingserveren er ikke klar. Ingen bestilling er bekreftet.'});}};
