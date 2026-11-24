(function(){
"use strict";
const L="ABCDE", DAY=864e5, MIN=6e4;
const EXAM=new Date(2026,11,19,10,0,0).getTime();
const IV=[0,1,3,7,14]; // days per box; longest gap is also capped at 30% of the days left (Cepeda et al. 2008)
let D=null,Q=[],byId={},LS=[],byL={},C=[],cById={},lessonOf={};
const store={get(k,d){try{const v=localStorage.getItem("ytb:"+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem("ytb:"+k,JSON.stringify(v))}catch(e){}}};
let hist=store.get("hist",{}),readL=store.get("read",{}),srs=store.get("srs",{}),act=store.get("act",{}),conf=store.get("conf",{sure:{ok:0,bad:0},guess:{ok:0,bad:0}}),lstate=store.get("lstate",{}),sums=store.get("sum",{});
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rich=s=>esc(s).replace(/&lt;br&gt;/g,"<br>");
const areaName=id=>(D.areas.find(a=>a.id===id)||{}).name||id;
const diffName=["","Kolay","Orta","Zor"];
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function order(q){return q.keep?[0,1,2,3,4]:shuffle([0,1,2,3,4])}
function dkey(t){const d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function bump(){const k=dkey(Date.now());act[k]=(act[k]||0)+1;store.set("act",act)}
function streak(){let n=0,t=Date.now();if(!act[dkey(t)])t-=DAY;while(act[dkey(t)]){n++;t-=DAY}return n}
function daysLeft(){return Math.max(0,Math.ceil((EXAM-Date.now())/DAY))}
function srcHtml(src){if(!src||!src.length)return "";return '<div class="src">Kaynak: '+src.map(s=>'<a href="'+esc(s.u)+'" target="_blank" rel="noopener">'+esc(s.t)+'</a>').join(" · ")+'</div>'}

/* ---------- Spaced repetition ---------- */
function capExam(t){const last=EXAM-DAY;return (Date.now()<last&&t>last)?last:t}
function horizonCap(now){const H=(EXAM-now)/DAY;return Math.max(1,Math.round(0.3*H))}
/* grade: 0 bilemedim, 1 kısmen/zorlandım, 2 bildim. Same-day successes do not stretch the interval;
   ds counts separate days with a successful recall (successive relearning, Rawson & Dunlosky). */
function plan(key,grade){const s=Object.assign({b:0,n:0,lap:0,ds:0},srs[key]||{});const now=Date.now();const today=dkey(now);
  if(grade===0){s.b=0;s.lap++;s.due=now+10*MIN}
  else{const sameDay=s.lastOk===today;
    if(!sameDay){s.ds++;s.lastOk=today;if(grade===1)s.b=Math.max(s.b,1);else s.b=Math.min(s.b+1,IV.length-1)}else s.b=Math.max(s.b,1);
    let d=IV[s.b];if(grade===1)d=Math.max(1,Math.round(d/2));d=Math.min(d,horizonCap(now));s.due=capExam(now+d*DAY)}
  s.n++;return s}
function sched(key,grade){srs[key]=plan(key,grade);store.set("srs",srs);bump()}
/* Early (free) review: a success before the due date keeps the schedule as is (an early repetition is weaker,
   so it should not push the next review further out) but still counts as a separate-day recall; a miss is a lapse. */
function schedEarly(key,grade){const s=srs[key];if(!s||!s.due||s.due<=Date.now()+60*MIN||grade===0){sched(key,grade);return}
  const today=dkey(Date.now());if(s.lastOk!==today){s.ds=(s.ds||0)+1;s.lastOk=today}s.n++;store.set("srs",srs);bump()}
function ivLabel(key,grade){const s=plan(key,grade);const ms=s.due-Date.now();if(ms<DAY)return "10 dk";const d=Math.round(ms/DAY);return d+" gün"}
function dueItems(){const now=Date.now();return Object.keys(srs).filter(k=>srs[k].due<=now&&((k[0]==="c"&&cById[k.slice(2)])||(k[0]==="q"&&byId[k.slice(2)])))}
function nextDue(){let m=Infinity;Object.keys(srs).forEach(k=>{if(srs[k].due>Date.now()&&srs[k].due<m)m=srs[k].due});return m}

/* ---------- Answers, confidence ---------- */
function record(q,ok,c,early){const h=hist[q.id]||{n:0,ok:0};h.n++;if(ok)h.ok++;h.last=ok?1:0;hist[q.id]=h;store.set("hist",hist);
  if(c){conf[c][ok?"ok":"bad"]++;store.set("conf",conf)}
  (early?schedEarly:sched)("q:"+q.id,ok?(c==="guess"?1:2):0)}
/* ---------- Recall card: typed attempt, then idea-unit check (Tauber et al. 2018; Dunlosky et al. 2011) ---------- */
function recallCard(el,c,o){const us=c.u&&c.u.length>1?c.u:[c.a];const need=c.need||us.length;let typed="";const key="c:"+c.id;
  const head='<div class="qhead"><span>'+(o.tag||'<span class="tag">Hatırla</span>')+'</span><span>'+(o.right||"Not kapalı")+'</span></div><p class="qtext">'+esc(c.q)+'</p>';
  function ask(){el.innerHTML=head+'<textarea class="ans" rows="2" placeholder="Cevabını yaz, kısa yazman yeterli"></textarea><p class="note">Yazarak hatırlamak, yalnızca aklından geçirmekten daha etkilidir. Hiç hatırlamıyorsan boş bırakıp cevabı aç.</p><div class="nav2"><span></span><button class="btn" data-show>Cevabı göster</button></div>';
    const ta=el.querySelector(".ans");try{ta.focus({preventScroll:true})}catch(e){}
    ta.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();el.querySelector("[data-show]").click()}};
    el.querySelector("[data-show]").onclick=()=>{typed=ta.value.trim();reveal()}}
  const gName=["Bilemedim","Kısmen","Bildim"];
  function iv(g){return o.noIv?"":" · tekrar "+ivLabel(key,g)+" sonra"}
  function reveal(){let h=head+'<div class="cmp"><div><small>Senin cevabın</small><p>'+(typed?esc(typed):'<i class="muted">boş</i>')+'</p></div><div><small>Doğru cevap</small><p>'+esc(c.a)+'</p></div></div>';
    if(us.length>1){h+='<p class="note">Cevabındaki her parçayı ayrı kontrol et. Yalnızca doğru yazdığın ya da kesin hatırladığın parçaları işaretle.'+(need<us.length?' Bu soruda '+need+' tanesi yeterli.':'')+'</p><div class="units">'+us.map((u,i)=>'<label><input type="checkbox" data-u="'+i+'"><span>'+esc(u)+'</span></label>').join("")+'</div><div class="nav2"><span class="note" data-gl></span><button class="btn" data-save>Kaydet</button></div>'}
    else h+='<p class="note">Cevabın doğru cevapla aynı anlamda mı?</p><div class="grades3">'+gName.map((n,g)=>'<button class="btn '+(g===2?'':'ghost')+'" data-g="'+g+'">'+(g===0?"Hayır":g===1?"Kısmen":"Evet")+'<small>'+(o.noIv?"":ivLabel(key,g))+'</small></button>').join("")+'</div>';
    el.innerHTML=h;
    const grade=()=>{const k=el.querySelectorAll("[data-u]:checked").length;return k>=need?2:(k>=need/2?1:0)};
    const gl=el.querySelector("[data-gl]");const upd=()=>{if(gl){const g=grade();gl.textContent="Sonuç: "+gName[g]+iv(g)}};upd();
    el.querySelectorAll("[data-u]").forEach(x=>x.onchange=upd);
    const sv=el.querySelector("[data-save]");if(sv)sv.onclick=()=>o.onGrade(grade());
    el.querySelectorAll("[data-g]").forEach(x=>x.onclick=()=>o.onGrade(+x.dataset.g))}
  ask()}
function feedbackHtml(q,sel,ord,c){const ok=sel===q.a;const ls=lessonOf[q.id];
  let h='<div class="expl"><span class="verdict '+(ok?"ok":"bad")+'">'+(ok?"Doğru.":"Yanlış. Doğru cevap "+L[ord.indexOf(q.a)]+".")+'</span> ';
  if(!ok&&c==="sure")h+='<div class="hyper">Emin olduğun hâlde yanlış. Bu tür hatalar düzeltildiğinde en iyi akılda kalanlardır: açıklamayı dikkatle oku, bu soru yakında tekrar karşına çıkacak.</div>';
  if(ok&&c==="guess")h+='<div class="note" style="margin:6px 0">Tahminle doğru buldun. Bilgiyi sağlamlaştırmak için açıklamayı oku.</div>';
  h+=rich(q.e)+srcHtml(q.src)+(ls?'<div class="src">Konu: <a href="#not/'+ls.id+'">'+esc(ls.title)+'</a></div>':'')+'</div>';return h}
function optsHtml(q,ord,st){return '<div class="opts">'+ord.map((oi,k)=>{let c="opt";
  if(st.reveal){if(oi===q.a)c+=" ok";else if(oi===st.sel)c+=" bad"}else if(oi===st.sel)c+=" sel";
  return '<button class="'+c+'" data-oi="'+oi+'"'+(st.reveal?" disabled":"")+'><span class="bub">'+L[k]+'</span><span>'+rich(q.o[oi])+'</span></button>'}).join("")+'</div>'}
/* reusable question widget: renders into el, calls done(ok) after answer */
function askQuestion(el,q,opts){opts=opts||{};const ord=order(q);let sel=null,rev=false,cf=null;
  function draw(){let h='<div class="qhead"><span><span class="tag">'+esc(areaName(q.area))+'</span> &nbsp;'+diffName[q.d]+'</span><span>'+(opts.label||q.id)+'</span></div>';
    if(opts.pre)h+='<p class="note" style="margin:0 0 10px">'+opts.pre+'</p>';
    h+='<p class="qtext">'+rich(q.q)+'</p>'+optsHtml(q,ord,{sel:sel,reveal:rev});
    if(rev)h+=feedbackHtml(q,sel,ord,cf);
    h+='<p class="err"></p><div class="nav2">';
    if(!rev)h+='<span class="muted" style="font-size:.85rem;align-self:center">Ne kadar eminsin?</span><div class="row"><button class="btn ghost" data-c="guess">Tahmin, kontrol et</button><button class="btn" data-c="sure">Eminim, kontrol et</button></div>';
    else h+='<span></span><button class="btn" data-next>'+(opts.nextLabel||"Devam")+'</button>';
    h+='</div>';el.innerHTML=h;
    el.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{sel=+b.dataset.oi;draw()});
    el.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{if(sel===null){el.querySelector(".err").textContent="Önce bir şık işaretle.";return}
      cf=b.dataset.c;rev=true;if(!opts.noRecord)record(q,sel===q.a,cf,!!opts.early);draw()});
    const nx=el.querySelector("[data-next]");if(nx)nx.onclick=()=>opts.done&&opts.done(sel===q.a,cf)}
  draw()}

