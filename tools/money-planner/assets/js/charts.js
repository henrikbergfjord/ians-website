(() => {
  let expenseChart, savingsChart;
  const colors=['#536f64','#91a99d','#c8b18c','#73838a','#b97d70','#9b9f76','#6d8591','#b2a58f','#8b756d','#c9cfc7'];
  function init(){
    if(!window.Chart) return;
    const exp=document.getElementById('expenseChart');
    const sav=document.getElementById('savingsChart');
    expenseChart=new Chart(exp,{type:'doughnut',data:{labels:['Ingen data'],datasets:[{data:[1],backgroundColor:['#e7ebe5'],borderWidth:0}]},options:{plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,font:{size:10}}}},cutout:'68%',animation:{duration:280}}});
    savingsChart=new Chart(sav,{type:'line',data:{labels:['1 år','5 år','10 år','20 år'],datasets:[{label:'Innbetalt',data:[0,0,0,0],borderColor:'#9aa89f',backgroundColor:'rgba(154,168,159,.12)',fill:true,tension:.3},{label:'Scenarioverdi',data:[0,0,0,0],borderColor:'#446b5c',backgroundColor:'rgba(68,107,92,.08)',fill:true,tension:.3}]},options:{plugins:{legend:{display:true,labels:{boxWidth:10,usePointStyle:true,font:{size:10}}}},scales:{y:{ticks:{callback:v=>new Intl.NumberFormat('nb-NO',{notation:'compact'}).format(v)}}},animation:{duration:280}}});
  }
  function update(r){
    if(!expenseChart||!savingsChart) return;
    const entries=Object.entries(r.monthlyExpenses).filter(([,v])=>v>0);
    if(r.annualReserve>0) entries.push(['Årsreserve',r.annualReserve]);
    expenseChart.data.labels=entries.length?entries.map(x=>x[0]):['Ingen data'];
    expenseChart.data.datasets[0].data=entries.length?entries.map(x=>x[1]):[1];
    expenseChart.data.datasets[0].backgroundColor=entries.length?entries.map((_,i)=>colors[i%colors.length]):['#e7ebe5'];
    expenseChart.update();
    savingsChart.data.datasets[0].data=r.projections.map(x=>x.contributed);
    savingsChart.data.datasets[1].data=r.projections.map(x=>x.value);
    savingsChart.update();
  }
  window.MoneyCharts={init,update};
})();