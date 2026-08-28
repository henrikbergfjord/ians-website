(() => {
  'use strict';
  const CLIENT_ID='986e5cdb-dab1-4b3f-8db0-8fe7214a19b3';
  try {
    if(!localStorage.getItem('ians_onedrive_analyzer_client_id')) localStorage.setItem('ians_onedrive_analyzer_client_id',CLIENT_ID);
    if(!localStorage.getItem('ians_onedrive_analyzer_client_id_backup')) localStorage.setItem('ians_onedrive_analyzer_client_id_backup',CLIENT_ID);
  } catch {}
  function status(text){let b=document.getElementById('iansV327Boot');if(!b){b=document.createElement('div');b.id='iansV327Boot';b.style.cssText='position:fixed;left:18px;bottom:18px;z-index:999999;padding:9px 12px;border-radius:10px;background:#071827;border:1px solid #31506a;color:#dcecff;font:12px system-ui';document.body.appendChild(b)}b.textContent='IANS V3.27 · '+text}
  window.addEventListener('DOMContentLoaded',()=>{status('kontrollerer hovedmotor…');setTimeout(()=>{if(window.IANS_V315||window.IANS_AUTH_V314||document.getElementById('iansV30')){status('hovedmotor OK');setTimeout(()=>document.getElementById('iansV327Boot')?.remove(),4000)}else status('HOVEDMODUL STARTET IKKE · kontroller Console')},3000)});
})();
