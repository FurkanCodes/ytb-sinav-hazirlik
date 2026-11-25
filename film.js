/* Animasyonlu ders oynatıcı. Storyboard: film/<lessonId>.json
   Sahne türleri: title, say, list, timeline, count, bars, flow, tree, compare, trap, quiz, end.
   Her sahne: {k, t?, ic?, n?, items?:[{..., n}]}. "*kelime*" vurgulanır. */
(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const mk=s=>esc(s).replace(/\*([^*]+)\*/g,'<mark>$1</mark>');
const plain=s=>String(s==null?"":s).replace(/\*/g,"");
const store={get(k,d){try{const v=localStorage.getItem("ytb:"+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem("ytb:"+k,JSON.stringify(v))}catch(e){}}};
const IC={
 law:'<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
 people:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 5.5 2 5.5 5"/>',
 building:'<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M9 11h.01M15 11h.01"/>',
 money:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9v6M17 9v6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 vote:'<path d="M4 13h16v8H4zM8 13V4h8v9M10 8l1.5 1.5L15 6"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h7"/>',
 warn:'<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
 q:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
 flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 star:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'
};
const icon=(k,c)=>IC[k]?'<svg class="'+(c||"fic")+'" viewBox="0 0 24 24" aria-hidden="true">'+IC[k]+'</svg>':"";

let F=null; // state
const SPEEDS=[0.85,1,1.2,1.4];
function voice(){if(!("speechSynthesis" in window))return null;const vs=speechSynthesis.getVoices();return vs.find(v=>/^tr/i.test(v.lang)&&/google|online|natural/i.test(v.name))||vs.find(v=>/^tr/i.test(v.lang))||null}
function estMs(t){const w=(plain(t).match(/\S+/g)||[]).length;return Math.max(1800,w*430+600)}

/* ---------- build step list ---------- */
function build(sb){const steps=[];sb.scenes.forEach((s,si)=>{
  const its=s.items||[];
  if(s.k==="trap"){steps.push({s:si,i:-1,n:s.n});steps.push({s:si,i:0,n:s.n2,hold:400});return}
  if(s.k==="quiz"){steps.push({s:si,i:-1,n:s.n||s.q,wait:5000});steps.push({s:si,i:0,n:s.na||s.a,hold:500});return}
  if(s.n||!its.length)steps.push({s:si,i:-1,n:s.n||""});
  its.forEach((it,i)=>steps.push({s:si,i:i,n:it.n||plain(it.l||it.v||"")}))});
  return steps}

/* ---------- map scene ---------- */
let WORLD=null,WORLDP=null;
function loadWorld(){if(WORLD)return Promise.resolve(WORLD);if(!WORLDP)WORLDP=fetch("film/world.json").then(r=>{if(!r.ok)throw 0;return r.json()}).then(w=>WORLD=w).catch(()=>{WORLDP=null;return null});return WORLDP}
const VIEWS={world:[-170,-58,190,80],europe:[-12,34,45,62],balkans:[12,36,32,48],emed:[18,29,38,42],caucasus:[36,36,52,45],centralasia:[26,34,90,56],middleeast:[24,12,63,42],gulf:[44,20,60,32],asia:[60,-12,150,50],eastasia:[95,18,148,48],africa:[-20,-36,55,38],hornafrica:[30,-5,55,18],latam:[-120,-56,-30,33],turkey:[24,34,46,43]};
function declutter(node,upto){const ls=[...node.querySelectorAll(".mlab.on")];const cur=ls.find(l=>+l.dataset.i===upto);const order=cur?[cur].concat(ls.filter(l=>l!==cur).reverse()):ls.reverse();const placed=[];
  const hit=r=>placed.some(p=>!(r.right<p.left||r.left>p.right||r.bottom<p.top||r.top>p.bottom));
  order.forEach(l=>{l.classList.remove("hide");const sp=l.querySelector("span");let r=sp.getBoundingClientRect();if(hit(r)){l.classList.toggle("below");r=sp.getBoundingClientRect();if(hit(r)){l.classList.toggle("below");l.classList.add("hide");return}}placed.push(r)})}
function mapHtml(s){const W=WORLD;if(!W)return '<p class="muted">Harita yüklenemedi.</p>';
  const v=(Array.isArray(s.view)?s.view:(VIEWS[s.view]||VIEWS.world)).slice();
  const k=Math.max(.45,Math.cos((v[1]+v[3])/2*Math.PI/180));
  const st=F&&F.el.querySelector(".fstage");if(st){const tw=st.clientWidth-40,th=st.clientHeight-(s.t?110:50),ta=tw/th,va=(v[2]-v[0])*k/(v[3]-v[1]);
    if(va>ta*1.02){const need=(v[2]-v[0])*k/ta,c=(v[1]+v[3])/2;v[1]=Math.max(-80,c-need/2);v[3]=Math.min(84,c+need/2)}
    else if(va<ta/1.02){const need=(v[3]-v[1])*ta/k,c=(v[0]+v[2])/2;v[0]=c-need/2;v[2]=c+need/2}}
  const vx=v[0]*10*k,vy=-v[3]*10,vw=(v[2]-v[0])*10*k,vh=(v[3]-v[1])*10;
  const its=s.items||[];const owner={};its.forEach((it,i)=>{[].concat(it.iso||[]).forEach(c=>{if(owner[c]==null)owner[c]=i})});
  const base={};[].concat(s.base||["TUR"]).forEach(c=>base[c]=1);
  let paths="";for(const id in W){const c=W[id];if(!c.p)continue;const b=c.b;
    if(b&&(b[2]<v[0]*10-50||b[0]>v[2]*10+50||b[3]<-v[3]*10-50||b[1]>-v[1]*10+50)){if(owner[id]==null)continue}
    const it=owner[id]!=null?its[owner[id]]:null;
    paths+='<path d="'+c.p+'" class="mc'+(base[id]?" base":"")+(it?" c"+(it.c||0):"")+'"'+(it?' data-mi="'+owner[id]+'"':"")+'/>'}
  const pos=(lon,lat)=>[((lon*10*k)-vx)/vw*100,((-lat*10)-vy)/vh*100];
  const at=it=>{if(it.at)return pos(it.at[0],it.at[1]);const c=W[[].concat(it.iso||[])[0]];return c?[((c.c[0]*k)-vx)/vw*100,(c.c[1]-vy)/vh*100]:[50,50]};
  const sw=vh/((st&&st.clientHeight)||500)*2.6;let arcs="";its.forEach((it,i)=>{if(!it.to||!W[it.to])return;const a=W[[].concat(it.iso)[0]],b=W[it.to];if(!a)return;
    const x1=it.at?it.at[0]*10:a.c[0],y1=it.at?-it.at[1]*10:a.c[1],x2=b.c[0],y2=b.c[1],mx=(x1+x2)/2,my=(y1+y2)/2-Math.hypot(x2-x1,y2-y1)*.25;
    arcs+='<path class="marc c'+(it.c||1)+'" data-mi="'+i+'" pathLength="1" stroke-width="'+sw.toFixed(2)+'" d="M'+x1+' '+y1+'Q'+mx+' '+my+' '+x2+' '+y2+'"/>'});
  const labels=its.map((it,i)=>{const p=at(it);const below=p[1]<18;return '<div class="mlab it'+(below?" below":"")+(p[0]>72?" left":p[0]<28?" right":"")+'" data-i="'+i+'" style="left:'+p[0].toFixed(2)+'%;top:'+p[1].toFixed(2)+'%"><i class="mpin c'+(it.c||0)+'"></i><span>'+mk(it.l)+'</span></div>'}).join("");
  return head(s)+'<div class="fmap" style="aspect-ratio:'+(vw/vh).toFixed(4)+'"><svg viewBox="'+vx.toFixed(1)+' '+vy+' '+vw.toFixed(1)+' '+vh+'" preserveAspectRatio="none"><g transform="scale('+k.toFixed(4)+',1)">'+paths+arcs+'</g></svg>'+labels+'</div>'}
/* ---------- render a scene ---------- */
function head(s){return (s.t?'<h2 class="fh">'+icon(s.ic)+'<span>'+mk(s.t)+'</span></h2>':"")}
function sceneHtml(s,L){const its=s.items||[];let h="";
  switch(s.k){
  case "title":h='<div class="ftitle">'+icon(s.ic||"book","fic big")+'<div class="ftag">'+esc(s.tag||"")+'</div><h1>'+mk(s.t)+'</h1>'+(s.sub?'<p>'+mk(s.sub)+'</p>':"")+'</div>';break;
  case "say":h=head(s)+'<p class="fsay">'+mk(s.big||"")+'</p>'+(its.length?'<div class="fsub">'+its.map((it,i)=>'<p class="it" data-i="'+i+'">'+mk(it.l)+'</p>').join("")+'</div>':"");break;
  case "list":h=head(s)+'<ul class="flist">'+its.map((it,i)=>'<li class="it" data-i="'+i+'">'+(it.h?'<b>'+mk(it.h)+'</b>':"")+'<span>'+mk(it.l)+'</span></li>').join("")+'</ul>';break;
  case "timeline":h=head(s)+'<div class="ftl"><div class="ftl-in"><i class="ftl-line"></i>'+its.map((it,i)=>'<div class="ftl-row it" data-i="'+i+'"><span class="ftl-dot"></span><div class="ftl-d">'+esc(it.d)+'</div><div class="ftl-l">'+mk(it.l)+'</div></div>').join("")+'</div></div>';break;
  case "count":h=head(s)+'<div class="fcount">'+its.map((it,i)=>'<div class="fnum it" data-i="'+i+'"><div class="fv"><span>'+esc(it.pre||"")+'</span><b data-v="'+(+it.v)+'" data-dec="'+(it.dec||0)+'">0</b><span>'+esc(it.suf||"")+'</span></div><div class="fl">'+mk(it.l)+'</div></div>').join("")+'</div>';break;
  case "bars":{const mx=Math.max.apply(null,its.map(x=>+x.v))||1;h=head(s)+'<div class="fbars">'+its.map((it,i)=>'<div class="fbar it" data-i="'+i+'"><div class="fbl">'+mk(it.l)+'</div><div class="fbt"><i style="--w:'+(100*it.v/mx)+'%"'+(it.c?' class="c'+it.c+'"':"")+'></i><b>'+esc(it.txt||(it.v+(it.suf||"")))+'</b></div></div>').join("")+'</div>';break}
  case "flow":h=head(s)+'<div class="fflow">'+its.map((it,i)=>(i?'<div class="farr it" data-i="'+i+'">↓</div>':"")+'<div class="fbox it" data-i="'+i+'"><b>'+mk(it.l)+'</b>'+(it.s?'<small>'+mk(it.s)+'</small>':"")+'</div>').join("")+'</div>';break;
  case "tree":h=head(s)+'<div class="ftree"><div class="froot">'+mk(s.root||"")+'</div><i class="fstem"></i><div class="fkids">'+its.map((it,i)=>'<div class="fkid it" data-i="'+i+'"><b>'+mk(it.l)+'</b>'+(it.s?'<small>'+mk(it.s)+'</small>':"")+'</div>').join("")+'</div></div>';break;
  case "compare":h=head(s)+'<div class="fcmp">'+(s.cols||[]).map((c,ci)=>'<div class="fcol c'+ci+'"><h3>'+mk(c)+'</h3>'+its.map((it,i)=>it.c===ci?'<div class="fchip it" data-i="'+i+'">'+mk(it.l)+'</div>':"").join("")+'</div>').join("")+'</div>';break;
  case "trap":h='<div class="ftrap">'+icon("warn","fic big warn")+'<h2>'+mk(s.t||"Sınav tuzağı")+'</h2><div class="fwrong"><s>'+mk(s.wrong)+'</s></div><div class="fright it" data-i="0">'+mk(s.right)+'</div></div>';break;
  case "quiz":h='<div class="fquiz">'+icon("q","fic big")+'<div class="fqk">Hatırla</div><h2>'+mk(s.q)+'</h2><div class="fring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg><b></b></div><div class="fans it" data-i="0">'+mk(s.a)+'</div></div>';break;
  case "map":h=mapHtml(s);break;
  case "end":h='<div class="ftitle">'+icon("star","fic big")+'<h1>'+mk(s.t||"Bitti")+'</h1>'+(s.sub?'<p>'+mk(s.sub)+'</p>':"")+'<div class="fendb"><a class="btn" href="#ders/'+L.id+'">Adım adım çalış</a><a class="btn ghost" href="#not/'+L.id+'">Nota bak</a></div></div>';break;
  }
  return '<div class="fscene k-'+s.k+'">'+h+'</div>'}

/* ---------- player ---------- */
function totalMs(){return F.steps.reduce((a,st)=>a+estMs(st.n)+(st.wait||0)+(st.hold||0)+500,0)/F.speed}
function fmt(ms){const m=Math.floor(ms/60000),s=Math.round(ms%60000/1000);return m+":"+String(s).padStart(2,"0")}
function show(idx,auto){if(!F)return;stopTalk();idx=Math.max(0,Math.min(F.steps.length-1,idx));
  const st=F.steps[idx],sc=F.sb.scenes[st.s];const stage=F.el.querySelector(".fstage");
  if(F.cur!==st.s){F.cur=st.s;stage.querySelectorAll(".fscene:not(.out)").forEach(old=>{old.classList.add("out");setTimeout(()=>old.remove(),450)})
    stage.insertAdjacentHTML("beforeend",sceneHtml(sc,F.L));F.node=stage.lastElementChild;requestAnimationFrame(()=>F.node&&F.node.classList.add("in"))}
  const node=F.node;const upto=st.i;
  node.querySelectorAll(".it").forEach(e=>{const i=+e.dataset.i;const on=i<=upto;if(on&&!e.classList.contains("on")){e.classList.add("on");reveal(sc,e,i)}else if(!on)e.classList.remove("on");e.classList.toggle("now",i===upto)});
  if(sc.k==="timeline")tlLine(node,upto);
  node.querySelectorAll("[data-mi]").forEach(e=>{const i=+e.dataset.mi;e.classList.toggle("on",i<=upto);e.classList.toggle("now",i===upto)});
  if(sc.k==="map")setTimeout(()=>declutter(node,upto),60);
  F.i=idx;F.el.querySelector(".fcap").innerHTML=mk(st.n||"");
  const pct=F.steps.length>1?idx/(F.steps.length-1)*100:100;F.el.querySelector(".fprog i").style.width=pct+"%";
  const left=F.steps.slice(idx).reduce((a,x)=>a+estMs(x.n)+(x.wait||0)+500,0)/F.speed;
  F.el.querySelector(".fmeta").textContent="Sahne "+(st.s+1)+"/"+F.sb.scenes.length+" · kalan ~"+fmt(left);
  store.set("film:"+F.L.id,{i:idx,n:F.steps.length});
  if(F.playing)talk(st)}
function reveal(sc,e,i){if(sc.k==="count"){const b=e.querySelector("b[data-v]");if(b)countUp(b)}
  if(sc.k==="timeline"||sc.k==="list"||sc.k==="flow"||sc.k==="compare"||sc.k==="tree"){const box=F.node;const d=e.getBoundingClientRect().bottom-box.getBoundingClientRect().bottom+28;if(d>0)box.scrollTo({top:box.scrollTop+d,behavior:"smooth"})}}
function tlLine(node,upto){const line=node.querySelector(".ftl-line");const rows=node.querySelectorAll(".ftl-row");if(!line||!rows.length)return;
  const r=rows[Math.max(0,upto)];line.style.height=(upto<0?0:r.offsetTop+14)+"px"}
function countUp(b){const v=+b.dataset.v,dec=+b.dataset.dec,t0=performance.now(),d=1200;
  function f(t){const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);b.textContent=(v*e).toLocaleString("tr-TR",{minimumFractionDigits:dec,maximumFractionDigits:dec});if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)}
function stopTalk(){clearTimeout(F&&F.tm);clearInterval(F&&F.cd);if(F)F.tok++;try{speechSynthesis.cancel()}catch(e){}}
function talk(st){const tok=++F.tok;const done=()=>{if(tok!==F.tok)return;afterTalk(st,tok)};
  const txt=plain(st.n||"");
  if(F.voiceOn&&F.v&&txt){const u=new SpeechSynthesisUtterance(txt);u.voice=F.v;u.lang=F.v.lang;u.rate=F.speed*1.02;let fired=false;const fin=()=>{if(fired)return;fired=true;done()};
    u.onend=fin;u.onerror=fin;speechSynthesis.speak(u);F.tm=setTimeout(fin,estMs(txt)*1.9/F.speed+2500)}
  else F.tm=setTimeout(done,estMs(txt)/F.speed)}
function afterTalk(st,tok){const next=()=>{if(tok===F.tok&&F.playing){if(F.i<F.steps.length-1)show(F.i+1,true);else pause()}};
  if(st.wait){let n=Math.round(st.wait/1000);const ring=F.node.querySelector(".fring");if(ring){ring.classList.add("run");ring.style.setProperty("--d",n+"s");ring.querySelector("b").textContent=n}
    F.cd=setInterval(()=>{n--;if(ring)ring.querySelector("b").textContent=Math.max(0,n);if(n<=0){clearInterval(F.cd);next()}},1000);return}
  F.tm=setTimeout(next,(st.hold||0)+450/F.speed)}
function play(){if(!F)return;F.playing=true;F.el.querySelector(".fpp").innerHTML="❚❚";F.el.querySelector(".fpp").setAttribute("aria-label","Duraklat");
  if(F.i>=F.steps.length-1)show(0);else talk(F.steps[F.i])}
function pause(){if(!F)return;F.playing=false;stopTalk();F.el.querySelector(".fpp").innerHTML="▶";F.el.querySelector(".fpp").setAttribute("aria-label","Oynat")}
function jumpScene(d){const s=F.steps[F.i].s+d;const k=F.steps.findIndex(x=>x.s===s);if(k>=0)show(k)}

function open(el,L,back){close();el.innerHTML='<div class="card"><p class="muted">Animasyon yükleniyor…</p></div>';
  fetch("film/"+L.id+".json").then(r=>{if(!r.ok)throw 0;return r.json()}).then(sb=>sb.scenes.some(s=>s.k==="map")?loadWorld().then(()=>sb):sb).then(sb=>{
    F={el:el,L:L,sb:sb,steps:build(sb),i:0,cur:-1,playing:false,tok:0,speed:store.get("filmSpeed",1),voiceOn:store.get("filmVoice",true),v:voice()};
    if("speechSynthesis" in window)speechSynthesis.onvoiceschanged=()=>{if(F)F.v=voice();paintVoice()};
    el.innerHTML='<div class="row" style="justify-content:space-between"><a class="btn ghost" href="'+(back||"#ogren")+'">← Konular</a><span class="fmeta muted"></span></div>'+
      '<div class="film"><div class="fstage" aria-live="polite"></div><div class="fprog" title="İlerleme"><i></i></div>'+
      '<p class="fcap"></p><div class="fctl"><button class="btn ghost sm" data-a="ps" aria-label="Önceki sahne">⏮</button><button class="btn ghost sm" data-a="p" aria-label="Geri">‹</button><button class="btn fpp" data-a="pp" aria-label="Oynat">▶</button><button class="btn ghost sm" data-a="n" aria-label="İleri">›</button><button class="btn ghost sm" data-a="ns" aria-label="Sonraki sahne">⏭</button><button class="btn ghost sm" data-a="sp"></button><button class="btn ghost sm" data-a="vo"></button></div>'+
      '<p class="note fvnote"></p></div>';
    el.querySelector(".fctl").onclick=e=>{const b=e.target.closest("button");if(!b)return;const a=b.dataset.a;
      if(a==="pp")F.playing?pause():play();
      if(a==="n"){const pl=F.playing;stopTalk();show(F.i+1);if(!pl)return}
      if(a==="p"){show(F.i-1)}
      if(a==="ns")jumpScene(1);if(a==="ps")jumpScene(F.i>0&&F.steps[F.i-1].s===F.steps[F.i].s?0:-1);
      if(a==="sp"){F.speed=SPEEDS[(SPEEDS.indexOf(F.speed)+1)%SPEEDS.length]||1;store.set("filmSpeed",F.speed);paintVoice();if(F.playing){show(F.i)}}
      if(a==="vo"){F.voiceOn=!F.voiceOn;store.set("filmVoice",F.voiceOn);paintVoice();if(F.playing)show(F.i)}};
    el.querySelector(".fprog").onclick=e=>{const r=e.currentTarget.getBoundingClientRect();show(Math.round((e.clientX-r.left)/r.width*(F.steps.length-1)))};
    el.querySelector(".fstage").onclick=()=>{F.playing?pause():play()};
    document.addEventListener("keydown",keys);
    paintVoice();const sv=store.get("film:"+L.id,null);show(sv&&sv.n===F.steps.length&&sv.i<F.steps.length-1?sv.i:0);window.scrollTo(0,0)
  }).catch(()=>{el.innerHTML='<div class="row"><a class="btn ghost" href="'+(back||"#ogren")+'">← Konular</a></div><div class="card"><p>Bu konunun animasyonu henüz hazır değil.</p></div>'})}
function paintVoice(){if(!F)return;const sp=F.el.querySelector('[data-a="sp"]'),vo=F.el.querySelector('[data-a="vo"]');if(sp)sp.textContent=F.speed.toLocaleString("tr-TR")+"×";
  if(vo)vo.textContent=F.voiceOn?"Ses açık":"Ses kapalı";const nt=F.el.querySelector(".fvnote");
  if(nt)nt.textContent=!("speechSynthesis" in window)?"Bu tarayıcı sesli anlatımı desteklemiyor; altyazıyla ilerler.":(!F.v&&F.voiceOn?"Cihazda Türkçe ses bulunamadı; altyazıyla ilerler. Android'de Ayarlar > Metin okuma çıkışı > Türkçe dilini indir.":"")}
function keys(e){if(!F||!document.body.contains(F.el.querySelector(".film")))return;if(/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||""))return;
  if(e.key===" "){e.preventDefault();F.playing?pause():play()}if(e.key==="ArrowRight")show(F.i+1);if(e.key==="ArrowLeft")show(F.i-1)}
function close(){if(F){F.playing=false;stopTalk();document.removeEventListener("keydown",keys)}F=null}
window.Film={open:open,close:close};
})();
