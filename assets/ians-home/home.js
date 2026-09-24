const menu=document.querySelector('.menu'),nav=document.querySelector('.nav');
menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Lukk meny':'Meny';});
const closeMenu=()=>{nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false');if(menu)menu.textContent='Meny';};
for(const trigger of document.querySelectorAll('[data-dialog]'))trigger.addEventListener('click',e=>{e.preventDefault();closeMenu();document.getElementById(trigger.dataset.dialog).showModal();});
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
// Local preview uses no credentials, no cost estimates and no production API calls.
// Add a reviewed public aggregate cost endpoint before presenting any figure as current.
const form=document.querySelector('.contact-form');
form?.addEventListener('submit',async e=>{e.preventDefault();const status=form.querySelector('[role=status]');if(['localhost','127.0.0.1'].includes(location.hostname)){status.textContent='Dette er en lokal forhåndsvisning. Meldingen er ikke sendt.';return;}if(!form.reportValidity())return;const button=form.querySelector('button');button.disabled=true;status.textContent='Sender…';try{const payload={...Object.fromEntries(new FormData(form)),type:'privat',company:'',source:location.pathname};const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw Error();status.textContent='Henvendelsen er mottatt.';form.reset();}catch{status.textContent='Kunne ikke sende. Prøv igjen senere. Teksten din er beholdt.';}finally{button.disabled=false;}});

const initialDialog=document.getElementById(location.hash.slice(1));
if(initialDialog?.tagName==='DIALOG')initialDialog.showModal();
