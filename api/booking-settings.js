'use strict';
const DAY=86400000;
function validDay(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function shift(day,n){return new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);}
function fireSettings(env=process.env,now=new Date()){
  let days=['2026-12-16','2026-12-17'];
  if(env.IANS_FIRE_CONTROL_DATES){try{const v=JSON.parse(env.IANS_FIRE_CONTROL_DATES);if(!Array.isArray(v)||!v.length||v.length>10||!v.every(validDay))throw Error();days=[...new Set(v)].sort();}catch{throw new Error('Ugyldige kontrolldatoer i serverinnstillingene.');}}
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const confirmed=env.IANS_FIRE_CONTROL_CONFIRMED==='true';
  const opensOn=confirmed?shift(days[0],-30):null,closesOn=days.at(-1),retentionDeleteAfter=shift(closesOn,14);
  const testMode=!confirmed&&today>='2026-09-02'&&today<='2026-10-02';
  const open=testMode||(confirmed&&today>=opensOn&&today<=closesOn);
  const status=testMode?'test':!confirmed?'awaiting-confirmation':today<opensOn?'scheduled':today<=closesOn?'open':'closed';
  return{days,confirmed,open,status,testMode,testOpenUntil:'2026-10-02',opensOn,closesOn,retentionDeleteAfter,expired:today>retentionDeleteAfter};
}
module.exports={fireSettings,validDay,shift};
