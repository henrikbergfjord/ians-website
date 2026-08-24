// ===== IANS HOME V4.7 ORBITAL COMMAND EXPERIENCE =====
(() => {
  function clean(){
    [...document.querySelectorAll("body *")].forEach(el=>{if(el.children.length===0&&(el.textContent||"").trim()==="OneDrive Command")el.remove();});
  }
  function core(){
    return document.querySelector(".ians-core,.core-orbit,.orbit-system,.hero-orbit,.ians-orbit")||
      [...document.querySelectorAll("div,section")].find(el=>/IANS CORE/i.test(el.textContent||"")&&el.querySelector("a"));
  }
  function enhance(){
    const c=core(); if(!c||c.dataset.v47Ready)return;
    c.dataset.v47Ready="1"; c.classList.add("v47-orbit-system");
    const planets=[...c.querySelectorAll("a")].filter(a=>/SameieNett|Academy|Økonomi|DNS|Strøm|IANS Lab|Projects|AXION/i.test(a.textContent||""));
    planets.forEach((p,i)=>{p.classList.add("v47-orbit-planet");p.style.setProperty("--v47-delay",`${-i*5.5}s`);p.style.setProperty("--v47-float",`${8+i%4}s`);});
    if(!planets.some(p=>/OneDrive/i.test(p.textContent||""))){
      const a=document.createElement("a");a.href="tools/onedrive-organizer/";a.className="v47-orbit-planet v47-onedrive";
      a.innerHTML="<strong>OneDrive</strong><small>Command</small>";c.appendChild(a);
    }
  }
  function boot(){document.body.classList.add("v47-home");clean();enhance();setTimeout(()=>{clean();enhance();},700);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();