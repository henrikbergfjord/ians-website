(() => {
  const $=s=>document.querySelector(s);
  let images=[];
  const max=6;

  async function fileToDataURL(file){
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  }
  $('#sellImages')?.addEventListener('change', async e=>{
    const files=[...e.target.files].slice(0,max);
    images=await Promise.all(files.map(fileToDataURL));
    $('#sellPreview').innerHTML=images.map(x=>`<img src="${x}" alt="Produktbilde valgt av bruker">`).join('');
  });

  $('#generateAd')?.addEventListener('click', async ()=>{
    const product=$('#sellProduct').value.trim(), details=$('#sellDetails').value.trim(), condition=$('#sellCondition').value;
    if(!product){$('#sellStatus').textContent='Skriv hva du selger først.';return}
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