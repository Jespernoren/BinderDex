// Binderdex: hitta kortets fyra hörn (som en dokumentskanner) och räta upp bilden.
(function(G){
const qc=document.createElement('canvas'),qx=qc.getContext('2d',{willReadFrequently:true});
const ASP=63/88;
G.QW=240;G.QI=4;G.QN=2;G.QL=48;G.QV=18;
const QW_=()=>G.QW;
// Linjer via Hough, styrd av gradientens riktning
function lines(g,W,H,mag,dir,thr){
  const NT=180,diag=Math.ceil(Math.hypot(W,H)),NR=diag*2+1,acc=new Uint16Array(NT*NR);
  const C=new Float32Array(NT),S=new Float32Array(NT);for(let t=0;t<NT;t++){C[t]=Math.cos(t*Math.PI/NT);S[t]=Math.sin(t*Math.PI/NT)}
  for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){const i=y*W+x;if(mag[i]<thr)continue;
    let t0=Math.round(dir[i]*NT/Math.PI);
    for(let dt=-5;dt<=5;dt++){let t=t0+dt,flip=false;if(t<0){t+=NT;flip=true}else if(t>=NT){t-=NT;flip=true}
      const r=Math.round(x*C[t]+y*S[t])+diag;acc[t*NR+r]++}}
  const pk=[];
  for(let t=0;t<NT;t++)for(let r=1;r<NR-1;r++){const v=acc[t*NR+r];if(v<12)continue;let m=true;
    for(let dt=-3;dt<=3&&m;dt++)for(let dr=-3;dr<=3;dr++){if(!dt&&!dr)continue;const tt=(t+dt+NT)%NT,rr=r+dr;if(rr<0||rr>=NR)continue;const w=acc[tt*NR+rr];if(w>v||(w===v&&(dt<0||(dt===0&&dr<0)))){m=false;break}}
    if(m)pk.push([v,t,r-diag])}
  pk.sort((a,b)=>b[0]-a[0]);
  const out=[];for(const p of pk){if(out.some(q=>Math.min(Math.abs(q[1]-p[1]),NT-Math.abs(q[1]-p[1]))<4&&Math.abs(q[2]-p[2])<G.QN))continue;out.push(p);if(out.length>=G.QL)break}
  return out.map(([v,t,r])=>({v,th:t*Math.PI/NT,r}));
}
function inter(a,b){const c1=Math.cos(a.th),s1=Math.sin(a.th),c2=Math.cos(b.th),s2=Math.sin(b.th),d=c1*s2-s1*c2;if(Math.abs(d)<1e-6)return null;return [(a.r*s2-b.r*s1)/d,(c1*b.r-c2*a.r)/d]}
// "hur vertikal" en linje är: normalen nära 0/180 grader
const isV=l=>{const d=l.th*180/Math.PI;return d<40||d>140};
const isH=l=>{const d=l.th*180/Math.PI;return d>50&&d<130};
function angDiff(a,b){let d=Math.abs(a.th-b.th);if(d>Math.PI/2)d=Math.PI-d;return d}
function detect(src,SW,SH,opt={}){
  const W=opt.w||G.QW,H=Math.round(W*SH/SW);qc.width=W;qc.height=H;
  qx.imageSmoothingQuality='high';qx.drawImage(src,0,0,SW,SH,0,0,W,H);
  const d=qx.getImageData(0,0,W,H).data,N=W*H,g=new Float32Array(N);
  for(let i=0;i<N;i++){g[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2]}
  // lätt utjämning (3x3)
  const b=new Float32Array(N);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;b[i]=(g[i-W-1]+2*g[i-W]+g[i-W+1]+2*g[i-1]+4*g[i]+2*g[i+1]+g[i+W-1]+2*g[i+W]+g[i+W+1])/16}
  const mag=new Float32Array(N),dir=new Float32Array(N),gxA=new Float32Array(N),gyA=new Float32Array(N);
  const hist=new Uint32Array(256);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;
    const gx=b[i-W+1]+2*b[i+1]+b[i+W+1]-b[i-W-1]-2*b[i-1]-b[i+W-1],gy=b[i+W-1]+2*b[i+W]+b[i+W+1]-b[i-W-1]-2*b[i-W]-b[i-W+1];
    const m=Math.hypot(gx,gy);mag[i]=m;gxA[i]=gx;gyA[i]=gy;let a=Math.atan2(gy,gx);if(a<0)a+=Math.PI;dir[i]=a;hist[Math.min(255,m/4|0)]++}
  // tröskel: starkaste ~12 % av pixlarna
  let acc=0,thr=0;for(let k=255;k>=0;k--){acc+=hist[k];if(acc>N*.12){thr=Math.max(40,k*4);break}}
  const L=lines(g,W,H,mag,dir,thr);G.QDBG={L,thr,W,H};
  const V=L.filter(isV).slice(0,G.QV),Hh=L.filter(isH).slice(0,G.QV);
  // stöd längs en sida: andel punkter med stark kant i rätt riktning
  const side=(p,q)=>{const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;let ok=0,n=0;
    for(let k=0;k<=24;k++){const t=.06+.88*k/24,x=p[0]+dx*t,y=p[1]+dy*t;n++;let best=0;
      for(const o of [-1.2,0,1.2]){const xi=Math.round(x+nx*o),yi=Math.round(y+ny*o);if(xi<1||yi<1||xi>=W-1||yi>=H-1)continue;const i=yi*W+xi,m=mag[i];if(m<thr*.6)continue;
        const c=Math.abs(gxA[i]*nx+gyA[i]*ny)/(m||1);if(c>.8&&m>best)best=m}
      if(best)ok++}
    return ok/n};
  const cands=[];const area=W*H;
  for(let i=0;i<V.length;i++)for(let j=i+1;j<V.length;j++){const a=V[i],c=V[j];if(angDiff(a,c)>.3)continue;
    for(let k=0;k<Hh.length;k++)for(let l=k+1;l<Hh.length;l++){const e=Hh[k],f=Hh[l];if(angDiff(e,f)>.3)continue;
      const p=[inter(a,e),inter(c,e),inter(c,f),inter(a,f)];if(p.some(x=>!x))continue;
      // ordna: TL TR BR BL
      const cx=(p[0][0]+p[1][0]+p[2][0]+p[3][0])/4,cy=(p[0][1]+p[1][1]+p[2][1]+p[3][1])/4;
      p.sort((u,w)=>Math.atan2(u[1]-cy,u[0]-cx)-Math.atan2(w[1]-cy,w[0]-cx));
      // börja i övre vänstra
      let s=0,mn=1e9;p.forEach((u,ix)=>{const v=u[0]+u[1];if(v<mn){mn=v;s=ix}});const q=[0,1,2,3].map(o=>p[(s+o)%4]);
      if(q.some(u=>u[0]<-W*.03||u[1]<-H*.03||u[0]>W*1.03||u[1]>H*1.03))continue;
      const wT=Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]),wB=Math.hypot(q[2][0]-q[3][0],q[2][1]-q[3][1]),hL=Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1]),hR=Math.hypot(q[2][0]-q[1][0],q[2][1]-q[1][1]);
      const asp=(wT+wB)/(hL+hR);if(asp<.6||asp>.86)continue;
      if(wT/wB>1.35||wB/wT>1.35||hL/hR>1.35||hR/hL>1.35)continue;
      const ar=(wT+wB)*(hL+hR)/4;if(ar<area*.05)continue;
      const sp=[side(q[0],q[1]),side(q[1],q[2]),side(q[2],q[3]),side(q[3],q[0])],mn2=Math.min(...sp);
      if(mn2<.45)continue;
      const sc=mn2*1.5+(sp[0]+sp[1]+sp[2]+sp[3])/4+Math.sqrt(ar/area)*.35-Math.abs(asp-ASP)*2;
      cands.push({sc,q})}}
  if(!cands.length)return null;
  cands.sort((a,b)=>b.sc-a.sc);
  const k=SW/W,keep=[],far=(a,b)=>Math.max(...a.q.map((u,i)=>Math.hypot(u[0]-b.q[i][0],u[1]-b.q[i][1])))>W*.03;
  for(const c of cands){if(keep.every(x=>far(x,c)))keep.push(c);if(keep.length>=(opt.k||6))break}
  const all=keep.map(c=>({sc:c.sc,q:c.q.map(u=>[u[0]*k,u[1]*k])}));
  const q=all[0].q,cut=q.some(u=>u[0]<SW*.01||u[1]<SH*.01||u[0]>SW*.99||u[1]>SH*.99);
  return {q,sc:all[0].sc,cut,all};
}
// Homografi: från rektangel (0..w,0..h) till fyrhörning q
function homog(q,w,h){
  const src=[[0,0],[w,0],[w,h],[0,h]],A=[],B=[];
  for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=q[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v)}
  // Gauss
  for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[B[c],B[p]]=[B[p],B[c]];
    for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];B[r]-=f*B[c]}}
  return B.map((v,i)=>v/A[i][i]);
}
const fc=document.createElement('canvas'),fx=fc.getContext('2d',{willReadFrequently:true});
const wc=document.createElement('canvas'),wx=wc.getContext('2d',{willReadFrequently:true});
let PREP=null;
function prep(src,SW,SH){
  const s=Math.min(1,900/Math.max(SW,SH)),FW=Math.round(SW*s),FH=Math.round(SH*s);
  if(fc.width!==FW||fc.height!==FH){fc.width=FW;fc.height=FH}
  fx.drawImage(src,0,0,SW,SH,0,0,FW,FH);
  PREP={src,s,FW,FH,d:fx.getImageData(0,0,FW,FH).data};return PREP;
}
// Rätar upp kortet till en egen bild (som "tar en bild")
function warp(src,SW,SH,q,ow=180,oh=252,P){
  P=P||prep(src,SW,SH);const {s,FW,FH,d:sd}=P;
  const h=homog(q.map(u=>[u[0]*s,u[1]*s]),ow,oh);
  if(wc.width!==ow||wc.height!==oh){wc.width=ow;wc.height=oh}
  const out=wx.createImageData(ow,oh),od=out.data;
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){const z=h[6]*x+h[7]*y+1,u=(h[0]*x+h[1]*y+h[2])/z,v=(h[3]*x+h[4]*y+h[5])/z;
    const o=(y*ow+x)*4;od[o+3]=255;if(u<0||v<0||u>=FW-1||v>=FH-1)continue;
    const x0=u|0,y0=v|0,ax=u-x0,ay=v-y0,i=(y0*FW+x0)*4,j=i+FW*4;
    od[o]=(sd[i]*(1-ax)+sd[i+4]*ax)*(1-ay)+(sd[j]*(1-ax)+sd[j+4]*ax)*ay;
    od[o+1]=(sd[i+1]*(1-ax)+sd[i+5]*ax)*(1-ay)+(sd[j+1]*(1-ax)+sd[j+5]*ax)*ay;
    od[o+2]=(sd[i+2]*(1-ax)+sd[i+6]*ax)*(1-ay)+(sd[j+2]*(1-ax)+sd[j+6]*ax)*ay}
  wx.putImageData(out,0,0);
  return wc;
}
// Välj den fyrhörning som bäst liknar ett känt kort och finjustera
function adj(q,ds,dx,dy){const cx=(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,cy=(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4,w=Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]),h=Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1]);
  return q.map(u=>[cx+(u[0]-cx)*ds+dx*w,cy+(u[1]-cy)*ds+dy*h])}
