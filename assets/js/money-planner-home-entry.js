
// IANS Money Planner V4.5 – homepage integration
(() => {
  const HOME_LINK = "tools/money-planner/";
  const home = document.querySelector("main") || document.body;

  function findTextElement(text){
    return [...document.querySelectorAll("h1,h2,h3,h4,p,span,strong,div")]
      .find(el => el.children.length === 0 && (el.textContent || "").trim().includes(text));
  }

  function addPlanet(){
    if(document.querySelector(".ians-money-planet")) return;

    const core = findTextElement("IANS CORE");
    const hero = core?.closest("section") ||
      document.querySelector("main > section") ||
      document.querySelector(".hero") ||
      home;

    if(!hero) return;
    hero.classList.add("ians-home-planet-host");

    const a = document.createElement("a");
    a.className = "ians-money-planet";
    a.href = HOME_LINK;
    a.setAttribute("aria-label","Åpne Money Planner");
    a.innerHTML = `
      <span class="planet-glow"></span>
      <span class="planet-core">
        <b>Money</b>
        <small>Planner</small>
      </span>
      <span class="planet-orbit"></span>
    `;
    hero.appendChild(a);
  }

  function addFifthEntry(){
    if(document.querySelector(".ians-money-entry-card")) return;

    const heading = [...document.querySelectorAll("h1,h2,h3")]
      .find(el => /Fire tydelige innganger|Fem tydelige innganger/i.test(el.textContent || ""));

    const section = heading?.closest("section") || null;
    if(!section) return;

    heading.textContent = heading.textContent.replace(/Fire tydelige innganger/i,"Fem tydelige innganger");

    const grid = section.querySelector("[class*='grid']") ||
      section.querySelector("[class*='cards']") ||
      section.querySelector("div");

    if(!grid) return;

    const card = document.createElement("article");
    card.className = "ians-money-entry-card";
    card.innerHTML = `
      <div class="ians-money-entry-kicker">05 · PERSONAL FINANCE</div>
      <div class="ians-money-entry-top">
        <span class="ians-money-entry-icon">◒</span>
        <span class="ians-money-entry-status">Money Planner</span>
      </div>
      <h3>Money Planner</h3>
      <p>Fra oversikt til handling. Budsjett, lån, sparing, scenarier, AI og en konkret personlig plan.</p>
      <div class="ians-money-entry-tags">
        <span>Privat</span><span>Gratis</span><span>Handling</span>
      </div>
      <a href="${HOME_LINK}" class="ians-money-entry-button">Åpne Money Planner <span>→</span></a>
    `;
    grid.appendChild(card);
  }

  function boot(){
    addPlanet();
    addFifthEntry();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
