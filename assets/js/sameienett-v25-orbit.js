// ===== IANS SameieNett V2.5 CSS ORBIT ENGINE =====
(() => {
  const ITEMS = [
    ["Fiber / Internet","WAN",1,0],
    ["204 boliger","Residents",2,45],
    ["Wi‑Fi / VLAN","Network",1,90],
    ["Access / Security","Zero Trust",2,135],
    ["Camera / Adgang","Safety",1,180],
    ["Energy / IoT","Automation",2,225],
    ["Cloud / SD","Operations",1,270],
    ["Monitoring","Insight",2,315]
  ];

  function findHeroVisual(){
    const hits = [...document.querySelectorAll("body *")].filter(el=>{
      const t=(el.textContent||"").trim();
      return /Moderne boligområde som illustrerer digital infrastruktur i SameieNett/i.test(t)
        || /^SAMEIENETT CORE$/i.test(t)
        || /^Fiber \/ Internet$/i.test(t);
    });

    for(const el of hits){
      let p=el.parentElement;
      for(let i=0;i<7 && p;i++,p=p.parentElement){
        const r=p.getBoundingClientRect();
        if(r.width>320 && r.height>240 && r.width<1000 && r.height<850) return p;
      }
    }

    const hero=document.querySelector("main section, .hero, .hero-section");
    if(hero){
      const right=[...hero.querySelectorAll("div,article,aside")].filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>320 && r.height>240 && r.left>innerWidth*.45;
      });
      right.sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width);
      return right[0]||null;
    }
    return null;
  }

  function render(host){
    if(!host || host.dataset.snV25) return;
    host.dataset.snV25="1";
    host.classList.add("sn-v25-host");
    host.innerHTML=`
      <div class="sn-v25-space">
        <div class="sn-v25-stars"></div>
        <div class="sn-v25-ring ring-a"></div>
        <div class="sn-v25-ring ring-b"></div>
        <div class="sn-v25-ring ring-c"></div>

        <div class="sn-v25-core">
          <div class="sn-v25-core-icon">SN</div>
          <strong>SAMEIENETT<br>CORE</strong>
          <small>Network · Security · Energy · IoT</small>
        </div>

        <div class="sn-v25-orbits">
          ${ITEMS.map(([title,sub,ring,start],i)=>`
            <div class="sn-v25-orbiter ring-${ring}" style="--start:${start}deg;--dur:${ring===1?96:122}s;--dir:${i%2?'-1':'1'}">
              <div class="sn-v25-node">
                <strong>${title}</strong>
                <small>${sub}</small>
              </div>
            </div>`).join("")}
        </div>

        <div class="sn-v25-caption">
          <span>LIVE ARCHITECTURE VIEW</span>
          <strong>Digital infrastruktur rundt én styrbar kjerne</strong>
        </div>
      </div>`;
  }

  function boot(){
    render(findHeroVisual());
    setTimeout(()=>render(findHeroVisual()),500);
    console.info("[IANS] SameieNett V2.5 CSS Orbit Engine aktiv");
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();