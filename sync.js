// Binderdex konton + synk via Supabase (Auth med e-postlänk + en rad per användare).
// Aktiveras när config.js har url och nyckel. Annars gör filen ingenting.
(function(){
const CFG=window.BDX_SUPA||{};
const ON=!!(CFG.url&&CFG.key);
const KEYS=['pk151ov','bdx_extra','bdx_trade','bdx_var','bdx_learn','bdx_blank','bdx_sets'];
const S={on:ON,session:null,pushT:null,busy:false};
window.BDXSYNC=S;
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const set=k=>(v)=>{try{localStorage.setItem(k,v)}catch(e){}};
function loadSession(){try{S.session=JSON.parse(get('bdx_session')||'null')}catch(e){S.session=null}}
function saveSession(s){S.session=s;try{s?localStorage.setItem('bdx_session',JSON.stringify(s)):localStorage.removeItem('bdx_session')}catch(e){}}
// 1) inloggningslänken kommer tillbaka med #access_token=…
(function(){
  const h=location.hash;
  if(h.includes('access_token=')){
    const p=new URLSearchParams(h.slice(1));
    saveSession({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+(+p.get('expires_in')||3600)});
    history.replaceState(null,'',location.pathname+'#samling');S.justLoggedIn=true;
  }else if(h.includes('error_description=')){history.replaceState(null,'',location.pathname+'#samling');S.loginError=decodeURIComponent((h.match(/error_description=([^&]*)/)||[])[1]||'').replace(/\+/g,' ')}
})();
loadSession();
async function api(path,opt={}){
  await ensureFresh();
  const r=await fetch(CFG.url+path,Object.assign({},opt,{headers:Object.assign({apikey:CFG.key,'Content-Type':'application/json',Authorization:'Bearer '+(S.session?S.session.access_token:CFG.key)},opt.headers||{})}));
  if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,200));
  const t=await r.text();return t?JSON.parse(t):null;
}
async function ensureFresh(){
  const s=S.session;if(!s||!s.refresh_token)return;
  if(s.expires_at-60>Date.now()/1000)return;
  const r=await fetch(CFG.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:CFG.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
  if(!r.ok){saveSession(null);return}
  const j=await r.json();saveSession({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600),email:(j.user||{}).email||s.email,uid:(j.user||{}).id||s.uid});
}
async function me(){if(S.session&&S.session.uid)return S.session;const u=await api('/auth/v1/user');S.session.uid=u.id;S.session.email=u.email;saveSession(S.session);return S.session}
function snapshot(){const d={};for(const k of KEYS){const v=get(k);if(v!=null)d[k]=v}return d}
function apply(d){for(const k of KEYS){if(d[k]!=null)set(k)(d[k]);else try{localStorage.removeItem(k)}catch(e){}}}
S.login=async email=>{
  const r=await fetch(CFG.url+'/auth/v1/otp',{method:'POST',headers:{apikey:CFG.key,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true,options:{email_redirect_to:location.origin+location.pathname}})});
  if(!r.ok)throw new Error((await r.text()).slice(0,200));
};
S.logout=()=>{saveSession(null);location.hash='#samling';location.reload()};
S.pull=async()=>{const u=await me();const rows=await api('/rest/v1/collections?select=data,updated_at&user_id=eq.'+u.uid);return rows&&rows[0]};
S.push=async()=>{
  if(!S.session)return;const u=await me();
  await api('/rest/v1/collections?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:u.uid,data:snapshot(),updated_at:new Date().toISOString()})});
  set('bdx_synced')(String(Date.now()));S.status='Synkat '+new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});S.onstatus&&S.onstatus();
};
// 2) spara automatiskt när samlingen ändras
const orig=Storage.prototype.setItem;
Storage.prototype.setItem=function(k,v){orig.call(this,k,v);if(ON&&S.session&&KEYS.includes(k)&&!S.applying){clearTimeout(S.pushT);S.pushT=setTimeout(()=>S.push().catch(e=>{S.status='Kunde inte synka';S.onstatus&&S.onstatus()}),1200)}};
// 3) vid start: hämta från servern
S.start=async(onChange)=>{
  if(!ON||!S.session)return;
  try{
    const row=await S.pull();
    if(!row){S.needsChoice=true;onChange&&onChange();return}
    const local=+(get('bdx_synced')||0),remote=Date.parse(row.updated_at)||0;
    if(remote>local||S.justLoggedIn){S.applying=true;apply(row.data||{});S.applying=false;set('bdx_synced')(String(remote));onChange&&onChange(true)}
    S.status='Synkat';S.onstatus&&S.onstatus();
  }catch(e){S.status='Offline';S.onstatus&&S.onstatus()}
};
S.chooseStart=async(mode)=>{ // 'device' = ladda upp den här enhetens samling, 'blank' = börja tomt
  S.applying=true;
  if(mode==='blank'){for(const k of KEYS)try{localStorage.removeItem(k)}catch(e){};set('bdx_blank')('1')}
  S.applying=false;S.needsChoice=false;await S.push();
};
})();