/* ---------- Mastery ---------- */
function mastery(l){const cs=C.filter(c=>c.l===l.id);const seen=cs.filter(c=>srs["c:"+c.id]);const qd=l.qs.filter(id=>hist[id]);
  if(!seen.length&&!qd.length)return null;
  // a card counts as mastered after successful recall on 3 separate days (successive relearning)
  const cScore=cs.length?cs.reduce((s,c)=>s+Math.min((srs["c:"+c.id]||{ds:0}).ds||0,3)/3,0)/cs.length:0;
  const qScore=l.qs.filter(id=>hist[id]&&hist[id].last===1).length/l.qs.length;
  return Math.round(100*(cs.length?(cScore+qScore)/2:qScore))}
function mColor(m){return m===null?"var(--line)":m>=80?"var(--ok)":m>=50?"var(--accent)":"var(--warn)"}

/* ---------- Bugün ---------- */
function nextLesson(){return LS.find(l=>!lstate[l.id])}
function renderToday(){const s=$("#v-bugun");const due=dueItems().length;const nl=nextLesson();const left=daysLeft();
  const notDone=LS.filter(l=>!lstate[l.id]).length;const studyDays=Math.max(1,left-4);const perDay=notDone?Math.ceil(notDone/studyDays):0;
  const learned=C.filter(c=>(srs["c:"+c.id]||{b:0}).b>=1).length;
  const answered=Object.keys(hist).length;const okAll=Object.values(hist).filter(h=>h.last===1).length;
  let h='<div class="hero card"><div><div class="big">'+left+'</div><div class="muted">gün kaldı · 19 Aralık 2026</div></div><div class="list" style="gap:6px;flex:1;min-width:220px">';
  h+='<p style="margin:0"><b>Bugünkü plan</b></p><ol class="steps">';
  h+='<li>'+(due?'<b>'+due+'</b> tekrar kartı ve sorusu seni bekliyor.':'Planlı tekrar yok. İstersen <a href="#tekrar">Tekrar</a> bölümünde beklemeden serbest tekrar yapabilirsin.')+'</li>';
  h+='<li>'+(nl?(perDay>1?'Günde <b>'+perDay+' yeni konu</b> bitirirsen sınavdan önce 4 gün genel tekrar kalır. Sıradaki: <b>'+esc(nl.title)+'</b>.':'Sıradaki yeni konu: <b>'+esc(nl.title)+'</b>.'):'Bütün konuları bitirdin. Şimdi deneme sınavı ve tekrar zamanı.')+'</li>';
  h+=(left<=3?'<li><b>Sınava '+left+' gün kaldı:</b> Tekrar bölümündeki "Sınav öncesi son tur" ile bütün kartları en zayıftan başlayarak bir kez daha geç. Yeni konuya başlama.</li>':'<li>Haftada en az bir deneme sınavı. Gerçek sınav da çoktan seçmeli olduğu için bu format pratiği önemli.</li>')+'</ol>';
  h+='<div class="row" style="margin-top:6px">'+(due?'<a class="btn" href="#tekrar">Tekrara başla ('+due+')</a>':'')+(nl&&left>3?'<a class="btn'+(due?' ghost':'')+'" href="#ders/'+nl.id+'">'+(due?'Sonra: ':'')+'Yeni konu</a>':(left<=3?'<a class="btn'+(due?' ghost':'')+'" href="#tekrar">Son tur</a>':'<a class="btn" href="#deneme">Deneme sınavı</a>'))+'</div></div></div>';
  const cs=conf.sure.ok+conf.sure.bad, cg=conf.guess.ok+conf.guess.bad;
  h+='<div class="stats">';
  h+='<div class="stat"><span>Seri</span><b>'+streak()+' gün</b><span>Her gün biraz çalış</span></div>';
  const solid=C.filter(c=>((srs["c:"+c.id]||{}).ds||0)>=3).length;
  h+='<div class="stat"><span>Kalıcı kart</span><b>'+solid+' / '+C.length+'</b><div class="bar"><i style="width:'+Math.round(solid/C.length*100)+'%"></i></div><span>3 ayrı günde doğru · '+learned+' kart çalışıldı</span></div>';
  h+='<div class="stat"><span>Soru (son cevap)</span><b>'+okAll+' / '+answered+' doğru</b><span>'+answered+' / '+Q.length+' soru görüldü</span></div>';
  h+='<div class="stat"><span>"Eminim" dediklerinde</span><b>'+(cs?Math.round(conf.sure.ok/cs*100)+"%":"–")+' doğru</b><span>'+(cs?conf.sure.bad+' kez emin olup yanıldın':'Henüz veri yok')+'</span></div>';
  h+='</div>';
  if(cs>=5&&cg>=3){const ps=conf.sure.ok/cs,pg=conf.guess.ok/cg;h+='<p class="note">'+(ps-pg<0.15?'Eminim dediğin ile tahmin ettiğin sorulardaki başarın birbirine yakın: kendini değerlendirmen henüz isabetli değil. Emin olmadığın konuları işaretleyip tekrar et.':'Eminim dediğin sorularda belirgin biçimde daha başarılısın: neyi bildiğini iyi ayırt ediyorsun.')+'</p>'}
  h+='<div class="card list"><div class="row" style="justify-content:space-between"><h2>Konu hâkimiyeti</h2><span class="note">kart hafızası + soru başarısı</span></div>';
  h+=D.areas.map(a=>{const ls=LS.filter(l=>l.area===a.id);return '<div class="list" style="gap:6px"><h3>'+esc(a.name)+'</h3><div class="mgrid">'+ls.map(l=>{const m=mastery(l);
    return '<a class="mtile" href="#'+(lstate[l.id]?'not':'ders')+'/'+l.id+'"><span>'+esc(l.title)+'</span><span class="mbar"><i style="width:'+(m||0)+'%;background:'+mColor(m)+'"></i></span><small>'+(m===null?'başlanmadı':'%'+m)+'</small></a>'}).join("")+'</div></div>'}).join("");
  h+='</div>';
  h+='<details class="card"><summary><b>Bu uygulama nasıl öğretiyor?</b></summary><ul class="steps" style="margin-top:10px">'+
  '<li><b>Kendini test etmek (en güçlü kanıt):</b> Tekrar okumak yerine hafızadan geri çağırırsın. 2 gün sonraki testte kendini test edenler %68, tekrar okuyanlar %54 hatırladı (<a href="https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf" target="_blank" rel="noopener">Roediger ve Karpicke, 2006</a>). Pratik test ve aralıklı tekrar, on öğrenme tekniğini karşılaştıran büyük derlemede "yüksek fayda" alan iki teknik (<a href="https://www.aft.org/ae/fall2013/dunlosky" target="_blank" rel="noopener">Dunlosky ve ark., 2013</a>).</li>'+
  '<li><b>Önce yaz, sonra parça parça kontrol et:</b> Tanım ve liste gibi uzun cevaplarda yazarak hatırlamak, aklından geçirmekten daha etkili (<a href="https://profiles.wustl.edu/en/publications/does-covert-retrieval-benefit-learning-of-key-term-definitions/" target="_blank" rel="noopener">Tauber ve ark., 2018</a>). Cevabı bütün olarak değil parça parça kontrol etmek, kendine fazla not verme eğilimini azaltır (Dunlosky ve ark., 2011).</li>'+
  '<li><b>Doğru hatırlayana kadar, sonra farklı günlerde:</b> Bilemediğin kart oturum içinde doğru hatırlayana kadar geri gelir. Bir kart üç ayrı günde doğru hatırlanınca "kalıcı" sayılır. Bu yöntem gerçek derslerde sınav notunu yaklaşık bir harf notu yükseltti (<a href="https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-successive-relearning-dunlosky-greve-badali-wissman-rawson.pdf" target="_blank" rel="noopener">Dunlosky ve ark., ardışık yeniden öğrenme rehberi</a>).</li>'+
  '<li><b>Sınav tarihine göre aralık:</b> En iyi tekrar aralığı, sınava kalan sürenin yaklaşık %20-30\'u (<a href="https://www.yorku.ca/ncepeda/publications/CVRWP2008.html" target="_blank" rel="noopener">Cepeda ve ark., 2008</a>). Bu yüzden hiçbir aralık kalan günlerin %30\'unu geçmez ve her şey sınavdan önceki güne son kez planlanır. Aralıkların genişleyerek mi eşit mi olduğu ise pek fark etmiyor; önemli olan toplam aralık ve tekrar sayısı (<a href="https://learninglab.psych.purdue.edu/downloads/2011/2011_Karpicke_Bauernschmidt_JEPLMC.pdf" target="_blank" rel="noopener">Karpicke ve Bauernschmidt, 2011</a>).</li>'+
  '<li><b>Geri bildirim:</b> Her sorudan sonra açıklama gelir. Geri bildirimli testin etkisi belirgin biçimde daha büyük (<a href="https://courseware.epfl.ch/assets/courseware/v1/fdde2f0aa590bf3b1324077a6bf1540c/asset-v1%3AEPFL%2BDEMO%2B2020%2Btype%40asset%2Bblock/Rowland2014-meta-analysis.pdf" target="_blank" rel="noopener">Rowland, 2014</a>).</li>'+
  '<li><b>Güven derecesi:</b> Emin olup yanıldığın hatalar, doğru cevabı görünce daha kolay düzelir (<a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3079415" target="_blank" rel="noopener">Metcalfe ve Finn, 2011</a>). Tahminle bulduğun doğru cevap "bildim" sayılmaz, daha sık tekrar edilir.</li>'+
  '<li><b>Ön soru:</b> Dersten önce tahmin etmek o sorudaki bilgiyi daha iyi öğrenmeni sağlar, ama dersin geri kalanına genel bir etkisi yok (St. Hilaire ve ark., 2024). Yanlış tahmin zarar vermez.</li>'+
  '<li><b>Neyin işe yaramadığı:</b> Tekrar okumak, altını çizmek ve özet çıkarmak "düşük fayda" bulundu. Konuları karıştırmak benzer kategorileri ayırt etmede işe yarıyor, düz bilgi ezberinde kanıtlanmış bir faydası yok (<a href="https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf" target="_blank" rel="noopener">Brunmair ve Richter, 2019</a>). Tekrarlar karışık gelir, ama bunun amacı aralık bırakmak.</li>'+
  '<li><b>Sınırlar:</b> Bu çalışmaların çoğu üniversite öğrencileriyle, kelime ve tanım öğrenmede yapıldı. Kamu sınavına etkisi bu sonuçlardan çıkarımdır.</li></ul></details>';
  h+='<details class="card" id="xfer"><summary><b>İlerlemeni başka cihaza taşı</b></summary><div class="list" style="margin-top:10px">'+
  '<p class="note">İlerlemen yalnızca bu tarayıcıda saklanır. Başka bir cihazda ya da adreste devam etmek için burada dışa aktar, diğer tarafta içe aktar.</p>'+
  '<div class="row"><button class="btn" id="xOut">Dışa aktar</button><button class="btn ghost" id="xFile">Dosyadan içe aktar</button><input type="file" id="xFileIn" accept=".json,application/json" hidden></div>'+
  '<textarea id="xText" style="min-height:90px;font:400 .8rem/1.4 var(--mono)" placeholder="Dışa aktarılan kodu buraya yapıştırıp &quot;Kodu içe aktar&quot;a bas"></textarea>'+
  '<div class="row"><button class="btn ghost" id="xIn">Kodu içe aktar</button></div><p class="note" id="xMsg"></p></div></details>';
  s.innerHTML=h;bindTransfer()}
