(() => {
  const topLinks=[...document.querySelectorAll('.site-header nav a[href^="#"]')];
  const sideLinks=[...document.querySelectorAll('.v4-side-nav a[href^="#"]')];

  function sync(){
    const current = sideLinks.find(a=>a.classList.contains('active'))?.getAttribute('href') || '#oversikt';
    topLinks.forEach(a=>a.classList.toggle('nav-current',a.getAttribute('href')===current));
  }

  const obs=new MutationObserver(sync);
  sideLinks.forEach(a=>obs.observe(a,{attributes:true,attributeFilter:['class']}));
  window.addEventListener('DOMContentLoaded',sync);
})();