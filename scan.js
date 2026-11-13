// Binderdex scanner: håll kortet i ramen, appen hittar det själv.
const SC={idx:null,grp:{},ra:{},pr:{},back:null,stream:null,track:null,timer:null,last:null,streak:0,lock:null,tray:[],simg:{},oimg:null,uid:0,mode:'one',sound:true,torch:false,lastF:null,page:null};
const CODE2S={base1:'base',base2:'jungle',base3:'fossil',base5:'rocket'};
const COND=['NM','LP','MP','HP'];
const CONDN={NM:'Near Mint',LP:'Lightly Played',MP:'Moderately Played',HP:'Heavily Played'};
let EXTRA={},LEARN={},VARS={};
try{EXTRA=JSON.parse(localStorage.getItem('bdx_extra')||'{}');LEARN=JSON.parse(localStorage.getItem('bdx_learn')||'{}');VARS=JSON.parse(localStorage.getItem('bdx_var')||'{}');SC.sound=localStorage.getItem('bdx_snd')!=='0'}catch(e){}
const ls=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const base=id=>id.split('#')[0];

async function scLoadIdx(){
  if(SC.idx)return;
  const raw=await fetch('scanidx.json').then(r=>r.json());
  SC.grp=raw._grp||{};SC.ra=raw._ra||{};SC.pr=raw._pr||{};SC.back=SCAN.unpack(raw._back);SC.idx={};
  for(const k in raw)if(k[0]!=='_')SC.idx[k]=SCAN.unpack(raw[k]);
  for(const id in LEARN)LEARN[id].forEach((p,i)=>{try{SC.idx[id+'#L'+i]=SCAN.unpack(p)}catch(e){}});
}
// ---------- Kortinfo ----------
function owned(id){
  const sid=id.slice(0,id.indexOf('-')),n=id.slice(id.indexOf('-')+1);
  if(CODE2S[sid]){const c=DATA.cards.find(c=>c.s===CODE2S[sid]&&String(c.n)===n);return !!(c&&has(c))}
  return !!(DB.own.find(o=>o.s===sid&&o.n===n)||EXTRA[id]);
}
function scInfo(id){
  id=base(id);const sid=id.slice(0,id.indexOf('-')),n=id.slice(id.indexOf('-')+1);
  const x=DB.sets.find(a=>a.id===sid)||{nm:sid,t:0};
  let nm='',r=null;
  if(CODE2S[sid]){const c=DATA.cards.find(c=>c.s===CODE2S[sid]&&String(c.n)===n);if(c){nm=c.nm;r=c.r}}
  if(!nm&&DB.cards[sid]){const c=DB.cards[sid].find(c=>c[0]===n);if(c)nm=c[1]}
  const o=DB.own.find(o=>o.s===sid&&o.n===n);if(o)nm=nm||o.nm;
  const p=SC.pr[id]||[];if(r==null)r=p[0]!=null?p[0]:(o?o.r:null);
  const ra=SC.ra[id]||'';
  return {id,sid,n,nm,r,r1:p[1]||null,set:x.nm,tot:x.t,yr:(x.d||'').slice(0,4),ra,
    tag:['HOLO','PROMO','SHINING','SECRET','ULTRA','VMAX','HOLO EX','HOLO GX','HOLO V','LV.X','SHINY','PRISM','AMAZING','ILLUSTRATION','SPECIAL ILLU','HYPER','DOUBLE RARE','ACE SPEC'].includes(ra)?ra:'',
    has:owned(id),
    wotc:/^(base|gym|neo)/.test(sid)};
}
const CF={NM:1,LP:.85,MP:.65,HP:.45};
const price=t=>{const p=t.ed&&t.r1?t.r1:t.r;return p==null?null:Math.max(1,Math.round(p*(CF[t.cond]||1)))};
async function scImg(id,ed){
  id=base(id);const sid=id.slice(0,id.indexOf('-')),n=id.slice(id.indexOf('-')+1);
  if(CODE2S[sid])return (!ed&&IMGU[id])||`img/${id}.webp`;
  if(['basep','base4','base6','gym1','gym2','neo1','neo2','neo3','neo4'].includes(sid)){
    SC.simg[sid]=SC.simg[sid]||await fetch('simg/'+sid+'.json').then(r=>r.json()).catch(()=>({}));
    if(SC.simg[sid][n])return SC.simg[sid][n];
  }
  SC.oimg=SC.oimg||await fetch('oimg.json').then(r=>r.json()).catch(()=>({}));
  return SC.oimg[id]||'';
}
// ---------- Matchning ----------
function scBest(f){
  const raw=SCAN.match(f,SC.idx,24),m=[],seen0=new Set();
  for(const [s,k] of raw){const id=base(k);if(seen0.has(id))continue;seen0.add(id);m.push([s,id])}
  const b=m[0];
  const same=new Set([b[1],...(SC.grp[b[1]]||[])]);
  const other=m.find(x=>!same.has(x[1]));
  const pref=['base1','base2','base3','base5'],grp=[...same];
  const sc=i=>Math.min(SCAN.score(f,SC.idx[i]),...(LEARN[i]||[]).map((_,j)=>SC.idx[i+'#L'+j]?SCAN.score(f,SC.idx[i+'#L'+j]):99));
  const pg=grp.filter(i=>pref.includes(i.split('-')[0])).sort((a,c)=>sc(a)-sc(c));
  const pick=pg[0]||b[1];
  const top=[],seen=new Set();
  for(const [s,id] of m){if(seen.has(id))continue;const g=[id,...(SC.grp[id]||[])];g.forEach(x=>seen.add(x));top.push({id:g.find(i=>pref.includes(i.split('-')[0]))||id,s});if(top.length===8)break}
  return {id:pick,s:b[0],gap:other?other[0]-b[0]:99,alts:grp.filter(i=>i!==pick),back:SCAN.score(f,SC.back),top,f};
}
// Hitta kortets kanter i ett område runt ramen (kantprofiler)
const ecv=document.createElement('canvas'),ecx=ecv.getContext('2d',{willReadFrequently:true});
function refine(src,r,SW,SH,pad=.16){
  const [gx,gy,gw,gh]=r;
  const x0=Math.max(0,gx-gw*pad),y0=Math.max(0,gy-gh*pad),x1=Math.min(SW,gx+gw*(1+pad)),y1=Math.min(SH,gy+gh*(1+pad));
  const W=96,H=Math.round(W*(y1-y0)/(x1-x0));ecv.width=W;ecv.height=H;
  ecx.drawImage(src,x0,y0,x1-x0,y1-y0,0,0,W,H);
  const d=ecx.getImageData(0,0,W,H).data,g=new Float32Array(W*H);
  for(let i=0;i<W*H;i++)g[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];
  const col=new Float32Array(W),row=new Float32Array(H);
  for(let y=Math.floor(H*.2);y<H*.8;y++)for(let x=1;x<W-1;x++)col[x]+=Math.abs(g[y*W+x+1]-g[y*W+x-1]);
  for(let x=Math.floor(W*.2);x<W*.8;x++)for(let y=1;y<H-1;y++)row[y]+=Math.abs(g[(y+1)*W+x]-g[(y-1)*W+x]);
  // ytterst starka kanten (kortets ram, inte bildrutan inuti)
  const edge=(a,lo,hi,fromStart)=>{lo=Math.max(1,Math.floor(lo));hi=Math.min(a.length-1,Math.floor(hi));let mx=0;for(let i=lo;i<hi;i++)mx=Math.max(mx,a[i]);
    if(fromStart){for(let i=lo;i<hi;i++)if(a[i]>=mx*.55)return i}else{for(let i=hi-1;i>=lo;i--)if(a[i]>=mx*.55)return i}return fromStart?lo:hi};
  const L=edge(col,0,W*.42,true),R=edge(col,W*.58,W,false),T=edge(row,0,H*.42,true),B=edge(row,H*.58,H,false);
  const sx=(x1-x0)/W,sy=(y1-y0)/H;
  const rx=x0+L*sx,ry=y0+T*sy,rw=(R-L)*sx,rh=(B-T)*sy;
  const asp=rw/rh;
  if(asp<.62||asp>.82||rh<gh*.5)return null;
  return [rx,ry,rw,rh];
}
function bestAt(src,r,SW,SH){
  const a=scBest(SCAN.feat(src,...r));
  let best=a;const rr=refine(src,r,SW,SH);if(!rr)return a;
  const b=scBest(SCAN.feat(src,...rr));if(b.s<best.s)best=b;
  return best;
}

