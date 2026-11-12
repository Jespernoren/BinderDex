// Binderdex scanner core: same code builds the index and matches camera frames.
(function(G){
const N=32;
const K=8;
const COS=(()=>{const c=new Float32Array(K*N);for(let u=0;u<K;u++)for(let x=0;x<N;x++)c[u*N+x]=Math.cos((2*x+1)*u*Math.PI/(2*N));return c})();
const cv=document.createElement('canvas');cv.width=cv.height=N;const cx=cv.getContext('2d',{willReadFrequently:true});
const cv2=document.createElement('canvas');cv2.width=4;cv2.height=6;const cx2=cv2.getContext('2d',{willReadFrequently:true});
function gray(src,sx,sy,sw,sh){
  cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';
  cx.drawImage(src,sx,sy,sw,sh,0,0,N,N);
  const d=cx.getImageData(0,0,N,N).data,g=new Float32Array(N*N);
  let mn=1e9,mx=-1e9;
  for(let i=0;i<N*N;i++){const v=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];g[i]=v;if(v<mn)mn=v;if(v>mx)mx=v}
  const r=(mx-mn)||1;for(let i=0;i<N*N;i++)g[i]=(g[i]-mn)/r; // kontrastnormalisering
  return g;
}
function phash(g){
  const t=new Float32Array(K*N);
  for(let u=0;u<K;u++)for(let y=0;y<N;y++){let s=0;for(let x=0;x<N;x++)s+=g[y*N+x]*COS[u*N+x];t[u*N+y]=s}
  const D=new Float32Array(K*K);
  for(let u=0;u<K;u++)for(let v=0;v<K;v++){let s=0;for(let y=0;y<N;y++)s+=t[u*N+y]*COS[v*N+y];D[v*K+u]=s}
  const a=Array.from(D).slice(1).sort((p,q)=>p-q),med=a[a.length>>1];
  const h=new Array(K*K/32).fill(0);
  for(let i=0;i<K*K;i++)if(D[i]>med)h[i>>5]|=(1<<(i&31));
  return h.map(x=>x>>>0);
}
function color(src,sx,sy,sw,sh){
  cx2.drawImage(src,sx,sy,sw,sh,0,0,4,6);const d=cx2.getImageData(0,0,4,6).data,o=[];
  for(let i=0;i<24;i++){const r=d[i*4],g=d[i*4+1],b=d[i*4+2],s=r+g+b+1;o.push(Math.round(r/s*255),Math.round(g/s*255))}
  return o; // kromaticitet, tål ljusstyrka
}
// Art-rutan på ett kort (andel av bredd/höjd)
const ART=[.09,.10,.82,.42];
const cv3=document.createElement('canvas');cv3.width=16;cv3.height=12;const cx3=cv3.getContext('2d',{willReadFrequently:true});
function thumbv(src,sx,sy,sw,sh){cx3.imageSmoothingQuality='high';cx3.drawImage(src,sx,sy,sw,sh,0,0,16,12);const d=cx3.getImageData(0,0,16,12).data,n=192,v=new Float32Array(n);let m=0;
 for(let i=0;i<n;i++){v[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];m+=v[i]}m/=n;let q=0;for(let i=0;i<n;i++){v[i]-=m;q+=v[i]*v[i]}q=Math.sqrt(q/n)||1;
 return Array.from(v,x=>Math.max(-127,Math.min(127,Math.round(x/q*127/3))))}
function feat(src,sx,sy,sw,sh){
  const ax=sx+sw*ART[0],ay=sy+sh*ART[1],aw=sw*ART[2],ah=sh*ART[3];
  return {w:phash(gray(src,sx,sy,sw,sh)),a:phash(gray(src,ax,ay,aw,ah)),c:color(src,ax,ay,aw,ah),g:thumbv(src,ax,ay,aw,ah)};
}
function pop(x){x-=(x>>>1)&0x55555555;x=(x&0x33333333)+((x>>>2)&0x33333333);return(((x+(x>>>4))&0x0F0F0F0F)*0x01010101)>>>24}
function ham(a,b){let s=0;for(let i=0;i<a.length;i++)s+=pop(a[i]^b[i]);return s}
function cdist(a,b){let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length}
function ncc(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s/(a.length*127*127/9)}
function score(f,r){return ham(f.a,r.a)*0.5+ham(f.w,r.w)*0.3+cdist(f.c,r.c)*0.25+(1-ncc(f.g,r.g))*30}
function match(f,index,k=5){
  const out=[];for(const id in index){const r=index[id];out.push([score(f,r),id])}
  out.sort((p,q)=>p[0]-q[0]);return out.slice(0,k);
}
function pack(f){return f.a.map(x=>x.toString(36)).join('.')+'|'+f.w.map(x=>x.toString(36)).join('.')+'|'+f.c.map(x=>x.toString(16).padStart(2,'0')).join('')+'|'+btoa(String.fromCharCode(...f.g.map(x=>x+128)))}
function unpack(s){const [a,w,c,g]=s.split('|');return {a:a.split('.').map(x=>parseInt(x,36)),w:w.split('.').map(x=>parseInt(x,36)),c:c.match(/../g).map(x=>parseInt(x,16)),g:Array.from(atob(g),ch=>ch.charCodeAt(0)-128)}}
G.SCAN={feat,match,score,pack,unpack,ham};
})(window);
