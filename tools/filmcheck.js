// Validates film/<id>.json storyboards: schema + every number/date must come from the lesson text.
// Usage: node tools/filmcheck.js [id ...]   (no ids = all files in film/)
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const L={};JSON.parse(fs.readFileSync(path.join(R,"lessons.json"),"utf8")).lessons.forEach(l=>L[l.id]=l);
const KINDS={title:[],say:[],list:["l"],timeline:["d","l"],count:["v","l"],bars:["l","v"],flow:["l"],tree:["l"],compare:["c","l"],trap:[],quiz:[],end:[],map:["iso","l"]};
const WORLD=JSON.parse(fs.readFileSync(path.join(R,"film","world.json"),"utf8"));
const VIEWS=["world","europe","balkans","emed","caucasus","centralasia","middleeast","gulf","asia","eastasia","africa","hornafrica","latam","turkey"];
const MON={ocak:1,"şubat":2,mart:3,nisan:4,"mayıs":5,haziran:6,temmuz:7,"ağustos":8,"eylül":9,ekim:10,"kasım":11,"aralık":12};
function nums(s){// normalised number tokens
  s=String(s).replace(/<[^>]+>/g," ");const out=new Set();
  // "12 Mart 1947" -> 12.3.1947 plus parts
  s.replace(/(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)(?:'?\S*)?\s+(\d{4})/gi,(m,d,mo,y)=>{out.add(+d+"."+MON[mo.toLocaleLowerCase("tr")]+"."+y);return m});
  (s.match(/\d+(?:[.,]\d+)*/g)||[]).forEach(t=>{out.add(t.replace(/^0+(\d)/,"$1").replace(/,/g,"."));t.split(/[.,]/).forEach(p=>out.add(String(+p)))});
  return out}
function check(id){const errs=[],f=path.join(R,"film",id+".json");let sb;
  try{sb=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){return ["bad JSON: "+e.message]}
  const l=L[id];if(!l)return ["no lesson "+id];if(sb.id!==id)errs.push("id mismatch");
  const src=JSON.stringify([l.title,l.intro,l.points,l.tl||[],l.traps||[],l.recall||[]]);
  const allowed=new Set();nums(src).forEach(x=>allowed.add(x));
  // common harmless small numbers (ordinals, counting words) 1-12 always allowed
  for(let i=0;i<=12;i++)allowed.add(String(i));
  const texts=[];let steps=0,words=0;
  if(!Array.isArray(sb.scenes)||sb.scenes.length<6)errs.push("too few scenes");
  (sb.scenes||[]).forEach((s,si)=>{if(!KINDS[s.k]){errs.push("scene "+si+": unknown kind "+s.k);return}
    ["t","sub","big","n","n2","q","a","na","wrong","right","root","tag"].forEach(k=>{if(s[k]!=null)texts.push([si,k,s[k]])});
    if(s.k==="trap"&&!(s.wrong&&s.right&&s.n2))errs.push("scene "+si+": trap needs wrong/right/n2");
    if(s.k==="quiz"&&!(s.q&&s.a))errs.push("scene "+si+": quiz needs q/a");
    if(s.k==="compare"&&!(Array.isArray(s.cols)&&s.cols.length===2))errs.push("scene "+si+": compare needs 2 cols");
    if(s.k==="map"){if(!(VIEWS.includes(s.view)||(Array.isArray(s.view)&&s.view.length===4&&s.view[0]<s.view[2]&&s.view[1]<s.view[3])))errs.push("scene "+si+": bad map view");[].concat(s.base||[]).forEach(c=>{if(!WORLD[c])errs.push("scene "+si+": unknown base iso "+c)});(s.items||[]).forEach((it,ii)=>{[].concat(it.iso||[]).concat(it.to?[it.to]:[]).forEach(c=>{if(!WORLD[c])errs.push("scene "+si+" item "+ii+": unknown iso "+c)})})}
    if(["list","timeline","count","bars","flow","tree","compare","map"].includes(s.k)&&!(s.items&&s.items.length))errs.push("scene "+si+": needs items");
    (s.items||[]).forEach((it,ii)=>{KINDS[s.k].forEach(k=>{if(it[k]==null||it[k]==="")errs.push("scene "+si+" item "+ii+": missing "+k)});
      if(s.k==="count"&&isNaN(+it.v))errs.push("scene "+si+" item "+ii+": v not numeric");
      if(!it.n)errs.push("scene "+si+" item "+ii+": missing narration n");
      ["l","d","s","h","n","txt","pre","suf"].forEach(k=>{if(it[k]!=null)texts.push([si+"."+ii,k,it[k]])});if(s.k==="count"||s.k==="bars")texts.push([si+"."+ii,"v",String(it.v)]);steps++});
    steps+=s.k==="trap"||s.k==="quiz"?2:(s.n?1:0)});
  texts.forEach(([w,k,t])=>{if(/<[a-z]/i.test(t))errs.push(w+"."+k+": HTML not allowed");if(((t.match(/\*/g)||[]).length)%2)errs.push(w+"."+k+": unbalanced *");
    if(/^(n|n2|na)$/.test(k))words+=(String(t).match(/\S+/g)||[]).length;
    nums(t).forEach(x=>{if(!allowed.has(x))errs.push(w+"."+k+": number \""+x+"\" not in lesson: "+String(t).slice(0,90))})});
  const s0=sb.scenes||[];if(!s0.length||s0[0].k!=="title")errs.push("first scene must be title");if(!s0.length||s0[s0.length-1].k!=="end")errs.push("last scene must be end");
  return {errs,steps,min:(words/2.3/60).toFixed(1)}}
let ids=process.argv.slice(2);if(!ids.length)ids=fs.readdirSync(path.join(R,"film")).filter(f=>/^[a-z]\d+\.json$/.test(f)).map(f=>f.slice(0,-5));
let bad=0;ids.forEach(id=>{const r=check(id);const e=Array.isArray(r)?r:r.errs;if(e.length)bad++;
  console.log((e.length?"FAIL ":"OK   ")+id+(Array.isArray(r)?"":" steps="+r.steps+" ~"+r.min+" min"));e.slice(0,25).forEach(x=>console.log("   - "+x))});
// rebuild index of available films
const idx={};fs.readdirSync(path.join(R,"film")).filter(f=>/^[a-z]\d+\.json$/.test(f)).forEach(f=>{const id=f.slice(0,-5);const r=check(id);if(!Array.isArray(r)&&!r.errs.length)idx[id]=1});
fs.writeFileSync(path.join(R,"film","index.json"),JSON.stringify(idx)+"\n");
console.log(bad?"RESULT: FAIL ("+bad+")":"RESULT: PASS");process.exit(bad?1:0);
