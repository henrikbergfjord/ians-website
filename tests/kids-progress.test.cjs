const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('academy/kids/lessons.js','utf8')+'\n'+fs.readFileSync('academy/kids/app.js','utf8');
function boot(data=new Map(),blocked=false){
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{value:'',style:{},textContent:'',innerHTML:'',focus(){},scrollIntoView(){}});return nodes.get(id)}
 const ctx=vm.createContext({document:{getElementById:node},location:{reload(){}},localStorage:{getItem(k){if(blocked)throw Error('blocked');return data.get(k)??null},setItem(k,v){if(blocked)throw Error('blocked');data.set(k,v)}}});
 vm.runInContext(source,ctx);
 return {data,node,run:s=>vm.runInContext(s,ctx),login(name='Ian',pin='1234'){node('name').value=name;node('pin').value=pin;node('loginBtn').onclick()}};
}
test('resume survives reload and legacy profile is preserved',()=>{
 const a=boot();a.login();a.run('answer(lessons[0].c);next();answer(lessons[1].c);next()');
 const b=boot(a.data);b.login();assert.equal(b.run('p.current'),2);assert.equal(b.run('p.xp'),50);
 const legacy=b.run('JSON.stringify(p)');const data=new Map([['iansAcademyKidsV2',legacy]]);const c=boot(data);c.login();assert.equal(c.run('p.current'),2);assert.equal(data.get('iansAcademyKidsV2'),legacy);
});
test('a different name never overwrites another profile',()=>{
 const a=boot();a.login();a.run('answer(lessons[0].c)');const b=boot(a.data);b.login('Guest');b.run('answer(lessons[0].c)');const c=boot(a.data);c.login();assert.equal(c.run('p.xp'),25);assert.equal(c.run('p.name'),'Ian');
});
test('wrong PIN leaves saved profile unchanged',()=>{
 const a=boot();a.login();const before=JSON.stringify([...a.data]);const b=boot(a.data);b.login('Ian','9999');assert.equal(b.run('p'),null);assert.equal(JSON.stringify([...a.data]),before);
});
test('going back does not relock completed worlds or award duplicate XP',()=>{
 const a=boot();a.login();a.run('for(let i=0;i<5;i++){answer(lessons[p.current].c);next()} jump(0);answer(lessons[0].c)');assert.equal(a.run('p.xp'),125);assert.equal(a.run('unlocked(5)'),true);a.run('jump(5)');assert.equal(a.run('p.current'),5);a.run('jump(14)');assert.equal(a.run('p.current'),5);
});
test('first button opens first lesson without resetting progress; resume finds next',()=>{
 const a=boot();a.login();a.run('answer(lessons[0].c);next();answer(lessons[1].c)');a.node('firstBtn').onclick();assert.equal(a.run('p.current'),0);assert.equal(a.run('p.xp'),50);a.node('resumeBtn').onclick();assert.equal(a.run('p.current'),2);
});
test('blocked and corrupt storage are reported without overwriting records',()=>{
 const a=boot(new Map(),true);a.login();assert.equal(a.run('p'),null);assert.match(a.node('saveStatus').textContent,/lagring/);
 const data=new Map([['iansAcademyKidsV2','{bad']]);const b=boot(data);b.login();assert.equal(b.run('p'),null);assert.equal(data.get('iansAcademyKidsV2'),'{bad');
});
test('final lesson stays valid after a complete journey and reload',()=>{
 const a=boot();a.login();a.run('for(let i=0;i<lessons.length;i++){answer(lessons[p.current].c);next()}');const b=boot(a.data);b.login();const total=b.run('lessons.length');assert.equal(b.run('p.completed.length'),total);assert.equal(b.run('p.current'),total-1);assert.equal(b.run('p.xp'),total*25);
});