// ---------- UI ----------
const ICON={
  cam:'<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  ai:'<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  torch:'<svg viewBox="0 0 24 24"><path d="M8 3h8l-1 5H9zM9 8h6v3l-1.5 2v8h-3v-8L9 11z"/></svg>',
  snd:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="x" d="M16 9l6 6M22 9l-6 6"/></svg>',
  page:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9.3 3v18M14.7 3v18M4 9h16M4 15h16"/></svg>',
  one:'<svg viewBox="0 0 24 24"><rect x="7" y="3.5" width="10" height="17" rx="2"/></svg>'
};
function renderScan(){
  return `<div class="scan">
    <div class="cam" id="cam"><video id="scv" playsinline muted autoplay></video>
      <div class="guide"><i id="gbox">${'<b></b>'.repeat(9)}</i></div>
      <a class="scx" href="#pokedex" aria-label="Stäng">×</a>
      <button class="traybtn" id="traybtn"><b id="traycount">0</b> skannade<span id="traysum"></span></button>
      <div class="tools2">
        <button class="tb" id="modebtn" aria-label="Byt läge">${ICON.page}<span>Flera</span></button>
        <button class="tb hide" id="torchbtn" aria-label="Ficklampa">${ICON.torch}</button>
        <button class="tb${SC.sound?'':' off'}" id="sndbtn" aria-label="Ljud">${ICON.snd}</button>
      </div>
      <div class="pill" id="scpill">Startar kameran…</div>
      <div class="camoff hide" id="camoff"><b>Kameran går inte att starta här</b><span>Ta ett foto av kortet (eller en hel pärmsida) i stället.</span>
        <label class="trb big">📷 Ta foto<input type="file" accept="image/*" capture="environment" id="scfile" hidden></label></div>
      <button class="pageadd hide" id="pageadd"></button>
      <div class="deck" id="deck"></div>
      <div class="scbar">
        <label class="rb" aria-label="Ta foto">${ICON.cam}<span>Foto</span><input type="file" accept="image/*" capture="environment" id="scfile2" hidden></label>
        <div id="schit" class="schit empty"><span>Rikta kameran mot ett eller flera kort</span></div>
        <button class="rb" id="scai" aria-label="Fråga Claude">${ICON.ai}<span>Claude</span></button>
      </div>
    </div>
    <div class="tray" id="pick"></div>
    <div class="tray" id="tray"><div class="trayhd"><b>Skannade</b><button id="trayclose" aria-label="Stäng">×</button></div><div id="traylist"></div>
      <button class="savebtn" id="scsave" disabled>Spara i samlingen</button></div>
  </div>`;
}
function scPill(t,cls){const p=document.getElementById('scpill');if(p){p.textContent=t;p.className='pill'+(cls?' '+cls:'')}}
function scEmpty(t){const el=document.getElementById('schit');if(el){el.className='schit empty';el.innerHTML=`<span>${t}</span>`}}

