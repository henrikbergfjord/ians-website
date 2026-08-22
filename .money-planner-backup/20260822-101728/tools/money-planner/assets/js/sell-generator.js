(() => {
  const $=s=>document.querySelector(s);
  let images=[];
  const max=6;

  async function fileToDataURL(file){
    const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    return await new Promise(resolve=>{
      const img=new Image(); img.onload=()=>{
        const max=1280, scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',.78));
      }; img.src=raw;
    });
  }
  $('#sellImages')?.addEventListener('change', async e=>{
    const files=[...e.target.files].slice(0,max);
    images=await Promise.all(files.map(fileToDataURL));
    $('#sellPreview').innerHTML=images.map(x=>`<img src="${x}" alt="Produktbilde valgt av bruker">`).join('');
  });

  $('#generateAd')?.addEventListener('click', async ()=>{
    const product=$('#sellProduct').value.trim(), details=$('#sellDetails').value.trim(), condition=$('#sellCondition').value;
    if(!product){$('#sellStatus').textContent='Skriv hva du selger først.';return}
    if(!$('#sellConsent')?.checked){$('#sellStatus').textContent='Les og godta informasjonen om bildebehandling før du bruker AI-annonselageren.';return}
    $('#sellStatus').textContent='Lager annonseforslag…';
    $('#generateAd').disabled=true;
    try{
      const res=await fetch('/api/sell-ad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product,details,condition,images})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||`HTTP ${res.status}`);
      $('#adTitle').value=body.title||'';
      $('#adBody').value=body.body||'';
      $('#priceFast').textContent=body.priceFast||'–';
      $('#priceFair').textContent=body.priceFair||'–';
      $('#priceTry').textContent=body.priceTry||'–';
      $('#adResult').hidden=false;
      $('#sellStatus').textContent='Ferdig. Les gjennom og korriger fakta før du publiserer.';
    }catch(err){
      $('#sellStatus').textContent='AI-annonsen er ikke tilgjengelig ennå. Når AI-endepunktet er konfigurert vil denne funksjonen virke. Teknisk: '+err.message;
    }finally{$('#generateAd').disabled=false}
  });

  $('#copyAd')?.addEventListener('click',async()=>{
    const txt=`${$('#adTitle').value}\n\n${$('#adBody').value}\n\nPrisforslag\nRaskt salg: ${$('#priceFast').textContent}\nRealistisk: ${$('#priceFair').textContent}\nPrøv først: ${$('#priceTry').textContent}`;
    await navigator.clipboard.writeText(txt);
    $('#sellStatus').textContent='Annonseteksten er kopiert.';
  });

  $('#downloadAd')?.addEventListener('click',()=>{
    const txt=`${$('#adTitle').value}\n\n${$('#adBody').value}\n\nPRISESTIMAT (ikke live markedsdata)\nRaskt salg: ${$('#priceFast').textContent}\nRealistisk: ${$('#priceFair').textContent}\nPrøv først: ${$('#priceTry').textContent}\n\nKontroller alltid produktfakta og sammenlign med lignende annonser før publisering.`;
    const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='annonseforslag.txt';a.click();URL.revokeObjectURL(a.href);
  });
})();