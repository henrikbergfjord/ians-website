(() => {
  const side=document.querySelector('#v4Sidebar');
  const btn=document.querySelector('#v4MenuToggle');
  btn?.addEventListener('click',()=>side?.classList.toggle('open'));
  side?.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{
    if(window.innerWidth<1050) side.classList.remove('open');
  }));
})();