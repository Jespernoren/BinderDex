// Egna listor: Spara, Byta, Pärm 1 … Ett kort kan ligga i flera listor.
const LST=(()=>{
  let D=null;
  const load=()=>{
    if(D)return D;
    try{D=JSON.parse(localStorage.getItem('bdx_lists')||'null')}catch(e){D=null}
    if(!D)D={L:[{id:'spara',nm:'Spara'},{id:'byta',nm:'Byta'},{id:'parm1',nm:'Pärm 1'}],I:{}};
    // flytta gamla byteshögen hit
    try{const T=JSON.parse(localStorage.getItem('bdx_trade')||'[]');if(T.length&&!(D.I.byta||[]).length){D.I.byta=T;save();localStorage.removeItem('bdx_trade')}}catch(e){}
    return D;
  };
  const save=()=>{try{localStorage.setItem('bdx_lists',JSON.stringify(D))}catch(e){}};
  return {
    all:()=>load().L,
    items:id=>load().I[id]||[],
    name:id=>(load().L.find(l=>l.id===id)||{}).nm||id,
    add(lid,e){load();(D.I[lid]=D.I[lid]||[]).unshift(Object.assign({t:Date.now()},e));save()},
    removeAt(lid,i){load();(D.I[lid]||[]).splice(i,1);save()},
    removeCard(lid,cid){load();const a=D.I[lid]||[];const i=a.findIndex(x=>x.id===cid);if(i>=0){a.splice(i,1);save()}},
    has:(lid,cid)=>(load().I[lid]||[]).some(x=>x.id===cid),
    of:cid=>load().L.filter(l=>(D.I[l.id]||[]).some(x=>x.id===cid)).map(l=>l.id),
    create(nm){load();let id=nm.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'').slice(0,20)||'lista';while(D.L.some(l=>l.id===id))id+='2';D.L.push({id,nm});save();return id},
    rename(id,nm){load();const l=D.L.find(l=>l.id===id);if(l){l.nm=nm;save()}},
    del(id){load();D.L=D.L.filter(l=>l.id!==id);delete D.I[id];save()},
    reload(){D=null}
  };
})();
// Kortet i ett bladark: chips för listor
function listChips(cid,info){
  return `<div class="lchips"><span>Listor</span>${LST.all().map(l=>`<button class="lchip${LST.has(l.id,cid)?' on':''}" data-lst="${l.id}">${LST.has(l.id,cid)?'✓ ':''}${l.nm}</button>`).join('')}</div>`;
}
function bindListChips(root,cid,info){
  root.querySelectorAll('[data-lst]').forEach(b=>b.onclick=()=>{
    const l=b.dataset.lst;
    if(LST.has(l,cid))LST.removeCard(l,cid);else LST.add(l,Object.assign({id:cid},info||{}));
    b.classList.toggle('on',LST.has(l,cid));b.textContent=(LST.has(l,cid)?'✓ ':'')+LST.name(l);
  });
}
