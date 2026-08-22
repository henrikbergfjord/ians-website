(() => {
  let dict={}, lang='no';
  async function load(code){
    lang=code==='en'?'en':'no';
    try{
      const r=await fetch(`assets/lang/${lang}.json`);
      dict=await r.json();
    }catch{
      dict={};
    }
    document.documentElement.lang=lang;
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const k=el.dataset.i18n;if(dict[k]) el.textContent=dict[k];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const k=el.dataset.i18nPlaceholder;if(dict[k]) el.placeholder=dict[k];
    });
    document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
    localStorage.setItem('moneyPlannerLang',lang);
    window.dispatchEvent(new CustomEvent('moneyplanner:language',{detail:{lang,dict}}));
  }
  window.MoneyI18n={load,t:(k,f='')=>dict[k]||f,lang:()=>lang};
  window.addEventListener('DOMContentLoaded',()=>{
    const saved=localStorage.getItem('moneyPlannerLang') || ((navigator.language||'').toLowerCase().startsWith('en')?'en':'no');
    document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.lang)));
    load(saved);
  });
})();