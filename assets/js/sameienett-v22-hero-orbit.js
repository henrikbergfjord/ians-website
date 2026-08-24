
// ===== IANS SameieNett V2.2 HERO ORBIT MATCH =====
(() => {
  const ITEMS = [
    ["Fiber / Internet","WAN"],
    ["204 boliger","Residents"],
    ["Wi‑Fi / VLAN","Network"],
    ["Access / Security","Zero Trust"],
    ["Camera / Adgang","Safety"],
    ["Energy / IoT","Automation"],
    ["Cloud / SD","Operations"],
    ["Monitoring","Insight"]
  ];

  function findHeroVisual(){
    const textCandidates = [...document.querySelectorAll("body *")].filter(el => {
      const t = (el.textContent || "").trim();
      return /Moderne boligområde som illustrerer digital infrastruktur i SameieNett/i.test(t) ||
             /^Fiber \/ Internet$/i.test(t) ||
             /^204 boliger$/i.test(t);
    });

    for(const el of textCandidates){
      let p = el.parentElement;
      for(let i=0;i<6 && p;i++,p=p.parentElement){
        const r = p.getBoundingClientRect();
        if(r.width > 350 && r.height > 260 && r.width < 900 && r.height < 800){
          return p;
        }
      }
    }

    // Fallback: right-hand hero card in first major section
    const hero = document.querySelector("main section, .hero, .hero-section");
    if(hero){
      const cards = [...hero.querySelectorAll("div,article,aside")].filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>350 && r.height>260 && r.left > window.innerWidth*0.45;
      });
      cards.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
      if(cards[0]) return cards[0];
    }
    return null;
  }

  function render(host){
    if(!host || host.dataset.snHeroOrbitV22) return;
    host.dataset.snHeroOrbitV22 = "1";
    host.classList.add("sn-hero-orbit-v22");
    host.innerHTML = `
      <div class="sn-v22-space">
        <div class="sn-v22-stars"></div>
        <div class="sn-v22-ring r1"></div>
        <div class="sn-v22-ring r2"></div>
        <div class="sn-v22-ring r3"></div>
        <div class="sn-v22-core">
          <div class="sn-v22-core-icon">SN</div>
          <strong>SAMEIENETT<br>CORE</strong>
          <small>Network · Security · Energy · IoT</small>
        </div>
        ${ITEMS.map((x,i)=>`
          <div class="sn-v22-orbit orbit-${(i%3)+1}" style="--start:${i*45}deg;--speed:${40+i*4}s;">
            <div class="sn-v22-node">
              <strong>${x[0]}</strong>
              <small>${x[1]}</small>
            </div>
          </div>`).join("")}
        <div class="sn-v22-caption">
          <span>LIVE ARCHITECTURE VIEW</span>
          <strong>Digital infrastruktur rundt én styrbar kjerne</strong>
        </div>
      </div>`;
  }

  function boot(){
    const host=findHeroVisual();
    render(host);
    setTimeout(()=>render(findHeroVisual()),700);
    console.info("[IANS] SameieNett V2.2 Hero Orbit Match aktiv");
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
