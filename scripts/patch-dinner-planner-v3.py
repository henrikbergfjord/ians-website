from pathlib import Path
p=Path('tools/dinner-planner/index.html')
s=p.read_text()
# Widescreen desktop, compact/mobile layout.
s=s.replace('.wrap{width:min(1180px,92%);margin:32px auto}', '.wrap{width:min(1680px,94%);margin:28px auto}')
s=s.replace('.grid{display:grid;grid-template-columns:390px 1fr;gap:20px}', '.grid{display:grid;grid-template-columns:minmax(340px,420px) minmax(0,1fr);gap:22px;align-items:start}')
s=s.replace('.days{display:grid;gap:10px}', '.days{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}')
s=s.replace('@media(max-width:800px){.grid{grid-template-columns:1fr}.shopping{columns:1}}', '@media(max-width:1050px){.wrap{width:min(960px,94%)}.grid{grid-template-columns:340px 1fr}.days{grid-template-columns:1fr}}@media(max-width:760px){.top{padding:14px 4%}.wrap{width:94%;margin:18px auto}.hero h1{font-size:2.25rem}.grid{grid-template-columns:1fr}.card{padding:15px}.days{grid-template-columns:1fr}.shopping{columns:1}.btn{width:100%;margin-right:0}}')
# Replace PDF generator with richer multi-page branded recipe booklet.
a=s.index('function pdf(lang){')
b=s.index('renderFavs();',a)
pdf=r'''function pdf(lang){if(!current)return;const {jsPDF}=window.jspdf,d=new jsPDF(),en=lang==='en',W=210,H=297,M=14;let y=0;const page=()=>{d.addPage();y=18},need=n=>{if(y+n>278)page()},line=(txt,size=10,bold=false)=>{d.setFontSize(size);d.setFont(undefined,bold?'bold':'normal');for(const t of d.splitTextToSize(String(txt||''),W-M*2)){need(5);d.text(t,M,y);y+=4.6}},section=(icon,title)=>{need(13);y+=3;d.setFillColor(232,244,255);d.roundedRect(M,y-5,W-M*2,10,2,2,'F');d.setTextColor(20,70,110);d.setFontSize(12);d.setFont(undefined,'bold');d.text(icon+'  '+title,M+3,y+1.5);d.setTextColor(25);y+=10};
// Cover
d.setFillColor(3,11,21);d.rect(0,0,W,H,'F');d.setTextColor(255);d.setFont(undefined,'bold');d.setFontSize(30);d.text('IANS',M,35);d.setFontSize(20);d.text(en?'DINNER PLANNER':'MIDDAGSPLANLEGGER',M,49);d.setTextColor(120,210,255);d.setFontSize(13);d.text(en?'Meal plan · Recipes · Shopping · Smart savings':'Middagsplan · Oppskrifter · Handleliste · Smarte sparetips',M,61);d.setTextColor(255);d.setFontSize(15);d.text('🍽  '+current.n+(en?' days':' dager')+'   ·   👨‍👩‍👧  '+current.a+(en?' adults':' voksne')+' + '+current.c+(en?' children':' barn'),M,91);d.setTextColor(170);d.setFontSize(10);d.text(en?'Made with IANS · Practical planning for everyday life':'Laget med IANS · Praktisk planlegging for hverdagen',M,111);d.setFontSize(8);d.text(en?'Guidance only. Check allergies, food storage and safe preparation.':'Veiledende plan. Kontroller allergier, oppbevaring og trygg tilberedning.',M,270);d.text(en?'Responsible: Henrik Bergfjord · IANS technical lead':'Ansvarlig: Henrik Bergfjord · Teknisk ansvarlig, IANS',M,277);
// Weekly overview
page();section('📅',en?'WEEK AT A GLANCE':'UKEN PÅ ETT BLIKK');for(const m of current.meals||[]){need(9);d.setFont(undefined,'bold');d.setFontSize(10);d.text((en?'Day ':'Dag ')+(m.day||'')+'  ·  '+m.name,M,y);d.setFont(undefined,'normal');d.setTextColor(85);d.setFontSize(8);d.text((m.cuisine||'')+((m.tags||[]).length?'  ·  '+m.tags.map(t=>'#'+t).join(' '):''),M+5,y+4);d.setTextColor(25);y+=10}
// Full recipes
for(const m of current.meals||[]){page();section('🍽',(en?'DAY ':'DAG ')+(m.day||'')+' · '+m.name);if(m.cuisine)line((en?'Style: ':'Matpreg: ')+m.cuisine,9,true);y+=2;section('🛒',en?'INGREDIENTS':'INGREDIENSER');for(const ing of m.ingredients||[])line('• '+ing,10);section('👩‍🍳',en?'HOW TO MAKE IT':'SLIK GJØR DU');(m.steps||[]).forEach((st,i)=>line((i+1)+'. '+st,10));if(m.tip){section('💡',en?'COOKING TIP':'MATLAGINGSTIPS');line(m.tip,10)}}
// Shopping
page();section('🛒',en?'SHOPPING LIST':'HANDLELISTE');let groups={};for(const x of current.shopping||[]){let k=x.category||(en?'Other':'Annet');(groups[k]??=[]).push(x)}for(const [cat,items] of Object.entries(groups)){need(10);line(cat.toUpperCase(),10,true);for(const x of items)line('☐  '+x.item+(x.quantity?'  ·  '+x.quantity:''),10);y+=2}
// Tips
if((current.savingTips||[]).length||(current.cookingTips||[]).length){page();section('💰',en?'SMART SAVING TIPS':'SMARTE SPARETIPS');for(const t of current.savingTips||[])line('• '+t,10);section('👩‍🍳',en?'COOKING TIPS':'MATLAGINGSTIPS');for(const t of current.cookingTips||[])line('• '+t,10)}
// Footer on every page
const count=d.getNumberOfPages();for(let i=1;i<=count;i++){d.setPage(i);d.setDrawColor(210);d.line(M,287,W-M,287);d.setTextColor(120);d.setFontSize(7);d.setFont(undefined,'normal');d.text('IANS · '+(en?'Dinner Planner':'Middagsplanlegger'),M,292);d.text(String(i)+' / '+count,W-M,292,{align:'right'})}d.save(en?'IANS-dinner-plan-recipes.pdf':'IANS-middagsplan-oppskrifter.pdf')}
'''
s=s[:a]+pdf+s[b:]
p.write_text(s)
