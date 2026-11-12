// Binderdex scanner: håll kortet i ramen, appen hittar det själv.
const SC={idx:null,grp:{},back:null,stream:null,timer:null,last:null,streak:0,lock:null,tray:[],busy:false,simg:{},oimg:null};
const CODE2S={base1:'base',base2:'jungle',base3:'fossil',base5:'rocket'};
let EXTRA={};try{EXTRA=JSON.parse(localStorage.getItem('bdx_extra')||'{}')}catch(e){}

async function scLoadIdx(){
  if(SC.idx)return;
  const raw=await fetch('scanidx.json').then(r=>r.json());
  SC.grp=raw._grp||{};SC.ra=raw._ra||{};SC.back=SCAN.unpack(raw._back);SC.idx={};
  for(const k in raw)if(k[0]!=='_')SC.idx[k]=SCAN.unpack(raw[k]);
}
function scInfo(id){
  const [sid,n]=[id.slice(0,id.indexOf('-')),id.slice(id.indexOf('-')+1)];
  const x=DB.sets.find(a=>a.id===sid)||{nm:sid,t:0};
  let nm='',r=null;
  if(CODE2S[sid]){const c=DATA.cards.find(c=>c.s===CODE2S[sid]&&String(c.n)===n);if(c){nm=c.nm;r=c.r}}
  if(!nm&&DB.cards[sid]){const c=DB.cards[sid].find(c=>c[0]===n);if(c)nm=c[1]}
  const o=DB.own.find(o=>o.s===sid&&o.n===n);if(o){nm=nm||o.nm;if(r==null)r=o.r}
  const ra=(SC.ra||{})[id]||'';
  return {id,sid,n,nm,r,set:x.nm,tot:x.t,yr:(x.d||'').slice(0,4),ra,tag:['HOLO','PROMO','SHINING','SECRET','ULTRA','VMAX','HOLO EX','HOLO GX','HOLO V','LV.X','SHINY','PRISM','AMAZING','ILLUSTRATION','SPECIAL ILLU','HYPER','DOUBLE RARE','ACE SPEC'].includes(ra)?ra:''};
}
async function scImg(id){
  const sid=id.slice(0,id.indexOf('-')),n=id.slice(id.indexOf('-')+1);
  if(CODE2S[sid])return `img/${id}.webp`;
  if(DB.cards[sid]&&['basep','base4','base6','gym1','gym2','neo1','neo2','neo3','neo4'].includes(sid)){
    SC.simg[sid]=SC.simg[sid]||await fetch('simg/'+sid+'.json').then(r=>r.json()).catch(()=>({}));
    if(SC.simg[sid][n])return SC.simg[sid][n];
  }
  SC.oimg=SC.oimg||await fetch('oimg.json').then(r=>r.json()).catch(()=>({}));
  return SC.oimg[id]||'';
}
// Bästa träff, med kort i samma bild (nytryck) räknade som samma
function scBest(f){
  const m=SCAN.match(f,SC.idx,14),b=m[0];
  const same=new Set([b[1],...(SC.grp[b[1]]||[])]);
  const other=m.find(x=>!same.has(x[1]));
  // Nytryck: välj i första hand setet du samlar på (Base, Jungle, Fossil, Rocket)
  const pref=['base1','base2','base3','base5'],grp=[...same];
  const sc=i=>SCAN.score(f,SC.idx[i]);
  const pg=grp.filter(i=>pref.includes(i.split('-')[0])).sort((a,c)=>sc(a)-sc(c));
  const pick=pg[0]||b[1];
  const top=[],seen=new Set();
  for(const [sc,id] of m){if(seen.has(id))continue;const g=[id,...(SC.grp[id]||[])];g.forEach(x=>seen.add(x));top.push({id:g.find(i=>pref.includes(i.split('-')[0]))||id,s:sc});if(top.length===8)break}
  return {id:pick,s:b[0],gap:other?other[0]-b[0]:99,alts:grp.filter(i=>i!==pick),back:SCAN.score(f,SC.back),top};
  return {id:b[1],s:b[0],gap:other?other[0]-b[0]:99,alts:SC.grp[b[1]]||[],back:SCAN.score(f,SC.back)};
}

