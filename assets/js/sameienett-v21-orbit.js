
// ===== IANS SameieNett V2.1 DATA ORBIT EXPERIENCE =====
(() => {
  const LABELS = [
    {t:"Fiber / Internet", s:"WAN"},
    {t:"204 boliger", s:"Residents"},
    {t:"Wi‑Fi / VLAN", s:"Network"},
    {t:"Access / Security", s:"Zero Trust"},
    {t:"Camera / Adgang", s:"Safety"},
    {t:"Energy / IoT", s:"Automation"},
    {t:"Cloud / SD", s:"Operations"},
    {t:"Monitoring", s:"Insight"}
  ];

  function findTextElement(re){
    return [...document.querySelectorAll("body *")].find(el =>
      el.children.length === 0 && re.test((el.textContent || "").trim())
    );
  }

  function findVisualHost(){
    const coreText = findTextElement(/SAMEIENETT CORE/i);
    if(coreText){
      let p = coreText.parentElement;
      for(let i=0;i<5 && p;i++,p=p.parentElement){
        const r = p.getBoundingClientRect();
        if(r.width > 260 && r.height > 180 && r.width < 900) return p;
      }
    }
    return document.querySelector(".hero-visual,.sameienett-visual,.architecture-visual,.hero-media,.visual-panel");
  }

  function buildOrbit(host){
    if(!host || host.dataset.snOrbitReady) return;
    host.dataset.snOrbitReady = "1";
    host.classList.add("sn-orbit-host");
    host.innerHTML = `
      <div class="sn-orbit-shell" aria-label="SameieNett digital infrastructure">
        <div class="sn-grid-lines" aria-hidden="true"></div>
        <div class="sn-core-glow" aria-hidden="true"></div>
        <div class="sn-orbit-ring r1"></div>
        <div class="sn-orbit-ring r2"></div>
        <div class="sn-orbit-ring r3"></div>
        <div class="sn-core">
          <span>SN</span>
          <strong>SAMEIENETT CORE</strong>
          <small>Network · Security · Energy · IoT</small>
        </div>
        ${LABELS.map((x,i)=>`
          <button class="sn-node n${i+1}" type="button" style="--i:${i};--dur:${24+i*2}s">
            <strong>${x.t}</strong><small>${x.s}</small>
          </button>`).join("")}
        <div class="sn-data-beam b1"></div>
        <div class="sn-data-beam b2"></div>
        <div class="sn-data-beam b3"></div>
      </div>`;
  }

  function addInfoCards(){
    if(document.querySelector(".sn-floating-info")) return;
    const hero = document.querySelector("main section, .hero, .hero-section");
    if(!hero) return;
    const box = document.createElement("div");
    box.className = "sn-floating-info";
    box.innerHTML = `
      <article><span>01</span><strong>Én digital grunnmur</strong><small>Fiber, switching, Wi‑Fi og segmentering</small></article>
      <article><span>02</span><strong>Sikkerhet by design</strong><small>VLAN, adgang, kamera og minst mulig tillit</small></article>
      <article><span>03</span><strong>Drift som kan sees</strong><small>Overvåking, alarmer og hendelser i ett bilde</small></article>
      <article><span>04</span><strong>Klar for fremtiden</strong><small>Energi, IoT, automasjon og nye tjenester</small></article>`;
    hero.appendChild(box);
  }

  function boot(){
    document.body.classList.add("sameienett-v21");
    buildOrbit(findVisualHost());
    addInfoCards();
    console.info("[IANS] SameieNett V2.1 Data Orbit Experience aktiv");
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
