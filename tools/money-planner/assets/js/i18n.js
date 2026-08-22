(() => {
  const PACKS = {
    no: {
      "nav.overview":"Oversikt","nav.plan":"Min plan","nav.tools":"Verktøy","nav.help":"Jeg trenger hjelp","nav.kids":"Barnesparing","nav.sell":"Selg ting","nav.about":"Om",
      "hero.privacy":"100 % privat i standardverktøyene","hero.kicker":"DIN ØKONOMI · DIN RETNING","hero.title1":"Ta kontroll i dag.","hero.title2":"Skap frihet i morgen.",
      "hero.text":"Money Planner gir deg oversikt, konkrete tiltak og en personlig plan – enten du vil lage budsjett, spare til et mål, forstå gjelden din eller bare finne ut hvor pengene går.",
      "hero.start":"Start min plan gratis →","hero.demo":"Se demo med eksempel",
      "income.title":"Husholdningens inntekt per måned","income.help":"Bruk netto månedsbeløp – det som faktisk kommer inn på konto etter skatt. Ikke skriv årslønn her.",
      "income.self":"Din netto lønn per måned","income.partner":"Partner/samboers netto lønn per måned","income.extra":"Overtid/bonus – gjennomsnitt per måned","income.benefits":"Barnetrygd/stønad per måned","income.rental":"Leieinntekt per måned","income.other":"Andre faste inntekter per måned","income.total":"Samlet netto husholdningsinntekt",
      "kids.title":"Min første spareplan","kids.subtitle":"En liten og morsom spareplan foreldre kan lage sammen med barnet.","kids.goal":"Hva sparer du til?","kids.cost":"Hva koster det?","kids.saved":"Hvor mye har du allerede spart?","kids.weekly":"Hvor mye kan du spare hver uke?","kids.name":"Barnets fornavn eller kallenavn","kids.generate":"Lag min spareplan","kids.parent":"Foreldrehjørnet",
      "bank.title":"Hvilken bank passer best for deg?","bank.text":"Det finnes ikke én beste bank for alle. Vi hjelper deg å finne hva du bør sammenligne, og sender deg videre til oppdaterte, uavhengige kilder.","bank.compare":"Sammenlign lån på Finansportalen",
      "debt.title":"Sjekk usikret gjeld","debt.text":"Gjeldsregisteret viser registrert usikret gjeld som kredittkort og forbrukslån. Boliglån, billån og studielån er ikke med.","debt.open":"Åpne Gjeldsregisteret",
      "help.card.title":"Ser økonomien vanskeligere ut enn du hadde håpet?","help.card.text":"Du trenger ikke løse alt på hovedsiden. Vi har laget en egen hjelpeside med konkrete første steg, gratis offentlig rådgivning og en 90-dagers oppryddingsplan.","help.card.button":"Gå til «Jeg trenger hjelp» →",
      "privacy.ai.title":"Om AI og personvern","privacy.ai.finance":"Økonomisk AI-analyse bruker en modell og et oppsett valgt med større vekt på personvern og kontroll. Navnet ditt sendes ikke. Bare nødvendige nøkkeltall brukes.","privacy.ai.ads":"I annonsegeneratoren kan produktbilder og produktopplysninger bli sendt til AI-tjenesten når du aktivt ber om en annonse. Bildene brukes for å forstå produktet og lage annonseforslaget."
    },
    en: {
      "nav.overview":"Overview","nav.plan":"My plan","nav.tools":"Tools","nav.help":"I need help","nav.kids":"Kids saving","nav.sell":"Sell items","nav.about":"About",
      "hero.privacy":"100% private in the standard tools","hero.kicker":"YOUR MONEY · YOUR DIRECTION","hero.title1":"Take control today.","hero.title2":"Create more freedom tomorrow.",
      "hero.text":"Money Planner gives you an overview, practical actions and a personal plan – whether you want to budget, save for a goal, understand your debt or simply see where your money goes.",
      "hero.start":"Start my plan for free →","hero.demo":"View example",
      "income.title":"Household income per month","income.help":"Enter monthly income after tax – the amount that actually arrives in your bank account. Do not enter your yearly salary here.",
      "income.self":"Your monthly income after tax","income.partner":"Partner/cohabitant monthly income after tax","income.extra":"Overtime/bonus – monthly average","income.benefits":"Benefits/child benefit per month","income.rental":"Rental income per month","income.other":"Other regular monthly income","income.total":"Total household income after tax",
      "kids.title":"My first savings plan","kids.subtitle":"A simple and fun savings plan for parents and children to make together.","kids.goal":"What are you saving for?","kids.cost":"How much does it cost?","kids.saved":"How much have you already saved?","kids.weekly":"How much can you save each week?","kids.name":"Child's first name or nickname","kids.generate":"Create my savings plan","kids.parent":"Parent corner",
      "bank.title":"Which bank may suit you best?","bank.text":"There is no single best bank for everyone. We help you understand what to compare, then send you to current independent comparison services.","bank.compare":"Compare loans at Finansportalen",
      "debt.title":"Check unsecured debt","debt.text":"Gjeldsregisteret shows registered unsecured debt such as credit cards and consumer loans. Mortgages, car loans and student loans are not included.","debt.open":"Open Gjeldsregisteret",
      "help.card.title":"Does your financial situation look harder than you expected?","help.card.text":"You do not need to solve everything on the main page. We have a separate help page with practical first steps, free public debt counselling and a 90-day clean-up plan.","help.card.button":"Go to “I need help” →",
      "privacy.ai.title":"AI and privacy","privacy.ai.finance":"The financial AI analysis uses a model and setup selected with stronger emphasis on privacy and control. Your name is not sent. Only the necessary financial figures are used.","privacy.ai.ads":"In the ad generator, product photos and product information may be sent to the AI service when you actively request an ad. The images are used to understand the product and draft the listing."
    }
  };
  let dict=PACKS.no, lang='no';
  function apply(code){
    lang=code==='en'?'en':'no'; dict=PACKS[lang];
    document.documentElement.lang=lang;
    document.querySelectorAll('[data-i18n]').forEach(el=>{const v=dict[el.dataset.i18n]; if(v) el.textContent=v});
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const v=dict[el.dataset.i18nPlaceholder]; if(v) el.placeholder=v});
    document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
    try{localStorage.setItem('moneyPlannerLang',lang)}catch{}
    window.dispatchEvent(new CustomEvent('moneyplanner:language',{detail:{lang,dict}}));
  }
  window.MoneyI18n={load:async code=>apply(code),t:(k,f='')=>dict[k]||f,lang:()=>lang};
  window.addEventListener('DOMContentLoaded',()=>{
    let saved='no'; try{saved=localStorage.getItem('moneyPlannerLang')||((navigator.language||'').toLowerCase().startsWith('en')?'en':'no')}catch{}
    document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.lang)));
    apply(saved);
  });
})();