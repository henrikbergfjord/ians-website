// ===== IANS SameieNett V2.4.1 SMOOTH ORBIT FIX =====
(() => {
  function upgrade(){
    const space = document.querySelector(".sn-v23-space");
    const oldLayer = space?.querySelector(".sn-v23-nodes");
    if(!space || !oldLayer) return false;
    if(space.dataset.snSmoothV241) return true;

    space.dataset.snSmoothV241 = "1";
    delete space.dataset.snSmoothV24;

    // Fresh visible layer so the old V2.3 RAF can continue harmlessly
    // on detached elements without fighting this animation.
    const layer = oldLayer.cloneNode(true);
    oldLayer.replaceWith(layer);
    const nodes = [...layer.querySelectorAll(".sn-v23-node")];
    if(!nodes.length) return false;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let geometry = null;
    let lastW = -1, lastH = -1;

    function measure(){
      const w = space.clientWidth;
      const h = space.clientHeight;
      if(w !== lastW || h !== lastH || !geometry){
        lastW = w; lastH = h;
        const m = Math.min(w,h);
        geometry = {
          2:{rx:m*.31, ry:m*.27},
          3:{rx:m*.42, ry:m*.36}
        };
      }
    }

    function frame(now){
      measure();
      const elapsed = (now - started) / 1000;

      nodes.forEach((node,i)=>{
        const ring = Number(node.dataset.ring || 2);
        const r = geometry[ring] || geometry[2];
        const period = 96 + (i % 4) * 10;
        const direction = i % 2 ? -1 : 1;
        const phase = (i / nodes.length) * Math.PI * 2 + (ring === 3 ? .24 : 0);
        const angle = reduce ? phase : phase + direction * (elapsed / period) * Math.PI * 2;

        // Nodes are anchored at the visual centre by CSS.
        // Only the orbit OFFSET is GPU-translated.
        const dx = Math.cos(angle) * r.rx;
        const dy = Math.sin(angle) * r.ry;

        node.style.transform =
          `translate(-50%,-50%) translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0)`;
      });

      if(!reduce) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    console.info("[IANS] SameieNett V2.4.1 Smooth Orbit Fix aktiv");
    return true;
  }

  function boot(){
    if(upgrade()) return;
    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      if(upgrade() || tries > 30) clearInterval(timer);
    },100);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();