(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const focus = params.get('focus') || 'scan';
  const map = {
    scan: ['topControlPanel','v293Portable'],
    analyze: ['largeDrivePanel','v293PhotoPanel','storageMapPanel'],
    duplicates: ['v294ReviewCleaner','v295DupList','dupBulkPanel'],
    organize: ['v285OrgPanel','v24ActionTools'],
    backup: ['downloadVerifyPanel'],
    settings: ['setupPanel']
  };
  const labels={scan:'Kartlegging',analyze:'Finn & analyser',duplicates:'Duplikater',organize:'Rydd & organiser',backup:'Backup & Verify',settings:'Innstillinger'};
  function firstExisting(ids){ for(const id of ids||[]){const el=document.getElementById(id); if(el)return el;} return null; }
  function init(){
    const target=firstExisting(map[focus]);
    const bar=document.createElement('div');
    bar.className='v31-workspace-bar';
    bar.innerHTML=`<a href="command-center.html">← Command Center</a><strong>${labels[focus]||'Arbeidsflate'}</strong><span>Verktøyene under bruker eksisterende IANS-motor.</span>`;
    document.body.prepend(bar);
    if(target){ target.hidden=false; target.classList.remove('hidden'); setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),350); }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
