// ===== IANS SameieNett V2.4 SMOOTH ORBIT =====
(() => {
  function upgrade(){
    const space = document.querySelector(".sn-v23-space");
    const nodes = [...document.querySelectorAll(".sn-v23-node")];
    if(!space || !nodes.length) return false;
    if(space.dataset.snSmoothV24) return true;
    space.dataset.snSmoothV24 = "1";

    // Disable the V2.3 RAF loop by cloning nodes into a fresh layer.
    const oldLayer = space.querySelector(".sn-v23-nodes");
    if(!oldLayer) return false;
    const layer = oldLayer.cloneNode(true);
    oldLayer.replaceWith(layer);
    const freshNodes = [...layer.querySelectorAll(".sn-v23-node")];

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let lastW = 0, lastH = 0, geometry = null;

    function measure(){
      const w = space.clientWidth, h = space.clientHeight;
      if(w !== lastW || h !== lastH || !geometry){
        lastW=w; lastH=h;
        const m=Math.min(w,h);
        geometry={
          cx:w*.5, cy:h*.47,
          2:{rx:m*.31,ry:m*.27},
          3:{rx:m*.42,ry:m*.36}
        };
      }
    }

    function frame(now){
      measure();
      const elapsed=(now-start)/1000;
      freshNodes.forEach((node,i)=>{
        const ring=Number(node.dataset.ring||2);
        const r=geometry[ring];
        const period=92+(i%4)*10;
        const direction=i%2?-1:1;
        const phase=(i/freshNodes.length)*Math.PI*2+(ring===3?.24:0);
        const angle=reduce?phase:phase+direction*(elapsed/period)*Math.PI*2;
        const x=geometry.cx+Math.cos(angle)*r.rx;
        const y=geometry.cy+Math.sin(angle)*r.ry;
        node.style.transform=`translate3d(${x}px,${y}px,0) translate3d(-50%,-50%,0)`;
      });
      if(!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    console.info("[IANS] SameieNett V2.4 GPU Smooth Orbit aktiv");
    return true;
  }

  function boot(){
    if(upgrade()) return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(upgrade() || tries>20) clearInterval(timer);
    },100);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();