// Slutarljud (genereras, ingen fil)
let AC=null;
function unlockAudio(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){}}
function shutter(){
  if(!SC.sound||!AC)return;
  try{
    const t=AC.currentTime,len=.09,buf=AC.createBuffer(1,AC.sampleRate*len,AC.sampleRate),ch=buf.getChannelData(0);
    for(let i=0;i<ch.length;i++){const k=i/ch.length;ch[i]=(Math.random()*2-1)*Math.pow(1-k,3)*(k<.45||k>.5?1:.2)}
    const s=AC.createBufferSource();s.buffer=buf;const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=1800;
    const g=AC.createGain();g.gain.value=.55;s.connect(f).connect(g).connect(AC.destination);s.start(t);
  }catch(e){}
}
function feedback(){shutter();try{navigator.vibrate&&navigator.vibrate(35)}catch(e){}}

async function scStart(){
  await scLoadIdx();
  bindScanUI();setMode(SC.mode);
  const v=document.getElementById('scv');
  try{
    SC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920}},audio:false});
    v.srcObject=SC.stream;await v.play();
    SC.track=SC.stream.getVideoTracks()[0];
    try{const c=SC.track.getCapabilities&&SC.track.getCapabilities();if(c&&c.torch)document.getElementById('torchbtn').classList.remove('hide')}catch(e){}
    scPill('Rikta mot ett eller flera kort');
    loop();
  }catch(e){
    document.getElementById('camoff').classList.remove('hide');scPill('','hide');
  }
}
function scStop(){if(SC.timer)clearTimeout(SC.timer);SC.timer=null;if(SC.stream){SC.stream.getTracks().forEach(t=>t.stop());SC.stream=null}SC.torch=false}
function loop(){SC.running=true;const t0=performance.now();try{SC.mode==='page'?pageTick():scTick()}catch(e){console.error(e)}SC.ms=performance.now()-t0;SC.timer=setTimeout(loop,Math.max(60,(SC.mode==='page'?450:180)-SC.ms))}
function restartLoop(){}
function setMode(m){
  SC.mode=m;SC.lock=null;SC.streak=0;SC.page=null;
  const cam=document.getElementById('cam');if(!cam)return;
  cam.classList.toggle('pagemode',m==='page');
  const b=document.getElementById('modebtn');b.innerHTML=m==='page'?ICON.one+'<span>Ett kort</span>':ICON.page+'<span>Flera</span>';
  document.getElementById('pageadd').classList.add('hide');
  document.querySelectorAll('#gbox b').forEach(x=>x.className='');
  if(SC.stream)scPill(m==='page'?'Fyll ramen med korten':'Rikta mot ett eller flera kort');
  restartLoop();
}
function guideRect(v){
  const box=v.getBoundingClientRect(),g=document.getElementById('gbox').getBoundingClientRect();
  const vw=v.videoWidth,vh=v.videoHeight;if(!vw)return null;
  const sc=Math.max(box.width/vw,box.height/vh),ox=(box.width-vw*sc)/2,oy=(box.height-vh*sc)/2;
  return [(g.left-box.left-ox)/sc,(g.top-box.top-oy)/sc,g.width/sc,g.height/sc];
}
function showBox(rr,state){
  const cam=document.getElementById('cam'),v=document.getElementById('scv');if(!cam||!v)return;
  let d=document.getElementById('cbox');if(!d){d=document.createElement('div');d.id='cbox';cam.appendChild(d)}
  if(!rr){d.className='';return}
  const box=v.getBoundingClientRect(),cb=cam.getBoundingClientRect(),vw=v.videoWidth,vh=v.videoHeight,sc=Math.max(box.width/vw,box.height/vh),ox=(box.width-vw*sc)/2,oy=(box.height-vh*sc)/2;
  const [x,y,w,h]=rr;d.style.cssText=`left:${box.left-cb.left+ox+x*sc}px;top:${box.top-cb.top+oy+y*sc}px;width:${w*sc}px;height:${h*sc}px`;d.className='on '+(state||'');
}
const dcv=document.createElement('canvas');dcv.width=63;dcv.height=88;
function debugShow(v,r,b){
  if(!SC.debug)return;let d=document.getElementById('dbg');
  if(!d){d=document.createElement('div');d.id='dbg';d.appendChild(dcv);d.appendChild(document.createElement('pre'));document.getElementById('cam').appendChild(d)}
  dcv.getContext('2d').drawImage(v,...r,0,0,63,88);
  d.querySelector('pre').textContent=`s ${b.s.toFixed(1)} gap ${b.gap.toFixed(1)}\n${b.id}\n${v.videoWidth}x${v.videoHeight} ${SC.ms?SC.ms.toFixed(0):'?'} ms`;
}
function scTick(){
  const v=document.getElementById('scv');if(!v||!v.videoWidth)return;
  const r=guideRect(v);if(!r)return;
  const W=v.videoWidth,H=v.videoHeight;
  // 1) hitta kortet i bilden
  const rr=refine(v,r,W,H);
  // 2) matcha (kortets egna kanter först, annars ramen)
  let b=scBest(SCAN.feat(v,...r));
  if(rr){const b2=scBest(SCAN.feat(v,...rr));if(b2.s<b.s)b=b2}
  SC.lastF=b.f;debugShow(v,rr||r,b);
  if(SC.lock){
    const d=Math.min(...[SC.lock,...(SC.grp[SC.lock]||[])].map(i=>SC.idx[i]?SCAN.score(b.f,SC.idx[i]):99));
    showBox(rr,'ok');
    if(d>34||b.s>34){SC.lock=null;scPill('Håll kortet i ramen')}
    return;
  }
  if(document.getElementById('pick').classList.contains('open'))return;
  const card=!!rr||b.s<34;
  if(!card){showBox(null);scPill('Håll kortet i ramen','scan');SC.streak=0;SC.unsure=0;SC.last=null;return}
  if(b.back<12){showBox(rr,'warn');scPill('Vänd på kortet 🙂');SC.streak=0;return}
  // vänta tills kortet hålls still en kort stund
  const pr=SC.prevR;SC.prevR=rr||r;
  const still=pr&&Math.abs(pr[0]-(rr||r)[0])<(rr||r)[2]*.04&&Math.abs(pr[1]-(rr||r)[1])<(rr||r)[3]*.04&&Math.abs(pr[2]-(rr||r)[2])<(rr||r)[2]*.05;
  SC.still=still?(SC.still||0)+1:0;
  showBox(rr,'seen');
  if(SC.still<2){scPill('Håll still…','seen');SC.streak=0;return}
  if(SC.last===b.id)SC.streak++;else{SC.last=b.id;SC.streak=1}
  const sure=(b.s<18&&b.gap>4)||(b.s<27&&b.gap>3&&SC.streak>=2)||(b.s<31&&b.gap>6&&SC.streak>=3);
  if(sure){SC.lock=b.id;SC.streak=0;SC.unsure=0;showBox(rr,'ok');scFound(b);return}
  scPill('Kort hittat – läser…','seen');
  SC.unsure=(SC.unsure||0)+1;
  if(SC.unsure>=7&&b.s<42){SC.unsure=0;SC.pickOpen=true;scPill('Välj rätt kort');scEmpty('Vilket kort är det?');scPick(null,b.top,b.f)}
}
// ---------- Pärmsida 3x3 ----------
function cells(r){const [x,y,w,h]=r,cw=w/3,ch=h/3,o=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)o.push([x+j*cw+cw*.04,y+i*ch+ch*.04,cw*.92,ch*.92]);return o}
function pageScan(src,r,SW,SH){
  return cells(r).map(c=>{const b=bestAt(src,c,SW,SH);const ok=b.back>=12&&((b.s<26&&b.gap>2.5)||(b.s<33&&b.gap>5));return {b,ok,empty:b.s>40}});
}
function pageTick(){
  const v=document.getElementById('scv');if(!v||!v.videoWidth)return;
  const r=guideRect(v);if(!r)return;
  const res=pageScan(v,r,v.videoWidth,v.videoHeight);
  // stabilt två gånger i rad per fack
  const prev=SC.page||[];
  if(SC.auto){const n=res.filter(x=>x.ok).length;SC.low=n<=1?(SC.low||0)+1:0;if(SC.low>=4){SC.auto=false;SC.low=0;setMode('one');return}}
  res.forEach((x,i)=>{x.stable=x.ok&&prev[i]&&prev[i].ok&&prev[i].b.id===x.b.id});
  SC.page=res;showPage(res);
}
function showPage(res){
  const bs=document.querySelectorAll('#gbox b');
  res.forEach((x,i)=>{bs[i].className=x.stable||x.photo?'ok':x.ok?'near':x.empty?'':'bad'});
  const n=res.filter(x=>x.stable||x.photo).length,btn=document.getElementById('pageadd');
  if(n){btn.classList.remove('hide');btn.textContent=`Lägg till ${n} kort`}else btn.classList.add('hide');
  scPill(n?`${n} kort hittade`:'Fyll ramen med korten',n?'ok':'');
}
async function pageAdd(){
  const res=(SC.page||[]).filter(x=>x.stable||x.photo);if(!res.length)return;
  feedback();
  for(const x of res)await addItem(x.b.id,x.b);
  scPill(`${res.length} kort tillagda`,'ok');SC.page=null;document.getElementById('pageadd').classList.add('hide');
  document.querySelectorAll('#gbox b').forEach(x=>x.className='');
}
// ---------- Travar och träffar ----------
async function addItem(id,b){
  const it=Object.assign(scInfo(id),{uid:++SC.uid,q:1,alts:b&&b.alts?b.alts:(SC.grp[id]||[]),top:b&&b.top||[],f:b&&b.f?SCAN.pack(b.f):null,ed:false,sl:false,cond:'NM'});
  it.img=await scImg(id);
  SC.tray.unshift(it);scShowHit(it);scTray();return it;
}
async function scFound(b){feedback();scPill('Hittade!','ok');await addItem(b.id,b)}
function itemByUid(u){return SC.tray.find(t=>t.uid===+u)}
function scShowHit(it){
  const el=document.getElementById('schit');if(!el||!it)return;
  const alts=(it.alts||[]).map(a=>scInfo(a));
  el.className='schit';el.dataset.uid=it.uid;
  el.innerHTML=`${it.img?`<img src="${it.img}" alt="" data-zoom="${it.img}">`:''}<div class="hm">
   <small>${it.set} · ${it.n}${it.tot?'/'+it.tot:''}</small>
   <b>${it.nm||'Okänt namn'}${it.tag?` <span class="vt">${it.tag}</span>`:''}</b>
   <div class="vars"><em class="${it.has?'hv':'nw'}">${it.has?'HAR REDAN':'NY'}</em>${it.wotc?`<button data-ed="${it.uid}" class="${it.ed?'on':''}">1st Ed</button>`:''}${it.sid==='base1'?`<button data-sl="${it.uid}" class="${it.sl?'on':''}">Shadowless</button>`:''}<button data-cond="${it.uid}">${CONDN[it.cond]}</button>${alts.map(a=>`<button data-swap="${it.uid}|${a.id}" class="alt">${a.set.replace('Legendary Collection','Legendary C.').replace('Base Set 2','Base 2')}${a.sid===it.sid?' '+a.n:''}${a.tag?' '+a.tag:''}</button>`).join('')}</div></div>
   <span class="val">${price(it)!=null?`${price(it).toLocaleString('sv-SE')} kr`:'–'}${it.ed&&!it.r1?'<small>1st-pris saknas</small>':''}<button class="wrong" data-wrong="${it.uid}">Fel kort?</button></span>`;
}
function scTray(){
  const D=document.getElementById('deck');
  const n=SC.tray.reduce((a,t)=>a+t.q,0),sum=SC.tray.reduce((a,t)=>a+(price(t)||0)*t.q,0),nw=SC.tray.filter(t=>!t.has).length;
  if(D){D.innerHTML=SC.tray.map(t=>`<div class="dc${t.has?' hv':''}" data-wrong="${t.uid}">${t.img?`<img src="${t.img}" alt="">`:`<span class="ph2">${t.nm}</span>`}${t.has?'':'<i class="nw">NY</i>'}${t.ed?'<i class="ed">1st</i>':''}<small>${price(t)!=null?price(t)+' kr':'–'}</small></div>`).join('')+(SC.tray.length?`<button class="dc save" id="scsave2">Spara<br>${n} st</button>`:'');D.classList.toggle('on',SC.tray.length>0)}
  document.getElementById('traycount').textContent=n;document.getElementById('traysum').textContent=n?` · ${sum.toLocaleString('sv-SE')} kr${nw?` · ${nw} nya`:''}`:'';
  const L=document.getElementById('traylist');if(!L)return;
  L.innerHTML=SC.tray.map(t=>`<div class="ti">${t.img?`<img src="${t.img}" alt="">`:'<span></span>'}<div><b>${t.nm}${t.tag?` <span class="vt">${t.tag}</span>`:''}</b><small>${t.set} ${t.n}${t.ed?' · 1st Ed':''}${t.sl?' · Shadowless':''} · ${CONDN[t.cond]} · ${t.has?'dubblett → byten':'<b class="nwt">ny</b>'}</small></div><span class="r">${price(t)!=null?price(t)+' kr':'–'}</span><button data-rm="${t.uid}" aria-label="Ta bort">×</button></div>`).join('')||'<div class="lnote" style="margin:8px 0">Korten du skannar hamnar här.</div>';
  document.getElementById('scsave').disabled=!SC.tray.length;
}
let TRADE=[];try{TRADE=JSON.parse(localStorage.getItem('bdx_trade')||'[]')}catch(e){}
function gen1Have(){return new Set(DATA.dex.filter(d=>d.o.length||DATA.cards.some(c=>c.d===d.d&&has(c))).map(d=>d.d))}
function scSave(){
  const before=gen1Have(),setsBefore={};for(const s in SETS)setsBefore[s]=DATA.cards.filter(c=>c.s===s&&has(c)).length;
  let nNew=0,nTrade=0,tradeKr=0;
  for(const t of SC.tray){
    (VARS[t.id]=VARS[t.id]||[]).push({ed:t.ed?1:0,sl:t.sl?1:0,c:t.cond,t:Date.now()});
    if(t.has){ // dubblett -> byteshög
      for(let i=0;i<t.q;i++)TRADE.unshift({id:t.id,nm:t.nm,set:t.set,n:t.n,ed:t.ed?1:0,cond:t.cond,r:price(t),t:Date.now()});
      nTrade+=t.q;tradeKr+=(price(t)||0)*t.q;continue;
    }
    nNew++;
    const s=CODE2S[t.sid];
    if(s){OV[s+'-'+t.n]=t.ed?'e1':'h';if(t.q>1)for(let i=1;i<t.q;i++)TRADE.unshift({id:t.id,nm:t.nm,set:t.set,n:t.n,ed:t.ed?1:0,cond:t.cond,r:price(t),t:Date.now()})}
    else{EXTRA[t.id]=(EXTRA[t.id]||0)+t.q}
  }
  ls('pk151ov',OV);ls('bdx_extra',EXTRA);ls('bdx_var',VARS);ls('bdx_trade',TRADE);
  // vad fylldes?
  const after=gen1Have(),gained=DATA.dex.filter(d=>after.has(d.d)&&!before.has(d.d)).map(d=>d.nm);
  const setMsg=[];for(const s in SETS){const n=DATA.cards.filter(c=>c.s===s&&has(c)).length-setsBefore[s];if(n>0)setMsg.push(`+${n} i ${SETS[s].name.replace('Team ','')}`)}
  SC.tray=[];scTray();document.getElementById('tray').classList.remove('open');
  const lines=[];
  if(gained.length)lines.push(`🎉 ${gained.slice(0,3).join(', ')}${gained.length>3?` och ${gained.length-3} till`:''} fyllde ${gained.length>1?'luckor':'en lucka'} i Gen 1!`);
  if(setMsg.length)lines.push(setMsg.join(' · '));
  if(nNew&&!gained.length&&!setMsg.length)lines.push(`✅ ${nNew} nya kort sparade`);
  if(nTrade)lines.push(`🔁 ${nTrade} dubbletter till byteshögen (~${tradeKr.toLocaleString('sv-SE')} kr)`);
  const el=document.getElementById('schit');el.className='schit empty saved';el.innerHTML=`<span>${lines.join('<br>')||'Sparat'}</span>`;
  if(gained.length)scPill(`🎉 ${gained.length} ny${gained.length>1?'a':''} i Gen 1`,'ok');
}
// Lär av rättningar: spara bilden som extra referens för rätt kort
function learn(id,fp){
  if(!fp)return;id=base(id);
  const L=LEARN[id]=LEARN[id]||[];L.unshift(fp);if(L.length>3)L.length=3;
  for(const k of Object.keys(SC.idx))if(k.startsWith(id+'#L'))delete SC.idx[k];
  L.forEach((p,i)=>SC.idx[id+'#L'+i]=SCAN.unpack(p));
  ls('bdx_learn',LEARN);
}
// ---------- Välj rätt kort ----------
async function scPick(uid,topIn,f){
  const it=uid?itemByUid(uid):null;
  const top=(topIn||(it&&it.top)||[]).filter(t=>!it||t.id!==it.id);
  const p=document.getElementById('pick');p.dataset.uid=uid||'';p.dataset.f=f?SCAN.pack(f):(it&&it.f)||'';
  const tiles=top.map(t=>{const c=scInfo(t.id);return `<button class="cand" data-choose="${c.id}"><span class="ci" data-cimg="${c.id}"></span><span class="zb" data-zoomid="${c.id}">🔍</span><b>${c.nm||'?'}</b>${c.tag?`<span class="vt">${c.tag}</span>`:''}<small>${c.set} · ${c.yr}<br>${c.n}${c.tot?'/'+c.tot:''}</small>${c.r!=null?`<em>${c.r} kr</em>`:''}</button>`}).join('');
  p.innerHTML=`<div class="trayhd"><b>${uid?'Fel kort? Välj rätt':'Vilket kort är det?'}</b><button data-pclose aria-label="Stäng">×</button></div><div class="pick-hint">Inget stämmer? Stäng eller tryck på kameran för att skanna igen</div>
   <div class="carousel">${tiles}<div class="cand last"><b>Inget stämmer?</b><button class="lb" data-psearch>🔍 Sök</button><button class="lb" data-skip="${uid||''}">Hoppa över</button></div></div>
   <div class="psearch hide" id="psearch"><input id="pq" type="search" placeholder="Sök namn, t.ex. Charizard" autocomplete="off"><div id="pres"></div></div>`;
  p.classList.add('open');
  const q=document.getElementById('pq');q.oninput=()=>scSearch(q.value);
  for(const t of top)scImg(t.id).then(u=>{const e=p.querySelector(`[data-cimg="${t.id}"]`);if(e&&u)e.innerHTML=`<img src="${u}" alt="">`});
}
function scAll(){
  if(SC.all)return SC.all;const A=[],seen=new Set();
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
  const p=document.getElementById('pick'),uid=p.dataset.uid,fp=p.dataset.f;
  if(uid)SC.tray=SC.tray.filter(t=>t.uid!==+uid);
  learn(id,fp);
  p.classList.remove('open');feedback();
  const it=await addItem(id,{f:fp?SCAN.unpack(fp):null});
  scPill('Tillagt','ok');SC.lock=id;
}
// ---------- Foto ----------
async function scPhoto(file){
  if(!file)return;scPill('Letar i bilden…');
  const url=URL.createObjectURL(file);const im0=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=url});
  // iPhone-foton är 12 MP: skala ned i steg först, annars blir små utsnitt brusiga i Safari
  let src=im0,w0=im0.naturalWidth,h0=im0.naturalHeight;
  while(Math.max(w0,h0)>1000){const c=document.createElement('canvas');c.width=Math.round(w0/2);c.height=Math.round(h0/2);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);src=c;w0=c.width;h0=c.height}
  const im=src,W=w0,H=h0;SC.photo={file};
  if(SC.mode==='page'){
    let h=H*.94,w=h*0.716;if(w>W*.94){w=W*.94;h=w/0.716}
    const res=pageScan(im,[(W-w)/2,(H-h)/2,w,h],W,H);res.forEach(x=>x.photo=x.ok);SC.page=res;showPage(res);return;
  }
  let best=null;
  for(const s of [.95,.85,.75,.65,.55,.45,.38]){
    let h=H*s,w=h*63/88;if(w>W*s){w=W*s;h=w*88/63}
    for(const dx of [-.12,0,.12])for(const dy of [-.1,0,.1]){
      const x=(W-w)/2+dx*W,y=(H-h)/2+dy*H;if(x<0||y<0||x+w>W||y+h>H)continue;
      const b=bestAt(im,[x,y,w,h],W,H);if(!best||b.s<best.s)best=b;
    }
  }
  if(best&&best.s<26&&best.gap>3)scFound(best);
  else if(best&&best.s<32){scPill('Osäker – välj rätt kort');scPick(null,best.top,best.f)}
  else{scPill('Frågar Claude…');scAsk()}
}
async function scBlob(){
  if(SC.photo&&!SC.stream)return SC.photo.file;
  const v=document.getElementById('scv');if(!v||!v.videoWidth)return null;
  const r=guideRect(v),c=document.createElement('canvas');c.width=630;c.height=880;
  c.getContext('2d').drawImage(v,...r,0,0,630,880);
  return await new Promise(res=>c.toBlob(res,'image/jpeg',.9));
}
async function scAsk(){
  const btn=document.getElementById('scai');
  let sample=null;try{sample=window.claude&&await window.claude.use('sample')}catch(e){}
  if(!sample){scEmpty('Claude-tolkning fungerar i den publicerade appen.');return}
  const blob=await scBlob();if(!blob)return;
  btn.disabled=true;btn.classList.add('busy');scPill('Claude tittar…');
  try{
    const res=await sample.json(`Identify this Pokémon trading card from the photo. Read the card name, the collector number printed at the bottom (like "4/102"), the expansion set (use the set symbol and number total), and whether it has a "1st Edition" stamp. Reply only with JSON: {"name":string,"number":string,"total":number|null,"set":string,"firstEdition":boolean,"confidence":"high"|"medium"|"low"}.`,{images:[blob],modelTier:'default'});
    const r=typeof res==='string'?JSON.parse(res):res;
    const nm=(r.set||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    let cands=DB.sets.filter(x=>{const a=x.nm.toLowerCase().replace(/[^a-z0-9]/g,'');return a===nm||a.includes(nm)||nm.includes(a)});
    if(r.total)cands.sort((a,b)=>(Math.abs((a.t||0)-r.total))-(Math.abs((b.t||0)-r.total)));
    const x=cands[0];const num=String(r.number||'').split('/')[0].replace(/^0+/,'');
    if(x&&num){const it=await addItem(x.id+'-'+num,null);it.nm=it.nm||r.name;it.ed=!!r.firstEdition&&it.wotc;scShowHit(it);scTray();feedback();scPill('Claude hittade kortet','ok')}
    else scEmpty(`Claude läste: ${r.name||'?'} · ${r.number||'?'} · ${r.set||'?'}, men setet finns inte i vårt index än.`);
  }catch(e){scEmpty('Claude kunde inte läsa kortet just nu. Prova igen.')}
  btn.disabled=false;btn.classList.remove('busy');
}
function bindScanUI(){
  const m=document.getElementById('main');
  m.addEventListener('touchstart',unlockAudio,{passive:true});m.addEventListener('mousedown',unlockAudio);
  m.onclick=e=>{
    unlockAudio();
    const q=s=>e.target.closest(s);let t;
    if(t=q('[data-rm]')){SC.tray=SC.tray.filter(x=>x.uid!==+t.dataset.rm);scTray();return}
    if(t=q('[data-ed]')){const it=itemByUid(t.dataset.ed);it.ed=!it.ed;scImg(it.id,it.ed).then(u=>{it.img=u;scShowHit(it);scTray()});return}
    if(t=q('[data-zoom]')){e.stopPropagation();zoom(t.dataset.zoom);return}
    if(q('#zoom')){document.getElementById('zoom').remove();return}
    if(t=q('[data-sl]')){const it=itemByUid(t.dataset.sl);it.sl=!it.sl;scShowHit(it);scTray();return}
    if(t=q('[data-cond]')){const it=itemByUid(t.dataset.cond);it.cond=COND[(COND.indexOf(it.cond)+1)%4];scShowHit(it);scTray();return}
    if(t=q('[data-swap]')){const [u,to]=t.dataset.swap.split('|');const it=itemByUid(u);if(it){const from=it.id;learn(to,it.f);Object.assign(it,scInfo(to),{alts:[from,...(SC.grp[to]||[]).filter(a=>a!==from&&a!==to)]});scImg(to).then(x=>{it.img=x;scShowHit(it);scTray()})}return}
    if(e.target.id==='scsave'||q('#scsave2')){scSave();return}
    if(t=q('[data-zoomid]')){const im=document.querySelector(`[data-cimg="${t.dataset.zoomid}"] img`);if(im)zoom(im.src);return}
    if(t=q('[data-choose]')){scChoose(t.dataset.choose);return}
    if(t=q('[data-wrong]')){scPick(t.dataset.wrong);return}
    if(q('[data-psearch]')){document.getElementById('psearch').classList.remove('hide');document.getElementById('pq').focus();return}
    if(t=q('[data-skip]')){if(t.dataset.skip)SC.tray=SC.tray.filter(x=>x.uid!==+t.dataset.skip);scTray();closePick();scEmpty('Hoppade över kortet');return}
    if(document.getElementById('pick').classList.contains('open')&&q('#cam')&&!q('#pick')){closePick();return}
    if(q('[data-pclose]')){closePick();return}
    if(q('#traybtn')){document.getElementById('tray').classList.add('open');return}
    if(e.target.id==='trayclose'){document.getElementById('tray').classList.remove('open');return}
    if(q('#scai')){scAsk();return}
    if(q('#scpill')){SC.debug=!SC.debug;const d=document.getElementById('dbg');if(d&&!SC.debug)d.remove();return}
    if(q('#modebtn')){SC.auto=false;setMode(SC.mode==='page'?'one':'page');return}
    if(q('#pageadd')){pageAdd();return}
    if(t=q('#gbox b')){const i=[...t.parentNode.children].indexOf(t),c=SC.page&&SC.page[i];if(c){scPick(null,c.b.top,c.b.f)}return}
    if(q('#sndbtn')){SC.sound=!SC.sound;q('#sndbtn').classList.toggle('off',!SC.sound);try{localStorage.setItem('bdx_snd',SC.sound?'1':'0')}catch(x){}if(SC.sound){unlockAudio();shutter()}return}
    if(q('#torchbtn')){SC.torch=!SC.torch;q('#torchbtn').classList.toggle('on',SC.torch);try{SC.track.applyConstraints({advanced:[{torch:SC.torch}]})}catch(x){}return}
  };
  ['scfile','scfile2'].forEach(i=>{const el=document.getElementById(i);if(el)el.onchange=()=>scPhoto(el.files[0])});
}

function zoom(src){const z=document.createElement('div');z.id='zoom';z.innerHTML=`<img src="${src}" alt=""><span>Tryck för att stänga</span>`;document.getElementById('main').appendChild(z)}

function closePick(){document.getElementById('pick').classList.remove('open');SC.lock=null;SC.streak=0;SC.unsure=0;SC.still=0;scPill('Håll kortet i ramen','scan')}
