// IANS OneDrive Command V3.27 · Edge Boot Diagnostics
// Passive guard: does not touch OneDrive data. Detects whether the main ES module actually booted.
(() => {
  'use strict';
  const VERSION='3.27';
  const CLIENT_ID='986e5cdb-dab1-4b3f-8db0-8fe7214a19b3';
  const KEY='ians_onedrive_analyzer_client_id';
  const BACKUP='ians_onedrive_analyzer_client_id_backup';

  try {
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, CLIENT_ID);
    if (!localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP, CLIENT_ID);
  } catch {}

  function addStatus(text, state='wait') {
    let box=document.getElementById('iansV327Boot');
    if(!box){
      box=document.createElement('div');
      box.id='iansV327Boot';
      box.style.cssText='position:fixed;left:18px;bottom:18px;z-index:999999;padding:9px 12px;border-radius:10px;background:#071827;border:1px solid #31506a;color:#dcecff;font:12px system-ui;box-shadow:0 10px 30px #0006';
      document.body.appendChild(box);
    }
    box.dataset.state=state;
    box.textContent=`IANS V${VERSION} · ${text}`;
  }

  function mainBooted(){
    return !!(window.IANS_V315 || window.IANS_AUTH_V314 || document.getElementById('iansV30'));
  }

  window.addEventListener('error', e => {
    const msg=String(e?.message||'');
    if(/module|import|msal|cdn|script|syntax/i.test(msg)) addStatus(`BOOT ERROR · ${msg.slice(0,120)}`,'fail');
  }, true);
  window.addEventListener('unhandledrejection', e => {
    const msg=String(e?.reason?.message||e?.reason||'');
    if(/module|import|msal|cdn|script|fetch/i.test(msg)) addStatus(`BOOT ERROR · ${msg.slice(0,120)}`,'fail');
  });

  window.addEventListener('DOMContentLoaded',()=>{
    addStatus('kontrollerer hovedmotor…');
    setTimeout(()=>{
      if(mainBooted()) {
        addStatus('hovedmotor OK','ok');
        setTimeout(()=>document.getElementById('iansV327Boot')?.remove(),5000);
        return;
      }
      addStatus('HOVEDMODUL STARTET IKKE · app.js/MSAL-import må repareres','fail');
      const setup=document.getElementById('setupMessage');
      if(setup) setup.textContent='IANS V3.27: Hovedmodulen app.js startet ikke. Dette er ikke en manglende Client ID; Client ID er forhåndskonfigurert. Kontroller modul-/MSAL-lasting.';
    },2500);
  });
})();