function best(src,SW,SH,Q,match,n=G.QB||6){
  let b=null;const P=prep(src,SW,SH);
  for(const c of Q.all.slice(0,n)){const cv=warp(src,SW,SH,c.q,180,252,P);if(!cv)continue;const m=match(cv);m.q=c.q;if(!b||m.s<b.s)b=m}
  if(!b)return null;
  // flytta varje sida in/ut lite i taget
  const mv=(q,si,d)=>{const r=q.map(u=>u.slice()),a=si,c=(si+1)%4,cx=(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,cy=(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4;
    for(const i of [a,c]){r[i][0]+=(q[i][0]-cx)*d;r[i][1]+=(q[i][1]-cy)*d}return r};
  for(let it=0;it<G.QI;it++){let nb=b;const st=it<2?.025:.012;
    const vs=[[1,-st,0],[1,st,0],[1,0,-st],[1,0,st]].map(v=>adj(b.q,...v));
    for(let si=0;si<4;si++)for(const d of [-st*1.5,st*1.5])vs.push(mv(b.q,si,d));
    for(const q of vs){const cv=warp(src,SW,SH,q,180,252,P);if(!cv)continue;const m=match(cv);m.q=q;if(m.s<nb.s)nb=m}
    if(nb===b){if(it<2){it=1;continue}break}b=nb}
  return b;
}
G.QUAD={detect,warp,best,prep};
})(window);
