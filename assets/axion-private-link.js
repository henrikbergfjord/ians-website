(() => {
  "use strict";

  const AXION_URL = "https://REPLACE-WITH-YOUR-AXION-AZURE-URL";

  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  ready(() => {
    const nav = document.querySelector(".nav-links");
    if (nav && !nav.querySelector("[data-axion-link='nav']")) {
      const a = document.createElement("a");
      a.href = AXION_URL;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.dataset.axionLink = "nav";
      a.textContent = "AXION GRID";
      nav.appendChild(a);
    }

    const stage = document.querySelector(".ians-core-stage");
    if (stage && !stage.querySelector("[data-axion-link='planet']")) {
      const a = document.createElement("a");
      a.className = "ians-planet axion";
      a.href = AXION_URL;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.dataset.axionLink = "planet";
      a.setAttribute("aria-label", "Åpne AXION GRID privat firmakonsept");
      a.innerHTML = `
        <span>
          <strong>AXION GRID</strong>
          <small>Private</small>
        </span>`;
      stage.appendChild(a);
    }

    const grid = document.querySelector(".compact-grid");
    if (grid && !grid.querySelector("[data-axion-link='portal']")) {
      const a = document.createElement("a");
      a.className = "compact-link axion-compact-link";
      a.href = AXION_URL;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.dataset.axionLink = "portal";
      a.innerHTML = `
        <span class="compact-glyph private-glyph" aria-hidden="true"></span>
        <span>
          <strong>AXION GRID</strong>
          <small>Privat firmakonsept · tilgang kreves</small>
        </span>
        <span class="compact-arrow">→</span>`;
      grid.appendChild(a);
    }

    if (AXION_URL.includes("REPLACE-WITH-YOUR-AXION-AZURE-URL")) {
      document.querySelectorAll("[data-axion-link]").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          alert("AXION GRID-lenken er klar i designet, men Azure-adressen må legges inn først.");
        });
        link.title = "Azure-adresse mangler";
      });
    }
  });
})();