/* ---------- Progress export / import ---------- */
function exportData(){const o={v:1,at:new Date().toISOString(),data:{}};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf("ytb:")===0)o.data[k]=localStorage.getItem(k)}}catch(e){}return JSON.stringify(o)}
function importData(txt){let o;try{o=JSON.parse(txt)}catch(e){return "Kod okunamadı. Tamamını kopyaladığından emin ol."}
  if(!o||!o.data||typeof o.data!=="object")return "Bu bir ilerleme kodu değil.";
  const keys=Object.keys(o.data).filter(k=>k.indexOf("ytb:")===0);if(!keys.length)return "Kodun içinde ilerleme yok.";
  try{Object.keys(localStorage).filter(k=>k.indexOf("ytb:")===0).forEach(k=>localStorage.removeItem(k));keys.forEach(k=>localStorage.setItem(k,o.data[k]))}catch(e){return "Bu tarayıcı veriyi kaydetmeye izin vermiyor."}
  location.reload();return ""}
function bindTransfer(){const msg=t=>{$("#xMsg").textContent=t};
  $("#xOut").onclick=()=>{const txt=exportData();$("#xText").value=txt;$("#xText").select();
    let saved=false;try{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"}));a.download="ytb-ilerleme-"+dkey(Date.now())+".json";document.body.appendChild(a);a.click();a.remove();saved=true}catch(e){}
    try{navigator.clipboard.writeText(txt).then(()=>msg((saved?"Dosya indirildi ve ":"")+"kod panoya kopyalandı. Diğer cihazda bu bölümü açıp yapıştır."),()=>msg((saved?"Dosya indirildi. ":"")+"Kod aşağıda seçili, kopyalayıp diğer cihaza taşı."))}catch(e){msg("Kod aşağıda seçili, kopyalayıp diğer cihaza taşı.")}};
  $("#xIn").onclick=()=>{const t=$("#xText").value.trim();if(!t){msg("Önce kodu yapıştır.");return}
    if(!confirm("Bu cihazdaki ilerleme, içe aktarılan ilerlemeyle değiştirilecek. Devam edilsin mi?"))return;msg(importData(t))};
  $("#xFile").onclick=()=>$("#xFileIn").click();
  $("#xFileIn").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{if(!confirm("Bu cihazdaki ilerleme, dosyadaki ilerlemeyle değiştirilecek. Devam edilsin mi?"))return;msg(importData(String(r.result)))};r.readAsText(f)}}

