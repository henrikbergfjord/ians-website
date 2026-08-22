(() => {
"use strict";
const LANGS={
 no:{label:"Norsk",short:"NO",flag:"🇳🇴",home:"/"},
 en:{label:"English",short:"EN",flag:"🇬🇧",home:"/en/"},
 sv:{label:"Svenska",short:"SV",flag:"🇸🇪",home:"/se/"},
 da:{label:"Dansk",short:"DA",flag:"🇩🇰",home:"/dk/"},
 fi:{label:"Suomi",short:"FI",flag:"🇫🇮",home:"/fi/"},
 is:{label:"Íslenska",short:"IS",flag:"🇮🇸",home:"/is/"},
 tl:{label:"Tagalog",short:"TL",flag:"🇵🇭",home:"/tl/"}
};
const FOLDER={en:"en",sv:"se",da:"dk",fi:"fi",is:"is",tl:"tl"};
const PREFIX={en:"en",se:"sv",dk:"da",fi:"fi",is:"is",tl:"tl"};
const KEY="ians-language";
const translated=new Set(["/SameieNett.html"]);

function language(){
 const q=new URLSearchParams(location.search).get("lang");
 if(LANGS[q])return q;
 const first=location.pathname.split("/").filter(Boolean)[0]||"";
 if(PREFIX[first])return PREFIX[first];
 const s=localStorage.getItem(KEY); return LANGS[s]?s:"no";
}
let active=language();localStorage.setItem(KEY,active);

function stripPrefix(path){
 const a=path.split("/").filter(Boolean); if(a.length&&PREFIX[a[0]])a.shift();
 return "/"+a.join("/")+(path.endsWith("/")&&a.length?"/":"");
}
function pageTarget(lang,u=new URL(location.href)){
 const base=stripPrefix(u.pathname).replace(/\/index\.html$/i,"/");
 if(base==="/") return LANGS[lang].home+u.hash;
 if(translated.has(base)){
   if(lang==="no") return base+u.hash;
   return `/${FOLDER[lang]}${base}${u.hash}`;
 }
 const t=new URL(base,location.origin);
 u.searchParams.forEach((v,k)=>{if(k!=="lang")t.searchParams.set(k,v)});
 if(lang!=="no")t.searchParams.set("lang",lang);
 t.hash=u.hash; return t.pathname+t.search+t.hash;
}
function switcher(){
 document.getElementById("ians-lang-v2")?.remove();
 const host=document.createElement("div");host.id="ians-lang-v2";
 host.style.cssText="position:fixed;top:12px;right:12px;z-index:2147483647";
 const sh=host.attachShadow({mode:"open"});
 sh.innerHTML=`<style>
 *{box-sizing:border-box}.w{position:relative;font-family:Inter,system-ui,sans-serif}.c{height:42px;min-width:68px;padding:0 11px;border:1px solid rgba(118,211,255,.32);border-radius:12px;background:rgba(7,20,34,.97);color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;box-shadow:0 10px 32px rgba(0,0,0,.35)}.c b{font-size:12px}.m{position:absolute;right:0;top:49px;width:240px;padding:8px;border:1px solid rgba(118,211,255,.2);border-radius:14px;background:#0b1827;box-shadow:0 26px 80px rgba(0,0,0,.48)}.m[hidden]{display:none}.m button{width:100%;border:0;border-radius:9px;background:transparent;color:#eef7ff;display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:10px;text-align:left;cursor:pointer}.m button:hover,.m button.on{background:rgba(107,218,255,.11)}.m b{font-size:12px}.m small{font-size:10px;color:rgba(255,255,255,.44)}.n{margin:7px 5px 3px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:9px;color:rgba(255,255,255,.45)}</style>
 <div class="w"><button class="c"><span>🌐</span><b>${LANGS[active].short}</b><span>⌄</span></button><div class="m" hidden>${Object.entries(LANGS).map(([k,v])=>`<button data-l="${k}" class="${k===active?"on":""}"><span>${v.flag}</span><b>${v.label}</b><small>${v.short}</small></button>`).join("")}<div class="n">SameieNett is now available as a real translated page.</div></div></div>`;
 document.body.appendChild(host);
 const menu=sh.querySelector(".m");sh.querySelector(".c").onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden};
 sh.querySelectorAll("[data-l]").forEach(b=>b.onclick=e=>{e.stopPropagation();const l=b.dataset.l;localStorage.setItem(KEY,l);location.assign(pageTarget(l))});
 document.addEventListener("pointerdown",e=>{if(!e.composedPath().includes(host))menu.hidden=true},true);
}
document.addEventListener("click",e=>{
 const a=e.target.closest?.("a[href]"); if(!a)return;
 const raw=a.getAttribute("href")||"";if(raw.startsWith("#")||raw.startsWith("mailto:")||raw.startsWith("tel:")||a.hasAttribute("download"))return;
 let u;try{u=new URL(a.href,location.href)}catch{return}if(u.origin!==location.origin)return;
 const dest=pageTarget(active,u);if(dest!==u.pathname+u.search+u.hash){e.preventDefault();e.stopImmediatePropagation();location.assign(dest)}
},true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",switcher);else switcher();
})();