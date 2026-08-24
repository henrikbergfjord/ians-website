
// ===== IANS SameieNett V2.3 HERO ORBIT CLEAN =====
(() => {
  const ITEMS = [
    {title:"Fiber / Internet", sub:"WAN", ring:2},
    {title:"204 boliger", sub:"Residents", ring:3},
    {title:"Wi‑Fi / VLAN", sub:"Network", ring:2},
    {title:"Access / Security", sub:"Zero Trust", ring:3},
    {title:"Camera / Adgang", sub:"Safety", ring:2},
    {title:"Energy / IoT", sub:"Automation", ring:3},
    {title:"Cloud / SD", sub:"Operations", ring:2},
    {title:"Monitoring", sub:"Insight", ring:3}
  ];

  function findHeroVisual(){
    const candidates = [...document.querySelectorAll("body *")].filter(el => {
      const t = (el.textContent || "").trim();
      return /Moderne boligområde som illustrerer digital infrastruktur i SameieNett/i.test(t) ||
             /^Fiber \/ Internet$/i.test(t) ||
             /^204 boliger$/i.test(t) ||
             /^SAMEIENETT CORE$/i.test(t);
    });

    for(const el of candidates){
      let p = el.parentElement;
      for(let i=0;i<7 && p;i++,p=p.parentElement){
        const r = p.getBoundingClientRect();
        if(r.width > 360 && r.height > 260 && r.width < 950 && r.height < 820){
          return p;
        }
      }
    }

    const hero = document.querySelector("main section, .hero, .hero-section");
    if(hero){
      const cards=[...hero.querySelectorAll("div,article,aside")].filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>360 && r.height>260 && r.left > innerWidth*.45 && r.top < innerHeight*.8;
      });
      cards.sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width);
      return cards[0] || null;
    }
    return null;
  }

  function build(host){
    if(!host || host.dataset.snHeroOrbitV23) return;
    host.dataset.snHeroOrbitV23 = "1";
    host.className += " sn-v23-host";

    host.innerHTML = `
      <div class="sn-v23-space">
        <div class="sn-v23-stars"></div>
        <div class="sn-v23-ring ring1"></div>
        <div class="sn-v23-ring ring2"></div>
        <div class="sn-v23-ring ring3"></div>

        <div class="sn-v23-core">
          <div class="sn-v23-core-icon">SN</div>
          <strong>SAMEIENETT<br>CORE</strong>
          <small>Network · Security · Energy · IoT</small>
        </div>

        <div class="sn-v23-nodes">
          ${ITEMS.map((x,i)=>`
            <div class="sn-v23-node" data-i="${i}" data-ring="${x.ring}">
              <strong>${x.title}</strong>
              <small>${x.sub}</small>
            </div>`).join("")}
        </div>

        <div class="sn-v23-caption">
          <span>LIVE ARCHITECTURE VIEW</span>
          <strong>Digital infrastruktur rundt én styrbar kjerne</strong>
        </div>
      </div>`;

    startOrbit(host);
  }

  function startOrbit(host){
    const space = host.querySelector(".sn-v23-space");
    const nodes = [...host.querySelectorAll(".sn-v23-node")];
    if(!space || !nodes.length) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    function frame(now){
      const w = space.clientWidth;
      const h = space.clientHeight;
      const cx = w * 0.5;
      const cy = h * 0.47;

      const min = Math.min(w,h);
      const rings = {
        1: {rx:min*.21, ry:min*.18},
        2: {rx:min*.31, ry:min*.27},
        3: {rx:min*.42, ry:min*.36}
      };

      const elapsed = (now-start)/1000;

      nodes.forEach((node,i)=>{
        const ring = Number(node.dataset.ring || 2);
        const r = rings[ring];
        // 82–118 sec per full revolution: intentionally very calm.
        const period = 82 + (i%4)*12;
        const direction = i%2 ? -1 : 1;
        const phase = (i / nodes.length) * Math.PI*2 + (ring===3 ? .24 : 0);
        const angle = reduce ? phase : phase + direction * (elapsed/period) * Math.PI*2;

        const x = cx + Math.cos(angle)*r.rx;
        const y = cy + Math.sin(angle)*r.ry;

        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
      });

      if(!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function boot(){
    const host = findHeroVisual();
    build(host);
    setTimeout(()=>build(findHeroVisual()),650);
    console.info("[IANS] SameieNett V2.3 Hero Orbit Clean aktiv");
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
