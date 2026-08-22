(() => {
  const side = document.querySelector('#v4Sidebar');
  const btn = document.querySelector('#v4MenuToggle');
  const header = document.querySelector('.site-header');

  const allSidebarLinks = [...document.querySelectorAll('.v4-side-nav a')];
  const hashLinks = allSidebarLinks.filter(a => (a.getAttribute('href') || '').startsWith('#'));

  function setActive(href){
    allSidebarLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === href));
  }

  function scrollToHash(hash, push=true){
    if(!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if(!target) return;

    const headerH = header ? header.getBoundingClientRect().height : 0;
    const extra = window.innerWidth > 1050 ? 26 : 16;
    const y = target.getBoundingClientRect().top + window.scrollY - headerH - extra;

    window.scrollTo({top: Math.max(0,y), behavior:'smooth'});
    if(push && history.pushState){
      history.pushState(null,'',hash);
    }
    setActive(hash);

    if(window.innerWidth < 1050){
      side?.classList.remove('open');
    }
  }

  btn?.addEventListener('click',()=>side?.classList.toggle('open'));

  hashLinks.forEach(a=>{
    a.addEventListener('click',e=>{
      const href=a.getAttribute('href');
      if(document.querySelector(href)){
        e.preventDefault();
        scrollToHash(href,true);
      }
    });
  });

  // Also make top navigation use the same offset behavior.
  document.querySelectorAll('.site-header nav a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const href=a.getAttribute('href');
      if(document.querySelector(href)){
        e.preventDefault();
        scrollToHash(href,true);
      }
    });
  });

  // Highlight the section currently visible.
  const sectionMap = [
    ['#oversikt', document.querySelector('#oversikt')],
    ['#planner', document.querySelector('#planner')],
    ['#tools', document.querySelector('#tools')],
    ['#kids', document.querySelector('#kids')],
    ['#sell', document.querySelector('#sell')]
  ].filter(([,el])=>el);

  let ticking=false;
  function updateActiveFromScroll(){
    if(ticking) return;
    ticking=true;
    requestAnimationFrame(()=>{
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const probe = window.scrollY + headerH + 90;
      let current='#oversikt';

      for(const [hash,el] of sectionMap){
        if(el.offsetTop <= probe) current=hash;
      }

      // Do not override "I need help", because that's a separate page.
      setActive(current);
      ticking=false;
    });
  }

  window.addEventListener('scroll',updateActiveFromScroll,{passive:true});
  window.addEventListener('resize',updateActiveFromScroll);

  window.addEventListener('DOMContentLoaded',()=>{
    if(location.hash && document.querySelector(location.hash)){
      setTimeout(()=>scrollToHash(location.hash,false),80);
    } else {
      setActive('#oversikt');
    }
    updateActiveFromScroll();
  });
})();