function renderScan(){
  return `<div class="scan">
    <div class="cam" id="cam"><video id="scv" playsinline muted autoplay></video><div class="guide"><i></i></div>
      <a class="scx" href="#pokedex" aria-label="Stäng">×</a>
      <button class="traybtn" id="traybtn"><b id="traycount">0</b> skannade<span id="traysum"></span></button>
      <div class="pill" id="scpill">Startar kameran…</div>
      <div class="camoff hide" id="camoff"><b>Kameran går inte att starta här</b><span>Ta ett foto av kortet i stället. Låt kortet fylla bilden.</span>
        <label class="trb big">📷 Ta foto<input type="file" accept="image/*" capture="environment" id="scfile" hidden></label></div>
      <div class="deck" id="deck"></div>
      <div class="scbar">
        <label class="rb" aria-label="Ta foto"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><input type="file" accept="image/*" capture="environment" id="scfile2" hidden></label>
        <div id="schit" class="schit empty"><span>Rikta kameran mot ett kort</span></div>
        <button class="rb" id="scai" aria-label="Fråga Claude"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg></button>
      </div>
    </div>
    <div class="tray" id="pick"></div>
    <div class="tray" id="tray"><div class="trayhd"><b>Skannade</b><button id="trayclose" aria-label="Stäng">×</button></div><div id="traylist"></div>
      <button class="savebtn" id="scsave" disabled>Spara i samlingen</button></div>
  </div>`;
}
function scPill(t,cls){const p=document.getElementById('scpill');if(p){p.textContent=t;p.className='pill'+(cls?' '+cls:'')}}

async function scStart(){
  await scLoadIdx();
  bindScanUI();
  const v=document.getElementById('scv');
  try{
    SC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920}},audio:false});
    v.srcObject=SC.stream;await v.play();
    scPill('Håll kortet i ramen');
    SC.timer=setInterval(scTick,260);
  }catch(e){
    document.getElementById('camoff').classList.remove('hide');scPill('','hide');
  }
}
function scStop(){if(SC.timer)clearInterval(SC.timer);SC.timer=null;if(SC.stream){SC.stream.getTracks().forEach(t=>t.stop());SC.stream=null}}

