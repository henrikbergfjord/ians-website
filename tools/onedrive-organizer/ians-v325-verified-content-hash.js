(() => {
  "use strict";

  const VERSION = "3.25";
  const CACHE_KEY = "ians_v325_sha256_cache_v1";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const text = el => (el?.textContent || "").trim();

  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { cache = {}; }

  function saveCache(){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  function panel(){
    return document.getElementById("dupBulkPanel")
      || document.getElementById("v295DupList")
      || document.getElementById("v294ReviewCleaner")
      || document.querySelector("[data-duplicate-panel]")
      || document.querySelector(".duplicate-review-panel")
      || document.querySelector(".duplicate-panel")
      || null;
  }

  function groups(root){
    if(!root) return [];
    const explicit = $$(
      '[data-duplicate-group], .duplicate-group, .dup-group, .v323-group, .v295-dup-group',
      root
    );
    if(explicit.length) return explicit;

    const buttons = $$("button", root).filter(b => /Merk manuelt etter review|Preview behold|Fjern gruppevalg/i.test(text(b)));
    const found = [];
    for(const btn of buttons){
      let el = btn.parentElement;
      for(let i=0; i<7 && el && el !== root; i++, el=el.parentElement){
        const cbs = $$('input[type="checkbox"]', el);
        if(cbs.length >= 2){
          if(!found.includes(el)) found.push(el);
          break;
        }
      }
    }
    return found;
  }

  function rows(group){
    const explicit = $$(
      '[data-duplicate-row], .duplicate-row, .dup-row, .candidate-row, .file-row, li, tr',
      group
    ).filter(r => text(r).length > 0);
    if(explicit.length >= 2) return explicit;
    return $$('input[type="checkbox"]', group).map(cb => cb.closest("div") || cb.parentElement).filter(Boolean);
  }

  function parseSize(str){
    const m = str.match(/([\d.,]+)\s*(B|KB|MB|GB|TB)\b/i);
    if(!m) return null;
    const n = parseFloat(m[1].replace(",", "."));
    const mult = {B:1,KB:1024,MB:1024**2,GB:1024**3,TB:1024**4}[m[2].toUpperCase()];
    return Math.round(n * mult);
  }

  function getGraphId(row){
    return row.dataset.itemId
      || row.dataset.driveItemId
      || row.getAttribute("data-id")
      || row.getAttribute("data-item-id")
      || row.getAttribute("data-drive-item-id")
      || null;
  }

  function getDownloadUrl(row){
    return row.dataset.downloadUrl
      || row.getAttribute("data-download-url")
      || row.querySelector('a[href*="download"]')?.href
      || null;
  }

  function getPath(row){
    const t = text(row);
    const m = t.match(/(\/[^\n]+?\.[A-Za-z0-9]{2,6})\b/);
    return m ? m[1].trim() : "";
  }

  function rowKey(row){
    return getGraphId(row) || getDownloadUrl(row) || getPath(row) || text(row).slice(0,220);
  }

  function getAuthToken(){
    const candidates = [
      window.IANS_GRAPH_TOKEN,
      window.graphAccessToken,
      window.accessToken,
      sessionStorage.getItem("ians_graph_token"),
      sessionStorage.getItem("graphAccessToken"),
      localStorage.getItem("ians_graph_token"),
      localStorage.getItem("graphAccessToken")
    ].filter(Boolean);
    return candidates[0] || null;
  }

  async function fetchOriginal(row){
    const itemId = getGraphId(row);
    const token = getAuthToken();

    if(itemId && token){
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow"
      });
      if(!res.ok) throw new Error(`Graph content ${res.status}`);
      return await res.arrayBuffer();
    }

    const url = getDownloadUrl(row);
    if(url){
      const res = await fetch(url, { credentials: "include", redirect: "follow" });
      if(!res.ok) throw new Error(`Download ${res.status}`);
      return await res.arrayBuffer();
    }

    throw new Error("Mangler item-id eller direkte download-URL i raden");
  }

  async function sha256(buffer){
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
  }

  function ensureStatus(row){
    let badge = row.querySelector(".ians-v325-hash-status");
    if(!badge){
      badge = document.createElement("span");
      badge.className = "ians-v325-hash-status";
      badge.style.cssText = "margin-left:8px;font:600 11px/1.2 system-ui;color:#9bdcff;white-space:nowrap";
      row.appendChild(badge);
    }
    return badge;
  }

  function setStatus(row, msg){
    ensureStatus(row).textContent = msg;
  }

  function ensureVerifyButton(group){
    if(group.querySelector(".ians-v325-verify-hash")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ians-v325-verify-hash";
    btn.textContent = "Verifiser SHA-256";
    btn.style.cssText = "margin-left:8px;padding:7px 10px;border-radius:7px;border:1px solid rgba(56,189,248,.45);background:#0d3550;color:#eaf7ff;font:600 12px system-ui;cursor:pointer";

    const host = $$("button", group).find(b => /Merk manuelt etter review|Fjern gruppevalg|Preview behold/i.test(text(b)))?.parentElement
      || group.firstElementChild
      || group;
    host.appendChild(btn);

    btn.addEventListener("click", async () => {
      await verifyGroup(group, btn);
    });
  }

  async function verifyGroup(group, btn){
    const rs = rows(group);
    if(rs.length < 2){
      toast("Fant ikke minst to filer i gruppen.");
      return;
    }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Hasher…";

    const results = [];
    try{
      for(let i=0; i<rs.length; i++){
        const row = rs[i];
        const key = rowKey(row);
        const size = parseSize(text(row));

        if(cache[key]?.sha256){
          setStatus(row, `SHA-256 ${cache[key].sha256.slice(0,12)}… (cache)`);
          results.push({row, key, size, sha256: cache[key].sha256});
          continue;
        }

        setStatus(row, `Laster original ${i+1}/${rs.length}…`);
        const buffer = await fetchOriginal(row);

        if(size && Math.abs(buffer.byteLength - size) > Math.max(1024*1024, size*0.02)){
          setStatus(row, `Størrelse avviker (${buffer.byteLength} B)`);
          throw new Error("Nedlastet innhold matcher ikke forventet filstørrelse");
        }

        setStatus(row, "Beregner SHA-256…");
        const hash = await sha256(buffer);

        cache[key] = {
          sha256: hash,
          bytes: buffer.byteLength,
          verifiedAt: new Date().toISOString()
        };
        saveCache();

        setStatus(row, `SHA-256 ${hash.slice(0,12)}…`);
        results.push({row, key, size: buffer.byteLength, sha256: hash});
        await new Promise(r => setTimeout(r, 60));
      }

      const first = results[0].sha256;
      const allSame = results.every(x => x.sha256 === first);

      if(allSame){
        results.forEach((x, idx) => {
          x.row.dataset.v325HashVerified = "1";
          x.row.dataset.v325Sha256 = x.sha256;
          const cb = $('input[type="checkbox"]', x.row);
          if(cb){
            cb.disabled = false;
            if(idx === 0){
              cb.checked = false;
              cb.dataset.v324Keep = "1";
            } else {
              cb.dataset.v325VerifiedDuplicate = "1";
            }
          }
          setStatus(x.row, idx === 0 ? "VERIFISERT · BEHOLD" : "VERIFISERT DUPLIKAT");
        });

        group.dataset.v325HashMatch = "1";
        toast(`SHA-256 verifisert: ${results.length} identiske filer. Behold én; øvrige er verifiserte duplikater.`);
      } else {
        group.dataset.v325HashMatch = "0";
        results.forEach(x => setStatus(x.row, "HASH AVVIKER · IKKE SLETT"));
        toast("Hashene er ikke identiske. Gruppen skal ikke behandles som verifiserte duplikater.");
      }

    } catch(err){
      console.error("[IANS V3.25] Hash verify failed", err);
      toast(`Kunne ikke verifisere gruppen: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  function toast(message){
    let box = document.getElementById("iansV325Toast");
    if(!box){
      box = document.createElement("div");
      box.id = "iansV325Toast";
      box.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:2147483647;max-width:460px;padding:12px 14px;border-radius:10px;background:rgba(7,18,32,.97);border:1px solid rgba(56,189,248,.45);box-shadow:0 14px 40px rgba(0,0,0,.35);color:#eaf7ff;font:500 13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
      document.body.appendChild(box);
    }
    box.textContent = message;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.remove(), 6000);
  }

  function install(){
    const p = panel();
    if(!p) return;
    groups(p).forEach(ensureVerifyButton);
  }

  function boot(){
    install();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      install();
      if(panel() || tries >= 15) clearInterval(timer);
    }, 1000);

    const p = panel();
    if(p){
      new MutationObserver(() => setTimeout(install, 120))
        .observe(p, {subtree:true, childList:true});
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }

  console.log(`[IANS] OneDrive Command V${VERSION} Verified Content Hash aktiv`);
})();