/* ---------- Guided lesson ---------- */
let G=null;
function buildSteps(l){const st=[];const cs=C.filter(c=>c.l===l.id);
  const pre=byId[l.qs[Math.floor(Math.random()*l.qs.length)]];if(pre)st.push({t:"pre",q:pre});
  const chunks=[];
  if(l.tl&&l.tl.length)chunks.push({key:"tl",html:'<dl class="tl">'+l.tl.map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>').join("")+'</dl>'});
  l.points.forEach((p,i)=>chunks.push({key:i,html:'<p class="chunk">'+p+'</p>'}));
  if(l.traps&&l.traps.length)chunks.push({key:"t",trap:true,html:'<ul class="steps">'+l.traps.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul>'});
  const cardsFor=k=>cs.filter(c=>c.p===k).map(c=>({t:"card",c:c}));
  chunks.forEach((ch,i)=>{st.push({t:"chunk",ch:ch,i:i,n:chunks.length});if(i>0)st.push(...cardsFor(chunks[i-1].key))});
  st.push(...cardsFor(chunks[chunks.length-1].key));
  if(cs.length){st.push({t:"roundIntro",n:cs.length});shuffle(cs).forEach(c=>st.push({t:"card",c:c,final:true}))}
  st.push({t:"sum"});
  l.qs.forEach((id,i)=>st.push({t:"q",q:byId[id],i:i,n:l.qs.length}));
  st.push({t:"end"});return st}
function startLesson(id){const l=byL[id];if(!l)return location.hash="#ogren";G={l:l,steps:buildSteps(l),i:0,again:[],qok:0,qn:0,known:0,cards:0,preOk:null};readL[id]=1;store.set("read",readL);drawStep()}
function drawStep(){const v=$("#v-ders");const l=G.l;const s=G.steps[G.i];const pct=Math.round(G.i/(G.steps.length-1)*100);
  let h='<div class="row" style="justify-content:space-between"><a class="btn ghost" href="#ogren">Dersten çık</a><span class="note">'+esc(l.title)+'</span></div><div class="bar"><i style="width:'+pct+'%"></i></div><div class="card" id="gBody"></div>';
  v.innerHTML=h;const b=$("#gBody");window.scrollTo(0,0);
  const next=()=>{G.i++;drawStep()};
  // a missed card returns a few steps later (not immediately), still inside the current phase: criterion learning
  const requeue=(c,tries,final)=>{const bnd=G.steps.findIndex((x,j)=>j>G.i&&(x.t==="roundIntro"||x.t==="sum"));
    G.steps.splice(Math.max(G.i+1,Math.min(G.i+4,bnd)),0,{t:"card",c:c,re:true,tries:tries,final:final})};
  if(s.t==="pre"){askQuestion(b,s.q,{noRecord:true,label:"Ön soru",pre:"<b>Önce tahmin et.</b> Bu konuyu henüz çalışmadın, yanlış yapman normal. Cevaplamaya çalışmak, bu sorudaki bilgiyi dersten sonra daha iyi hatırlamanı sağlar. Aynı soru ders sonunda tekrar gelecek.",nextLabel:"Derse başla",done:(ok)=>{G.preOk=ok;next()}});return}
  if(s.t==="roundIntro"){b.innerHTML='<div class="qhead"><span class="tag">Son tur</span><span>'+s.n+' kart</span></div><p class="qtext">Konunun bütün kartları karışık sırayla bir kez daha geliyor.</p><p class="note">Her kartı ders içinde en az iki kez doğru hatırlamak, sonraki günlerdeki tekrarlarla birlikte bilgiyi kalıcı hâle getirir. Bilemediğin kart turun sonunda yeniden gelir.</p><div class="nav2"><span></span><button class="btn" id="gN">Başla</button></div>';$("#gN").onclick=next;return}
  if(s.t==="chunk"){b.innerHTML='<div class="qhead"><span class="tag">'+(s.ch.trap?"Sınav tuzakları":"Parça "+(s.i+1)+" / "+s.n)+'</span><span>Oku, sonra devam et</span></div>'+(s.i===0?'<p class="muted" style="margin:0 0 12px">'+esc(l.intro)+'</p>':'')+'<div class="'+(s.ch.trap?"trap":"")+'">'+s.ch.html+'</div><div class="nav2"><span class="note">Sonraki adımda bu parçayı not olmadan hatırlamaya çalışacaksın.</span><button class="btn" id="gN">Anladım, devam</button></div>';$("#gN").onclick=next;return}
  if(s.t==="card"){recallCard(b,s.c,{tag:'<span class="tag">'+(s.final?"Son tur":"Hatırla")+(s.re?" · tekrar":"")+'</span>',noIv:true,onGrade:g=>{
      sched("c:"+s.c.id,g);if(!s.re&&!s.final){G.cards++;if(g===2)G.known++}
      if(g<2&&(s.tries||1)<4)requeue(s.c,(s.tries||1)+1,s.final);next()}});return}
  if(s.t==="sum"){b.innerHTML='<div class="qhead"><span class="tag">Neden?</span><span>isteğe bağlı</span></div><p class="qtext">Bu konudan bir bilgi seç ve <b>neden</b> öyle olduğunu ya da başka bir konuyla <b>nasıl bağlandığını</b> birkaç cümleyle açıkla.</p><p class="note">Örnek: "Mavi Kart sahibi neden memur olamaz ama sözleşmeli çalışabilir?" Bilgiyi tekrar etmek değil, gerekçesini kurmak amaç. Bu, yazılı sınav için de pratik olur. Atlayabilirsin, asıl kalıcılığı kartlar ve sorular sağlar.</p><textarea id="gSum" style="min-height:140px">'+esc(sums[l.id]||"")+'</textarea><div class="nav2"><button class="btn ghost" id="gSkip">Atla</button><button class="btn" id="gSave">Kaydet, sorulara geç</button></div>';
    $("#gSkip").onclick=next;$("#gSave").onclick=()=>{sums[l.id]=$("#gSum").value;store.set("sum",sums);bump();next()};return}
  if(s.t==="q"){if(!s.q){next();return}askQuestion(b,s.q,{label:"Soru "+(s.i+1)+" / "+s.n,nextLabel:s.i+1<s.n?"Sonraki soru":"Sonucu gör",done:(ok)=>{G.qn++;if(ok)G.qok++;next()}});return}
  if(s.t==="end"){const m=mastery(l);lstate[l.id]={done:1,score:G.qok,n:G.qn,at:Date.now()};store.set("lstate",lstate);bump();const nl=nextLesson();
    b.innerHTML='<h2>Ders tamamlandı</h2><div class="stats" style="margin-top:12px"><div class="stat"><span>Sorular</span><b>'+G.qok+' / '+G.qn+'</b></div><div class="stat"><span>İlk denemede hatırlanan kart</span><b>'+G.known+' / '+G.cards+'</b></div><div class="stat"><span>Konu hâkimiyeti</span><b>%'+(m||0)+'</b></div></div>'+
    '<p class="note" style="margin-top:12px">Kartlar ve yanlış yaptığın sorular tekrar takvimine eklendi. Bu konu, kartlarını <b>en az üç ayrı günde</b> doğru hatırladığında kalıcı sayılır: ilk tekrar yarın. Notu yeniden okumak yerine Tekrar bölümünü kullan, kendini test etmek tekrar okumaktan çok daha etkilidir.</p>'+
    '<div class="nav2"><a class="btn ghost" href="#bugun">Bugün ekranı</a>'+(nl?'<a class="btn" href="#ders/'+nl.id+'">Sonraki konu: '+esc(nl.title)+'</a>':'')+'</div>';return}}

/* ---------- Öğren index + note view ---------- */
function renderLearn(){const s=$("#v-ogren");
  s.innerHTML='<div class="card list"><h2>Konular</h2><p class="note">"Başla" konuyu adım adım öğretir: ön soru, kısa parçalar, yazarak hatırlama kartları, son tur, "neden?" sorusu ve konu soruları. "Not" konunun tek sayfalık özetidir. Bir şeye bakmak için kullan, tekrar için değil: tekrar okumak kendini test etmekten çok daha az etkilidir.</p></div>'+
  D.areas.map(a=>{const ls=LS.filter(l=>l.area===a.id);return '<div class="lgroup"><h3>'+esc(a.name)+'</h3>'+ls.map(l=>{const st=lstate[l.id];const m=mastery(l);
    return '<div class="lcard"><div class="list" style="gap:4px;flex:1;min-width:0"><span>'+esc(l.title)+'</span><span class="mbar"><i style="width:'+(m||0)+'%;background:'+mColor(m)+'"></i></span><span class="lm">'+(st?'tamamlandı · soru '+st.score+'/'+st.n+' · hâkimiyet %'+(m||0):l.qs.length+' soru · '+C.filter(c=>c.l===l.id).length+' kart')+'</span></div><div class="row" style="flex:none"><a class="btn ghost sm" href="#not/'+l.id+'">Not</a><a class="btn sm" href="#ders/'+l.id+'">'+(st?'Tekrar et':'Başla')+'</a></div></div>'}).join("")+'</div>'}).join("")}
function renderNote(id){const l=byL[id];const v=$("#v-not");if(!l){location.hash="#ogren";return}
  let h='<div class="row"><a href="#ogren" class="btn ghost">← Konular</a></div><div class="card list lesson"><div class="qhead" style="margin:0"><span class="tag">'+esc(areaName(l.area))+'</span><span>'+l.qs.length+' soru</span></div><h2>'+esc(l.title)+'</h2><p class="muted">'+esc(l.intro)+'</p>';
  if(l.tl&&l.tl.length)h+='<dl class="tl">'+l.tl.map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>').join("")+'</dl>';
  h+='<ul>'+l.points.map(p=>'<li>'+p+'</li>').join("")+'</ul></div>';
  if(l.traps&&l.traps.length)h+='<div class="trap"><h3>Sınav tuzakları</h3><ul class="steps">'+l.traps.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></div>';
  if(sums[l.id])h+='<div class="card"><h3>Senin özetin</h3><p style="white-space:pre-wrap;margin:8px 0 0">'+esc(sums[l.id])+'</p></div>';
  h+=srcHtml(l.src)+'<div class="nav2"><a class="btn" href="#ders/'+l.id+'">Adım adım çalış</a><button class="btn ghost" id="nCards">Kartlarını tekrar et</button><button class="btn ghost" id="nQs">Sadece soruları çöz</button></div><p class="note">Notu yeniden okumak yerine kendini test et: Tekrar bölümü ve konu soruları bilgiyi çok daha kalıcı yapar.</p>';
  v.innerHTML=h;window.scrollTo(0,0);$("#nQs").onclick=()=>{startPractice(l.qs.map(x=>byId[x]).filter(Boolean))};
  const nC=$("#nCards");if(nC)nC.onclick=()=>startFree(freeKeys("l:"+l.id,false),"weak",999)}

/* ---------- Tekrar (SRS session) ---------- */
let R=null;
function renderReview(){const v=$("#v-tekrar");const due=dueItems();
  if(!R||R.done){if(!due.length){const nd=nextDue();const learned=Object.keys(srs).filter(k=>k[0]==="c");
      v.innerHTML='<div class="card list"><h2>Planlı tekrar yok</h2><p class="note">'+(nd<Infinity?'Bir sonraki planlı tekrar: '+new Date(nd).toLocaleString("tr-TR",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+'.':'Henüz tekrar takviminde kart yok.')+' Beklemek istemiyorsan aşağıdaki serbest tekrarla hemen başlayabilirsin.</p></div>'+freeCard()+finalCard();
      bindFree();bindFinal();return}
    v.innerHTML='<div class="card list"><h2>'+due.length+' tekrar hazır</h2><p class="note">Kartlarda önce cevabı yaz, sonra doğru cevapla parça parça karşılaştır. Bilemediğin kart oturum içinde doğru hatırlayana kadar tekrar gelir.</p><div class="row"><button class="btn" id="rGo">Başla</button></div></div>'+freeCard()+finalCard();
    $("#rGo").onclick=()=>{R={q:shuffle(due).slice(0,40),i:0,ok:0,n:0};drawReview()};bindFree();bindFinal();return}
  drawReview()}
/* Free review: any time, any scope */
function freeCard(){const studied=C.filter(c=>srs["c:"+c.id]).length;
  let o='<option value="studied">Çalıştığım bütün kartlar ('+studied+')</option><option value="all">Bütün kartlar ('+C.length+')</option>';
  o+=D.areas.map(a=>'<option value="a:'+a.id+'">Alan: '+esc(a.name)+'</option>').join("");
  o+=LS.map(l=>'<option value="l:'+l.id+'">Konu: '+esc(l.title)+'</option>').join("");
  return '<div class="card list"><h3>Serbest tekrar</h3><p class="note">İstediğin zaman, istediğin kadar. Takvimden önce doğru bildiğin kart takvimi ileri atmaz (erken tekrar daha az etkili olduğu için), bilemediğin kart ise yakın zamana yeniden planlanır.</p>'+
    '<div class="row"><select id="fScope" style="flex:1;min-width:0">'+o+'</select></div>'+
    '<div class="row"><select id="fOrder"><option value="weak">En zayıftan başla</option><option value="mix">Karışık</option></select><select id="fN"><option value="10">10</option><option value="20" selected>20</option><option value="40">40</option><option value="999">Hepsi</option></select><label class="muted" style="font-size:.85rem;display:flex;gap:6px;align-items:center"><input type="checkbox" id="fQs"> Soruları da kat</label></div>'+
    '<p class="err" id="fErr"></p><div class="row"><button class="btn" id="fGo">Serbest tekrarı başlat</button></div></div>'}
function freeKeys(scope,withQs){let cs=C,qs=[];
  if(scope==="studied")cs=C.filter(c=>srs["c:"+c.id]);else if(scope[0]==="a"&&scope[1]===":"){const a=scope.slice(2);cs=C.filter(c=>byL[c.l].area===a)}else if(scope.indexOf("l:")===0){const id=scope.slice(2);cs=C.filter(c=>c.l===id)}
  if(withQs){const ls=new Set(cs.map(c=>c.l));qs=Q.filter(q=>lessonOf[q.id]&&ls.has(lessonOf[q.id].id)).map(q=>"q:"+q.id)}
  return cs.map(c=>"c:"+c.id).concat(qs)}
function weakness(k){const s=srs[k];if(!s)return -1;return (s.ds||0)*10-(s.lap||0)*3+(s.b||0)}
function startFree(keys,order,n){if(!keys.length)return false;keys=order==="weak"?shuffle(keys).sort((a,b)=>weakness(a)-weakness(b)):shuffle(keys);R={q:keys.slice(0,n),i:0,ok:0,n:0,early:true};location.hash="#tekrar";drawReview();return true}
function bindFree(){const g=$("#fGo");if(!g)return;g.onclick=()=>{const keys=freeKeys($("#fScope").value,$("#fQs").checked);
  if(!startFree(keys,$("#fOrder").value,+$("#fN").value))$("#fErr").textContent="Bu seçimde kart yok. Önce bir konu çalış ya da \"Bütün kartlar\"ı seç."}}
/* Final pass before the exam: every studied card and missed question once more, weakest first (successive relearning) */
function finalKeys(){return Object.keys(srs).filter(k=>(k[0]==="c"&&cById[k.slice(2)])||(k[0]==="q"&&byId[k.slice(2)]&&(srs[k].lap>0||(hist[k.slice(2)]&&hist[k.slice(2)].last===0))))
  .sort((a,b)=>(srs[a].ds||0)-(srs[b].ds||0)||srs[b].lap-srs[a].lap)}
function finalCard(){const n=finalKeys().length;if(!n)return "";const dl=daysLeft();
  return '<div class="card list"><h3>Sınav öncesi son tur</h3><p class="note">Çalıştığın bütün kartlar ve yanlış yaptığın sorular, en zayıftan başlayarak bir kez daha. Sınavdan önceki son 2-3 gün için tasarlandı'+(dl>3?', şu an için erken: sınava '+dl+' gün var.':'.')+'</p><div class="row"><button class="btn '+(dl<=3?'':'ghost')+'" id="rFinal">Son turu başlat ('+n+')</button></div></div>'}
function bindFinal(){const f=$("#rFinal");if(f)f.onclick=()=>{R={q:finalKeys(),i:0,ok:0,n:0,final:true};drawReview()}}
function drawReview(){const v=$("#v-tekrar");if(R.i>=R.q.length){R.done=true;renderBadge();
    v.innerHTML='<div class="card list"><h2>Oturum bitti</h2><div class="stats"><div class="stat"><span>Tekrar edilen</span><b>'+R.n+'</b></div><div class="stat"><span>Bilinen</span><b>'+R.ok+' / '+R.n+'</b></div></div><p class="note">'+(R.early?'Serbest tekrar: bildiklerin takvimdeki yerinde kaldı, bilemediklerin yakın zamana planlandı.':'Bildiklerin daha uzun aralıkla, bilemediklerin yakında geri gelecek.')+'</p><div class="row"><a class="btn" href="#bugun">Bugün ekranı</a></div></div>';R=null;return}
  const key=R.q[R.i];const left=R.q.length-R.i;
  v.innerHTML='<div class="row" style="justify-content:space-between"><span class="note">'+left+' kaldı</span><a class="btn ghost" href="#bugun">Ara ver</a></div><div class="bar"><i style="width:'+Math.round(R.i/R.q.length*100)+'%"></i></div><div class="card" id="rBody"></div>';
  const b=$("#rBody");
  // criterion: an item missed in this session returns later in the same session until recalled (max 4 times)
  const nxt=(ok,again)=>{R.counted=R.counted||{};if(!R.counted[key]){R.counted[key]=1;R.n++;if(ok)R.ok++}
    if(again&&R.q.filter(k=>k===key).length<4)R.q.splice(Math.min(R.q.length,R.i+4),0,key);R.i++;drawReview()};
  if(key[0]==="q"){const q=byId[key.slice(2)];askQuestion(b,q,{label:R.early?"Serbest tekrar · soru":"Soru tekrarı",early:!!R.early,done:(ok)=>nxt(ok,!ok)});return}
  const c=cById[key.slice(2)];const l=byL[c.l];
  recallCard(b,c,{tag:'<span class="tag">'+esc(areaName(l.area))+'</span> &nbsp;'+esc(l.title),right:R.early?"Serbest tekrar":"Kart",noIv:!!R.early,onGrade:g=>{(R.early?schedEarly:sched)(key,g);nxt(g===2,g<2)}})}
function renderBadge(){const n=D?dueItems().length:0;const a=document.querySelector('nav a[data-v="tekrar"]');if(a)a.innerHTML='Tekrar'+(n?' <span class="badge">'+n+'</span>':'')}

/* ---------- Soru çöz (practice) ---------- */
let pArea="ALL",pDiff=0,pOnlyNew=false,pList=[],pIdx=0;
function buildPList(){pList=Q.filter(q=>(pArea==="ALL"||q.area===pArea)&&(!pDiff||q.d===pDiff)&&(!pOnlyNew||!hist[q.id]));pIdx=0;drawP()}
function startPractice(list){pArea="ALL";pDiff=0;$("#diffSel").value="0";pOnlyNew=false;$("#onlyNew").checked=false;pList=list;pIdx=0;location.hash="#calis";chips();drawP()}
function chips(){const c=$("#areaChips");const all=[{id:"ALL",name:"Tümü"}].concat(D.areas);
  c.innerHTML=all.map(a=>{const n=a.id==="ALL"?Q.length:Q.filter(q=>q.area===a.id).length;return '<button class="chip" aria-pressed="'+(pArea===a.id)+'" data-a="'+a.id+'">'+esc(a.name)+'<small>'+n+'</small></button>'}).join("");
  c.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{pArea=b.dataset.a;chips();buildPList()})}
function drawP(){const card=$("#pCard");const q=pList[pIdx];
  if(!q){card.innerHTML='<p>Bu filtrede soru kalmadı.</p><p class="note">Filtreyi değiştir ya da "Yalnızca çözmediklerim" seçeneğini kapat.</p>';renderStats();return}
  askQuestion(card,q,{label:(pIdx+1)+" / "+pList.length+" · "+q.id,nextLabel:pIdx===pList.length-1?"Baştan başla":"Sonraki soru",done:()=>{pIdx=pIdx===pList.length-1?0:pIdx+1;drawP();renderStats()}});renderStats()}
function renderStats(){$("#pStats").innerHTML=D.areas.map(a=>{const qs=Q.filter(q=>q.area===a.id);const done=qs.filter(q=>hist[q.id]);const ok=done.filter(q=>hist[q.id].last===1).length;
  const pct=qs.length?Math.round(done.length/qs.length*100):0;
  return '<div class="stat"><span>'+esc(a.name)+'</span><b>'+ok+' / '+done.length+' doğru</b><div class="bar"><i style="width:'+pct+'%"></i></div><span>'+done.length+' / '+qs.length+' çözüldü</span></div>'}).join("")}

/* ---------- Deneme ---------- */
let dQs=[],dOrds=[],dAns=[],dIdx=0,dEnd=0,dTick=null,dConfirm=false;
function pickBalanced(n){const per={};D.areas.forEach(a=>per[a.id]=shuffle(Q.filter(q=>q.area===a.id)));const out=[];let i=0;
  while(out.length<n){let added=false;D.areas.forEach(a=>{if(out.length<n&&per[a.id][i]){out.push(per[a.id][i]);added=true}});if(!added)break;i++}
  return out.sort((x,y)=>D.areas.findIndex(a=>a.id===x.area)-D.areas.findIndex(a=>a.id===y.area))}
function initExam(){$("#dStart").onclick=()=>{const n=+$("#dCount").value;dQs=pickBalanced(Math.min(n,Q.length));dOrds=dQs.map(order);dAns=dQs.map(()=>null);dIdx=0;dEnd=Date.now()+dQs.length*90000;
  $("#dSetup").hidden=true;$("#dRes").hidden=true;$("#dRun").hidden=false;clearInterval(dTick);dTick=setInterval(tick,1000);tick();renderD()};
  $("#dFinish").onclick=()=>{const empty=dAns.filter(a=>a===null).length;if(empty&&!dConfirm){dConfirm=true;$("#dErr").textContent=empty+" soru boş. Yine de bitirmek için tekrar \"Sınavı bitir\"e bas.";return}finishD()}}
function tick(){const ms=dEnd-Date.now();if(ms<=0){finishD();return}const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);const t=$("#dTimer");t.textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");t.classList.toggle("low",ms<300000)}
function renderD(){const q=dQs[dIdx];const c=$("#dCard");
  c.innerHTML='<div class="qhead"><span><span class="tag">'+esc(areaName(q.area))+'</span></span><span>'+(dIdx+1)+' / '+dQs.length+'</span></div><p class="qtext">'+rich(q.q)+'</p>'+optsHtml(q,dOrds[dIdx],{sel:dAns[dIdx],reveal:false})+
  '<div class="nav2"><button class="btn ghost" id="dPrev"'+(dIdx===0?" disabled":"")+'>Önceki</button><button class="btn ghost" id="dClear">Boş bırak</button><button class="btn" id="dNext"'+(dIdx===dQs.length-1?" disabled":"")+'>Sonraki</button></div>';
  c.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{dAns[dIdx]=+b.dataset.oi;$("#dErr").textContent="";renderD()});
  $("#dPrev").onclick=()=>{dIdx--;renderD()};$("#dNext").onclick=()=>{dIdx++;renderD()};$("#dClear").onclick=()=>{dAns[dIdx]=null;renderD()};
  $("#dProg").textContent=dAns.filter(a=>a!==null).length+" / "+dQs.length+" işaretlendi";
  $("#dGrid").innerHTML=dQs.map((x,i)=>'<button class="cell'+(dAns[i]!==null?" done":"")+(i===dIdx?" cur":"")+'" data-i="'+i+'" aria-label="Soru '+(i+1)+'">'+(i+1)+'</button>').join("");
  $("#dGrid").querySelectorAll(".cell").forEach(b=>b.onclick=()=>{dIdx=+b.dataset.i;renderD()})}
function finishD(){clearInterval(dTick);dConfirm=false;$("#dRun").hidden=true;$("#dSetup").hidden=false;
  let ok=0,bad=0,empty=0;const per={};D.areas.forEach(a=>per[a.id]={ok:0,n:0});
  dQs.forEach((q,i)=>{per[q.area].n++;if(dAns[i]===null){empty++;sched("q:"+q.id,0)}else if(dAns[i]===q.a){ok++;per[q.area].ok++;record(q,true)}else{bad++;record(q,false)}});
  const score=Math.round(ok/dQs.length*1000)/10;const weak=D.areas.filter(a=>per[a.id].n).sort((x,y)=>per[x.id].ok/per[x.id].n-per[y.id].ok/per[y.id].n)[0];
  let h='<div class="card list"><h2>Sonuç</h2><div class="stats"><div class="stat"><span>Puan (100 üzerinden)</span><b>'+score.toLocaleString("tr-TR")+'</b></div><div class="stat"><span>Doğru</span><b>'+ok+'</b></div><div class="stat"><span>Yanlış</span><b>'+bad+'</b></div><div class="stat"><span>Boş</span><b>'+empty+'</b></div></div>';
  h+='<p class="note">'+(score>=60?"Eleme barajı olan 60 puanın üzerindesin. Sıralamaya girmek için daha yüksek puan gerekebilir.":"Eleme barajı 60 puan.")+' En zayıf alanın: <b>'+esc(weak.name)+'</b>. Yanlış ve boş bıraktığın sorular tekrar takvimine eklendi.</p>';
  h+='<div class="stats">'+D.areas.filter(a=>per[a.id].n).map(a=>'<div class="stat"><span>'+esc(a.name)+'</span><b>'+per[a.id].ok+' / '+per[a.id].n+'</b><div class="bar"><i style="width:'+Math.round(per[a.id].ok/per[a.id].n*100)+'%"></i></div></div>').join("")+'</div></div>';
  h+='<h3>Cevaplar</h3>'+dQs.map((q,i)=>{const sel=dAns[i];const res=sel===null?"Boş":(sel===q.a?"Doğru":"Yanlış");const ls=lessonOf[q.id];
    return '<div class="card"><div class="qhead"><span><span class="tag">'+esc(areaName(q.area))+'</span> '+res+'</span><span>'+(i+1)+' · '+q.id+'</span></div><p class="qtext">'+rich(q.q)+'</p>'+optsHtml(q,dOrds[i],{sel:sel,reveal:true})+'<div class="expl">'+rich(q.e)+srcHtml(q.src)+(ls?'<div class="src">Konu: <a href="#not/'+ls.id+'">'+esc(ls.title)+'</a></div>':'')+'</div></div>'}).join("");
  const r=$("#dRes");r.innerHTML=h;r.hidden=false;r.scrollIntoView({behavior:"smooth",block:"start"});renderBadge()}

/* ---------- Yanlışlarım ---------- */
function renderW(){const s=$("#v-yanlislar");const w=Q.filter(q=>hist[q.id]&&hist[q.id].last===0);
  if(!w.length){s.innerHTML='<div class="card"><h2>Yanlış sorun yok</h2><p class="note" style="margin-top:6px">Yanlış cevapladığın sorular burada toplanır ve tekrar takvimine de eklenir. Sonradan doğru cevaplarsan listeden çıkar.</p></div>';return}
  s.innerHTML='<div class="row" style="justify-content:space-between"><h2>'+w.length+' soru tekrar bekliyor</h2><button class="btn" id="wRetry">Bunları çöz</button></div>'+
  w.map(q=>{const ls=lessonOf[q.id];return '<div class="card"><div class="qhead"><span><span class="tag">'+esc(areaName(q.area))+'</span></span><span>'+q.id+' · '+hist[q.id].n+' deneme</span></div><p class="qtext">'+rich(q.q)+'</p><div class="expl" style="margin-top:0;border-top:0;padding-top:0"><b>Doğru cevap:</b> '+rich(q.o[q.a])+'<br>'+rich(q.e)+srcHtml(q.src)+(ls?'<div class="src">Konu: <a href="#not/'+ls.id+'">'+esc(ls.title)+'</a></div>':'')+'</div></div>'}).join("");
  $("#wRetry").onclick=()=>startPractice(w)}

/* ---------- Yazılı ---------- */
function initWrite(){const items=D.yazili.map((x,i)=>({k:"k"+i,label:"Kompozisyon "+(i+1),t:x.t,h:x.h})).concat(D.ceviri.map((x,i)=>({k:"c"+i,label:"Çeviri "+(i+1)+" (İngilizceden Türkçeye)",t:x.t,h:x.h})));
  const sel=$("#wSel");sel.innerHTML=items.map(x=>'<option value="'+x.k+'">'+esc(x.label)+': '+esc(x.t.slice(0,60))+'…</option>').join("");
  const drafts=store.get("drafts",{});
  function show(){const it=items.find(x=>x.k===sel.value);$("#wPrompt").textContent=it.t;$("#wHint").textContent=(it.k[0]==="k"?"Ele alınabilecek noktalar: ":"İpucu: ")+it.h;$("#wText").value=drafts[it.k]||"";count();$("#wMsg").textContent=""}
  function count(){const n=($("#wText").value.trim().match(/\S+/g)||[]).length;$("#wCount").textContent=n+" kelime"}
  sel.onchange=show;$("#wText").oninput=()=>{drafts[sel.value]=$("#wText").value;store.set("drafts",drafts);count()};
  $("#wCopy").onclick=()=>{const it=items.find(x=>x.k===sel.value);const txt="Yazılı deneme ("+it.label+")\nSoru: "+it.t+"\n\nCevabım:\n"+$("#wText").value;
    const done=()=>{$("#wMsg").textContent="Kopyalandı. Sohbete yapıştırıp değerlendirme isteyebilirsin."};
    try{navigator.clipboard.writeText(txt).then(done,()=>{$("#wText").select();$("#wMsg").textContent="Kopyalama izni yok. Metin seçildi, Ctrl+C ile kopyala."})}catch(e){$("#wText").select();$("#wMsg").textContent="Metin seçildi, Ctrl+C ile kopyala."}};
  let wEnd=0,wT=null;$("#wTimerBtn").onclick=()=>{if(wT){clearInterval(wT);wT=null;$("#wTimer").textContent="";$("#wTimerBtn").textContent="60 dk sayaç başlat";return}
    wEnd=Date.now()+3600000;$("#wTimerBtn").textContent="Sayacı durdur";wT=setInterval(()=>{const ms=wEnd-Date.now();if(ms<=0){clearInterval(wT);wT=null;$("#wTimer").textContent="Süre doldu";return}
    $("#wTimer").textContent=String(Math.floor(ms/60000)).padStart(2,"0")+":"+String(Math.floor(ms%60000/1000)).padStart(2,"0")},1000)};
  show()}

/* ---------- Routing ---------- */
const views=["bugun","ogren","ders","not","tekrar","calis","deneme","yanlislar","yazili"];
const navOf={ders:"ogren",not:"ogren"};
function route(){const parts=(location.hash||"#bugun").slice(1).split("/");let v=parts[0];if(!views.includes(v))v="bugun";
  views.forEach(x=>{$("#v-"+x).hidden=x!==v});const nv=navOf[v]||v;document.querySelectorAll("nav a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===nv?"page":"false"));
  if(!D)return;renderBadge();
  if(v==="bugun")renderToday();if(v==="ogren")renderLearn();if(v==="ders")startLesson(parts[1]);if(v==="not")renderNote(parts[1]);
  if(v==="tekrar")renderReview();if(v==="yanlislar")renderW();if(v==="calis")renderStats()}
window.addEventListener("hashchange",route);
$("#diffSel").onchange=e=>{pDiff=+e.target.value;buildPList()};
$("#onlyNew").onchange=e=>{pOnlyNew=e.target.checked;buildPList()};

Promise.all(["questions.json","lessons.json","cards.json"].map(f=>fetch(f).then(r=>{if(!r.ok)throw 0;return r.json()}))).then(([d,ld,cd])=>{
  D=d;Q=d.questions;Q.forEach(q=>byId[q.id]=q);LS=ld.lessons;LS.forEach(l=>{byL[l.id]=l;l.qs.forEach(id=>{if(!lessonOf[id])lessonOf[id]=l})});
  const cnt={};C=cd.cards.map(c=>{cnt[c.l]=(cnt[c.l]||0)+1;return Object.assign({id:c.l+"-"+cnt[c.l]},c)});C.forEach(c=>cById[c.id]=c);
  $("#countMeta").innerHTML="<b>"+LS.length+"</b> konu · <b>"+C.length+"</b> kart · <b>"+Q.length+"</b> soru";
  chips();buildPList();initExam();initWrite();route();setInterval(renderBadge,60000)
}).catch(()=>{$("#v-bugun").innerHTML='<div class="card"><p>İçerik yüklenemedi.</p><p class="note">Sayfayı yenile. Sorun sürerse sohbette haber ver.</p></div>'});
route();
})();