function guideRect(v){
  const box=v.getBoundingClientRect(),g=v.parentNode.querySelector('.guide i').getBoundingClientRect();
  const vw=v.videoWidth,vh=v.videoHeight;if(!vw)return null;
  const sc=Math.max(box.width/vw,box.height/vh),ox=(box.width-vw*sc)/2,oy=(box.height-vh*sc)/2;
  return [(g.left-box.left-ox)/sc,(g.top-box.top-oy)/sc,g.width/sc,g.height/sc];
}
function scTick(){
  const v=document.getElementById('scv');if(!v||!v.videoWidth){return}
  const r=guideRect(v);if(!r)return;
  const f=SCAN.feat(v,...r);
  const b=scBest(f);
  if(SC.lock){ // vänta tills kortet byts
    const d=Math.min(...[SC.lock,...(SC.grp[SC.lock]||[])].map(i=>SCAN.score(f,SC.idx[i])));
    if(d>34||b.s>34){SC.lock=null;scPill('Håll kortet i ramen')}
    return;
  }
  if(b.back<12){scPill('Vänd på kortet 🙂');SC.streak=0;return}
  if(b.s>30){scPill('Söker…');SC.streak=0;SC.last=null;return}
  if(SC.last===b.id)SC.streak++;else{SC.last=b.id;SC.streak=1}
  const sure=(b.s<16&&b.gap>4)||(b.s<26&&b.gap>3&&SC.streak>=2);
  if(sure){SC.lock=b.id;SC.streak=0;SC.unsure=0;scFound(b,'kamera')}
  else{scPill('Nästan… håll still');SC.unsure=(SC.unsure||0)+1;if(SC.unsure===5){SC.lock=b.id;SC.unsure=0;scUnsure(b.top)}}
}
async function scFound(b,src){
  try{navigator.vibrate&&navigator.vibrate(35)}catch(e){}
  scPill('Hittade!','ok');
  const it=scInfo(b.id);it.alts=b.alts;it.q=1;it.top=b.top||[];it.img=await scImg(b.id);
  const prev=SC.tray.find(t=>t.id===it.id);if(prev)prev.q++;else SC.tray.unshift(it);
  scShowHit(prev||it);scTray();
}
async function scShowHit(it){
  const el=document.getElementById('schit');if(!el)return;
  const alts=(it.alts||[]).map(a=>scInfo(a));
  el.className='schit';
  el.innerHTML=`${it.img?`<img src="${it.img}" alt="">`:''}<div class="hm"><small>${it.set} · ${it.n}${it.tot?'/'+it.tot:''}</small><b>${it.nm||'Okänt namn'}${it.tag?` <span class="vt">${it.tag}</span>`:''}</b>
   ${alts.length?`<div class="alts">${alts.map(a=>`<button data-swap="${it.id}|${a.id}">${a.set.replace('Legendary Collection','Legendary C.')}${a.sid===it.sid?' '+a.n:''}${a.tag?' · '+a.tag:''}</button>`).join('')}</div>`:''}</div>
   <span class="val">${it.r!=null?`${it.r.toLocaleString('sv-SE')} kr`:'–'}<button class="wrong" data-wrong="${it.id}">Fel kort?</button></span>`;
}
// Osäker: visa tre bästa direkt i raden
async function scUnsure(top){
  scPill('Osäker – välj rätt kort');
  const el=document.getElementById('schit');if(el){el.className='schit empty';el.innerHTML='<span>Vilket kort är det?</span>'}
  scPick('',top);
}
// Fel kort: välj bland toppen, sök eller hoppa över
async function scPick(fromId,topIn){
  const it=fromId?SC.tray.find(t=>t.id===fromId):null;
  const top=(topIn||(it&&it.top)||[]).filter(t=>t.id!==fromId);
  const p=document.getElementById('pick');p.dataset.from=fromId||'';
  const tiles=top.map(t=>{const c=scInfo(t.id);return `<button class="cand" data-choose="${c.id}"><span class="ci" data-cimg="${c.id}"></span><b>${c.nm||'?'}</b>${c.tag?`<span class="vt">${c.tag}</span>`:''}<small>${c.set} · ${c.yr}<br>${c.n}${c.tot?'/'+c.tot:''}</small>${c.r!=null?`<em>${c.r} kr</em>`:''}</button>`}).join('');
  p.innerHTML=`<div class="trayhd"><b>${fromId?'Fel kort? Välj rätt':'Vilket kort är det?'}</b><button data-pclose aria-label="Stäng">×</button></div>
   <div class="carousel">${tiles}<div class="cand last"><b>Inget stämmer?</b><button class="lb" data-psearch>🔍 Sök</button><button class="lb" data-skip="${fromId||''}">Hoppa över</button></div></div>
   <div class="psearch hide" id="psearch"><input id="pq" type="search" placeholder="Sök namn, t.ex. Charizard" autocomplete="off"><div id="pres"></div></div>`;
  p.classList.add('open');
  const q=document.getElementById('pq');q.oninput=()=>scSearch(q.value);
  for(const t of top){scImg(t.id).then(u=>{const e=p.querySelector(`[data-cimg="${t.id}"]`);if(e&&u)e.innerHTML=`<img src="${u}" alt="">`})}
}
function scAll(){
  if(SC.all)return SC.all;const A=[];const seen=new Set();
  for(const c of DATA.cards){const id={base:'base1',jungle:'base2',fossil:'base3',rocket:'base5'}[c.s]+'-'+c.n;A.push([id,c.nm]);seen.add(id)}
  for(const sid in DB.cards)for(const c of DB.cards[sid]){const id=sid+'-'+c[0];if(!seen.has(id)){A.push([id,c[1]]);seen.add(id)}}
  for(const o of DB.own){const id=o.s+'-'+o.n;if(!seen.has(id)){A.push([id,o.nm]);seen.add(id)}}
  return SC.all=A;
}
function scSearch(q){
  q=q.trim().toLowerCase();const R=document.getElementById('pres');if(!R)return;
  if(q.length<2){R.innerHTML='';return}
  const hits=scAll().filter(([id,nm])=>nm.toLowerCase().includes(q)).slice(0,40).map(([id])=>scInfo(id));
  R.innerHTML=hits.map(c=>`<button class="pr2" data-choose="${c.id}"><b>${c.nm}${c.tag?` <span class="vt">${c.tag}</span>`:''}</b><small>${c.set} · ${c.yr} · ${c.n}${c.tot?'/'+c.tot:''}</small><span>${c.r!=null?c.r+' kr':''}</span></button>`).join('')||'<div class="lnote">Inga träffar.</div>';
}
async function scChoose(id){
  const p=document.getElementById('pick'),from=p.classList.contains('open')?p.dataset.from:'';
  if(from)SC.tray=SC.tray.filter(t=>t.id!==from);
  const it=scInfo(id);it.q=1;it.alts=SC.grp[id]||[];it.top=[];it.img=await scImg(id);
  const prev=SC.tray.find(t=>t.id===id);if(prev)prev.q++;else SC.tray.unshift(it);
  p.classList.remove('open');scShowHit(prev||it);scTray();scPill('Tillagt','ok');SC.lock=id;
}
function scTray(){
  const D=document.getElementById('deck');
  if(D){D.innerHTML=SC.tray.map(t=>`<div class="dc" data-wrong="${t.id}">${t.img?`<img src="${t.img}" alt="">`:`<span class="ph2">${t.nm}</span>`}${t.q>1?`<i>${t.q}×</i>`:''}<small>${t.r!=null?t.r+' kr':'–'}</small></div>`).join('')+(SC.tray.length?`<button class="dc save" id="scsave2">Spara<br>${SC.tray.reduce((a,t)=>a+t.q,0)} st</button>`:'');D.classList.toggle('on',SC.tray.length>0)}
  const L=document.getElementById('traylist');if(!L)return;
  const sum=SC.tray.reduce((a,t)=>a+(t.r||0)*t.q,0),n=SC.tray.reduce((a,t)=>a+t.q,0);
  document.getElementById('traycount').textContent=n;document.getElementById('traysum').textContent=n?` · ${sum.toLocaleString('sv-SE')} kr`:'';
  L.innerHTML=SC.tray.map(t=>`<div class="ti">${t.img?`<img src="${t.img}" alt="">`:'<span></span>'}<div><b>${t.nm}</b><small>${t.set} ${t.n}</small></div><span class="q">${t.q>1?t.q+'×':''}</span><span class="r">${t.r!=null?t.r+' kr':'–'}</span><button data-rm="${t.id}" aria-label="Ta bort">×</button></div>`).join('')||'<div class="lnote" style="margin:8px 0">Korten du skannar hamnar här.</div>';
  document.getElementById('scsave').disabled=!SC.tray.length;
}
function scSave(){
  for(const t of SC.tray){
    const s=CODE2S[t.sid];
    if(s){OV[s+'-'+t.n]='h'}
    else{EXTRA[t.id]=(EXTRA[t.id]||0)+t.q}
  }
  try{localStorage.setItem('pk151ov',JSON.stringify(OV));localStorage.setItem('bdx_extra',JSON.stringify(EXTRA))}catch(e){}
  const n=SC.tray.length;SC.tray=[];scTray();
  const el=document.getElementById('schit');el.className='schit empty';el.innerHTML=`<span>✅ ${n} kort sparade</span>`;document.getElementById('tray').classList.remove('open');
}
// Foto: prova flera utsnitt och välj bästa
async function scPhoto(file){
  if(!file)return;scPill('Letar i bilden…');
  const url=URL.createObjectURL(file);const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=url});
  let best=null;const W=im.naturalWidth,H=im.naturalHeight;
  for(const s of [.95,.85,.75,.65,.55]){
    let h=H*s,w=h*63/88;if(w>W*s){w=W*s;h=w*88/63}
    for(const dx of [-.12,0,.12])for(const dy of [-.1,0,.1]){
      const x=(W-w)/2+dx*W,y=(H-h)/2+dy*H;if(x<0||y<0||x+w>W||y+h>H)continue;
      const b=scBest(SCAN.feat(im,x,y,w,h));if(!best||b.s<best.s)best=Object.assign(b,{crop:[x,y,w,h]});
    }
  }
  SC.photo={im,crop:best&&best.crop,file};
  if(best&&best.s<28)scFound(best,'foto');
  else{scPill('Hittade inget säkert');const el=document.getElementById('schit');el.className='schit empty';el.innerHTML='<span>Hittade inget säkert. Prova "Fråga Claude" eller ta en ny bild närmare kortet.</span>'}
}
async function scBlob(){
  if(SC.photo&&!SC.stream){return SC.photo.file}
  const v=document.getElementById('scv');if(!v||!v.videoWidth)return null;
  const r=guideRect(v),c=document.createElement('canvas');c.width=630;c.height=880;
  c.getContext('2d').drawImage(v,...r,0,0,630,880);
  return await new Promise(res=>c.toBlob(res,'image/jpeg',.9));
}
async function scAsk(){
  const btn=document.getElementById('scai');
  let sample=null;try{sample=window.claude&&await window.claude.use('sample')}catch(e){}
  if(!sample){const el=document.getElementById('schit');el.className='schit empty';el.innerHTML='<span>Claude-tolkning fungerar i den publicerade appen.</span>';return}
  const blob=await scBlob();if(!blob)return;
  btn.disabled=true;btn.classList.add('busy');scPill('Claude tittar…');
  try{
    const res=await sample.json(`Identify this Pokémon trading card from the photo. Read the card name, the collector number printed at the bottom (like "4/102"), and the expansion set (use the set symbol and number total). Reply only with JSON: {"name":string,"number":string,"total":number|null,"set":string,"confidence":"high"|"medium"|"low"}.`,{images:[blob],modelTier:'default'});
    const r=typeof res==='string'?JSON.parse(res):res;
    const nm=(r.set||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    let cands=DB.sets.filter(x=>{const a=x.nm.toLowerCase().replace(/[^a-z0-9]/g,'');return a===nm||a.includes(nm)||nm.includes(a)});
    if(r.total)cands.sort((a,b)=>(Math.abs((a.t||0)-r.total))-(Math.abs((b.t||0)-r.total)));
    const x=cands[0];const num=String(r.number||'').split('/')[0].replace(/^0+/,'');
    if(x&&num){
      const id=x.id+'-'+num;
      const it=scInfo(id);it.nm=it.nm||r.name;it.q=1;it.alts=SC.grp[id]||[];it.img=await scImg(id);
      const prev=SC.tray.find(t=>t.id===id);if(prev)prev.q++;else SC.tray.unshift(it);
      scShowHit(prev||it);scTray();scPill('Claude hittade kortet','ok');
    }else{const el=document.getElementById('schit');el.className='schit empty';el.innerHTML=`<span>Claude läste: ${r.name||'?'} · ${r.number||'?'} · ${r.set||'?'}, men setet finns inte i vårt index än.</span>`}
  }catch(e){const el=document.getElementById('schit');el.className='schit empty';el.innerHTML='<span>Claude kunde inte läsa kortet just nu. Prova igen.</span>'}
  btn.disabled=false;btn.classList.remove('busy');
}
function bindScanUI(){
  const m=document.getElementById('main');
  m.onclick=e=>{
    const rm=e.target.closest('[data-rm]');if(rm){SC.tray=SC.tray.filter(t=>t.id!==rm.dataset.rm);scTray();return}
    const sw=e.target.closest('[data-swap]');if(sw){const [from,to]=sw.dataset.swap.split('|');const t=SC.tray.find(t=>t.id===from);if(t){const ni=scInfo(to);Object.assign(t,ni,{alts:[from,...(SC.grp[to]||[]).filter(a=>a!==from&&a!==to)]});scImg(to).then(u=>{t.img=u;scShowHit(t);scTray()})}return}
    if(e.target.id==='scsave'){scSave();return}
    const ch=e.target.closest('[data-choose]');if(ch){scChoose(ch.dataset.choose);return}
    const wr=e.target.closest('[data-wrong]');if(wr){scPick(wr.dataset.wrong);return}
    if(e.target.closest('[data-psearch]')){const ps=document.getElementById('psearch');ps.classList.remove('hide');document.getElementById('pq').focus();return}
    if(e.target.id==='scsave2'||e.target.closest('#scsave2')){scSave();return}
    const sk=e.target.closest('[data-skip]');if(sk){SC.tray=SC.tray.filter(t=>t.id!==sk.dataset.skip);scTray();document.getElementById('pick').classList.remove('open');const el=document.getElementById('schit');el.className='schit empty';el.innerHTML='<span>Hoppade över kortet</span>';return}
    if(e.target.closest('[data-pclose]')){document.getElementById('pick').classList.remove('open');return}
    if(e.target.closest('#traybtn')){document.getElementById('tray').classList.add('open');return}
    if(e.target.id==='trayclose'){document.getElementById('tray').classList.remove('open');return}
    if(e.target.closest('#scai')){scAsk();return}
  };
  ['scfile','scfile2'].forEach(i=>{const el=document.getElementById(i);if(el)el.onchange=()=>scPhoto(el.files[0])});
}
