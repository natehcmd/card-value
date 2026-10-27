"use strict";
document.addEventListener("error",e=>{const t=e.target;if(t&&t.classList&&t.classList.contains("artimg"))t.parentNode.classList.add("noimg");},true);
const D = window.CARD_DATA || {cards:[]};
const SHARE = !!window.SHARE_MODE;
const M = window.MY_SPEND || {};
const CATS = ["dining","groceries","gas","other","amazon","flights","hotels","rideshare"];
const CAT_LABEL = {dining:"Dining",groceries:"Groceries",gas:"Gas",other:"Everything else",amazon:"Amazon",flights:"Flights",hotels:"Hotels",rideshare:"Uber & rides"};
const TRIP_CATS = new Set(["flights","hotels","rideshare"]);

const CUR = {
  delta:["Delta SkyMiles","Delta flights only"],
  southwest:["Southwest Rapid Rewards","Southwest flights only"],
  jetblue:["JetBlue TrueBlue","JetBlue flights only"],
  atmos:["Atmos Rewards (Alaska + Hawaiian)","Alaska and Hawaiian flights"],
  united:["United MileagePlus miles","United flights only"],
  amex:["Amex Membership Rewards","Move to airline and hotel partners"],
  chase:["Chase Ultimate Rewards","Move to partners, or use in Chase Travel"],
  citi:["Citi ThankYou points","Move to partners"],
  bilt:["Bilt points","Bilt quotes 2.2¢, which is optimistic"],
  aa:["AAdvantage miles","American Airlines only"],
  marriott:["Marriott Bonvoy points","Marriott stays only"],
  hilton:["Hilton Honors points","Hilton stays only"],
  hyatt:["World of Hyatt points","Hyatt stays; the best hotel points"],
  ihg:["IHG One points","IHG stays only"],
  cash:["Cash back / bank points","Statement credit or deposit"]
};
const PERKTYPE = {
  ride:["Uber and rideshare credits","Counts when you would ride anyway"],
  hotel:["Hotel credits from the card's travel site","Any stay booked there"],
  hotel_big:["Hotel credits needing a prepaid or $500+ stay","Hard to use for one-night visits"],
  travel:["General travel credit","Applies automatically to flights and hotels"],
  airline:["Airline fee credits (bags, seats)","Needs you to spend on those fees"],
  dining:["Credits at set restaurants","Only if you would eat there"],
  shopping:["Brand and shopping credits",""],
  streaming:["Streaming credits",""],
  entertainment:["Tickets and events",""],
  security:["CLEAR, Global Entry, TSA PreCheck",""],
  lounge:["Airport lounge access","Worth more the more you fly"],
  freenight:["Free hotel night awards","Estimates; only if you stay there"],
  flex:["Flexible cash (Bilt Cash)",""],
  lifestyle:["Lifestyle credits (delivery, fitness)",""],
  ride_other:["Lyft and chauffeur credits (not Uber)",""],
  bag:["Free checked bags on a card's airline","Counts the bag fee you would otherwise pay"],
  custom:["Credits on cards you added",""],
  other:["Other credits",""]
};
const DEF = () => ({
  basis:"b12",
  spend:Object.assign({dining:4300,groceries:1000,gas:2100,amazon:500,other:16200},(M.bases&&M.bases.b12)||{},{parents:0,paypal:M.paypal??0}),
  view:"table", tsort:{k:"net",dir:-1}, scale:(M.scale??1), feeMax:1000, custom:[],
  trips:{visits:M.visits??52,flights_per_visit:M.flights_per_visit??138.46,hotel_nights:M.hotel_nights??1,hotel_rate:M.hotel_rate??150,uber_per_visit:M.uber_per_visit??80,aa_share:M.aa_share??0.5,bag_fee:M.bag_fee??0,share:Object.assign({aa:0.44,delta:0.56,united:0,southwest:0,jetblue:0,alaska:0},M.share||{})},
  portal:false, chain_share:M.chain_share??0.25, has_prime:false, pair_freedom:false, mode:"steady",
  pv:{delta:1.1,united:1.2,southwest:1.4,jetblue:1.4,atmos:1.4,amex:2.0,chase:2.05,citi:1.9,bilt:2.2,aa:1.4,marriott:.7,hilton:.5,hyatt:1.7,ihg:.5,cash:1.0},
  use:{bag:100,custom:100,ride:100,hotel:100,travel:100,airline:50,dining:0,shopping:0,streaming:0,entertainment:0,security:0,lounge:0,freenight:0,flex:50,lifestyle:25,hotel_big:0,ride_other:0,other:0},
  other:{metal:0,abroad:1500,carry:0,parked:0,base_apy:0},
  off:{}, extra:{}, pins:[],
  f:{approved:false,get:false,nolock:false,norestrict:false,nofee:false,cash:false,metal:false,nofx:false,excl:false}, sort:"net"
});
let S = DEF();
try{ const raw = localStorage.getItem("cardvalue.v1"); if(raw){ const o = JSON.parse(raw); S = merge(DEF(), o); } }catch(e){}
function merge(a,b){ for(const k in b){ if(b[k] && typeof b[k]==="object" && !Array.isArray(b[k]) && a[k] && typeof a[k]==="object") merge(a[k],b[k]); else a[k]=b[k]; } return a; }
function save(){ try{ localStorage.setItem("cardvalue.v1", JSON.stringify(S)); }catch(e){} if(typeof window.onSaved==="function") window.onSaved(); }

const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = id => document.getElementById(id);
const usd = n => (n<0?"-$":"$")+Math.abs(Math.round(n)).toLocaleString();

/* ---------- the math ---------- */
function calc(c){
  const t=S.trips, sp0=S.spend, k0=S.scale;
  const sp={dining:sp0.dining*k0,groceries:sp0.groceries*k0,gas:sp0.gas*k0,amazon:sp0.amazon*k0,other:sp0.other*k0,parents:(sp0.parents||0)*k0,paypal:(sp0.paypal||0)*k0};
  const flights=t.flights_per_visit*t.visits, ownShare=c.airline?(t.share[c.airline]||0):t.aa_share, aaF=flights*ownShare, otF=flights-aaF;
  const hotels=t.visits*t.hotel_nights*t.hotel_rate, ride=t.visits*t.uber_per_visit;
  const noPrime = c.needs==="prime" && !S.has_prime;
  const e = noPrime ? Object.assign({},c.earn,c.no_prime) : c.earn;
  const portal = S.portal;
  const cur = (S.pair_freedom && c.freedom) ? "chase" : c.currency;
  const v = c.own_cpp!=null ? c.own_cpp/100 : (S.pv[cur] ?? 1)/100;
  const pts = {};
  pts.dining = sp.dining*e.dining;
  pts.groceries = sp.groceries*e.groceries;
  pts.gas = sp.gas*e.gas;
  pts.amazon = sp.amazon*(e.amazon ?? e.other);
  const otherTotal = sp.other+(sp.parents||0);
  if(c.paypal3){ const pp=Math.min(sp.paypal||0,otherTotal); pts.other=(otherTotal-pp)*e.other+pp*3; }
  else pts.other = otherTotal*e.other;
  pts.flights = (portal && e.flights_portal!=null) ? flights*e.flights_portal : aaF*e.aa + otF*e.other_airline + flights*(e.flights-e.other_airline);
  const hp = (portal && e.hotels_portal!=null) ? e.hotels_portal : e.hotels;
  pts.hotels = c.chain ? hotels*(S.chain_share*hp + (1-S.chain_share)*c.hotels_off) : hotels*hp;
  pts.rideshare = ride*e.rideshare;
  const rew = {}; let everyday=0, trips=0;
  for(const k of CATS){ rew[k]=pts[k]*v; (TRIP_CATS.has(k)?trips+=rew[k]:everyday+=rew[k]); }
  let credits=0; const perkVals=[];
  for(const p of c.perks_list){
    const key=c.name+"|"+p.label;
    const on = !S.off[key];
    const val = on ? p.amount*((S.use[p.type]??0)/100) : 0;
    credits+=val; perkVals.push({p,key,on,val});
  }
  if(c.bags){
    const legs=t.visits*2*ownShare, bv=c.bags*(+t.bag_fee||0)*legs*((S.use.bag??100)/100);
    credits+=bv; perkVals.push({p:{label:`Free checked bag${c.bags>1?"s":""} on its airline`,amount:bv,type:"bag",note:`${Math.round(legs)} flights a year at your bag fee`},key:c.name+"|bag",on:true,val:bv});
  }
  const extra = +S.extra[c.name]||0;
  const bf = S.mode==="year1" ? 1 : S.mode==="avg3" ? 1/3 : 0;
  const monthly = (sp.dining+sp.groceries+sp.gas+sp.amazon+sp.other+sp.parents+flights+hotels+ride)/12;
  let bonusBlocked = null;
  if(c.bonus_req && monthly*(c.bonus_days/30.4) < c.bonus_req) bonusBlocked={need:c.bonus_req,days:c.bonus_days,reach:monthly*c.bonus_days/30.4};
  const bonus = bonusBlocked ? 0 : ((c.bonus_pts||0)*v + (c.bonus_cash||0))*bf;
  const fee = (S.mode==="year1" && c.fee_y1!=null) ? c.fee_y1 : (S.mode==="avg3" && c.fee_y1!=null ? (c.fee_y1*1+c.fee*2)/3 : c.fee);
  const O=S.other;
  const metalV = c.metal ? (+O.metal||0) : 0;
  const fxCost = (c.ftf!=null && c.ftf>0) ? (+O.abroad||0)*c.ftf/100 : 0;
  const aprMid = c.apr ? (c.apr[0]+c.apr[1])/2 : null;
  const interest = (aprMid!=null) ? (+O.carry||0)*aprMid/100 : 0;
  const apyGain = (c.apy!=null) ? (+O.parked||0)*Math.max(0,c.apy-(+O.base_apy||0))/100 : 0;
  const other = metalV - fxCost - interest + apyGain;
  const net = everyday+trips+credits+extra+bonus+other-fee;
  const ptsTotal = CATS.reduce((s,k)=>s+pts[k],0);
  const creditFace = c.perks_list.reduce((s,p)=>s+p.amount,0);
  const bonusFull = (c.bonus_pts||0)*v+(c.bonus_cash||0);
  const bonusGives = [(c.bonus_pts?c.bonus_pts.toLocaleString()+" pts":""),(c.bonus_cash?usd(c.bonus_cash):"")].filter(Boolean).join(" + ");
  return {c,rew,pts,ptsTotal,everyday,trips,credits:credits+extra,creditWorth:credits,creditFace,bonus,bonusFull,bonusGives,fee,net,perkVals,v,cur,noPrime,extra,other,metalV,fxCost,interest,apyGain,bonusBlocked,monthly};
}

function allCards(){ return D.cards.concat(S.custom||[]); }
/* ---------- filters ---------- */
function isLocked(c){ return c.lock==="airline" || c.chain; }
function isRestricted(c){ return c.status==="membership needed" || c.status==="students only" || c.status==="waitlist"; }
function visible(c){
  const f=S.f;
  if(c.excluded && !f.excl) return false;
  if(S.feeMax<1000 && c.fee>S.feeMax) return false;
  if(f.get && !(c.avail && (c.avail.tier==='yours'||c.avail.tier==='open'||c.avail.tier==='check')) && c.status!=='custom') return false;
  if(f.approved && c.status!=="approved" && c.status!=="has") return false;
  if(f.nolock && isLocked(c)) return false;
  if(f.norestrict && isRestricted(c)) return false;
  if(f.nofee && c.fee>0) return false;
  if(f.cash && c.currency!=="cash") return false;
  if(f.metal && !c.metal) return false;
  if(f.premium && c.fee<500) return false;
  if(f.nofx && c.ftf!==0) return false;
  return true;
}

/* ---------- best stacks ---------- */
function bestStacks(rows){
  const pool = rows.filter(r=>!isRestricted(r.c)).slice(0,16);
  const out={};
  for(const k of [1,2,3]){
    let best=null;
    (function rec(start,pick){
      if(pick.length===k){
        const asg={}; let tot=0;
        for(const cat of CATS){ let m=pick[0]; for(const r of pick) if(r.rew[cat]>m.rew[cat]) m=r; asg[cat]=m; tot+=m.rew[cat]; }
        const fees=pick.reduce((s,r)=>s+r.c.fee,0);
        if(S.feeMax<1000 && fees>S.feeMax) return;
        for(const r of pick) tot += r.credits + r.bonus - r.fee;
        if(!best||tot>best.tot) best={tot,pick:[...pick],asg};
        return;
      }
      for(let i=start;i<pool.length;i++){ pick.push(pool[i]); rec(i+1,pick); pick.pop(); }
    })(0,[]);
    out[k]=best;
  }
  return out;
}

/* ---------- card picture and earn rates ---------- */
function artColors(c){
  const n=c.name.toLowerCase();
  const T=(a,b,ink="#fff")=>({a,b,ink});
  if(/platinum/.test(n)&&/amex|\(amex\)|^amex/.test(n)) return T("#e4e6ea","#9aa0a8","#20242a");
  if(/bilt palladium/.test(n)) return T("#e9e7e2","#a9a59b","#1b1a18");
  if(/bilt/.test(n)) return T("#1b1b1f","#3b3b44");
  if(/amex gold/.test(n)) return T("#d8b765","#a98530","#2b2108");
  if(/amex green/.test(n)) return T("#4f9f7e","#1f6a4d");
  if(/blue cash/.test(n)) return T("#2f80d8","#14509c");
  if(/sapphire reserve/.test(n)) return T("#1b2230","#0c111b");
  if(/sapphire/.test(n)) return T("#2b5aa8","#142e5e");
  if(/freedom|amazon|ihg|hyatt|marriott bonvoy boundless|united|southwest/.test(n)&&!/southwest/.test(n)) return /united/.test(n)?T("#1f4fb4","#0a2a74"):T("#1a73c9","#0b4b8d");
  if(/southwest/.test(n)) return T("#3552c4","#1a2f86");
  if(/delta/.test(n)) return T("#0a3a78","#c01933");
  if(/jetblue/.test(n)) return T("#1b59d6","#0a2d7e");
  if(/atmos|alaska/.test(n)) return T("#0f5b78","#06344a");
  if(/aadvantage|citi aadvantage/.test(n)) return T("#a9b3c2","#58708f","#10202f");
  if(/citi|strata|costco/.test(n)) return T("#1a5fb8","#0a3578");
  if(/bank of america|bofa/.test(n)) return T("#d1342b","#8f1b17");
  if(/capital one/.test(n)) return T("#0a5a8a","#042f4a");
  if(/wells fargo/.test(n)) return T("#c4262e","#7e1117");
  if(/discover/.test(n)) return T("#f58a1f","#c35a00","#1d1100");
  if(/apple/.test(n)) return T("#f4f4f2","#cfcfcc","#1d1d1f");
  if(/robinhood/.test(n)) return T("#14291e","#0a140e","#9af0c2");
  if(/u\.?s\.? bank|altitude/.test(n)) return T("#1b3a8c","#0c1e54");
  if(/uber/.test(n)) return T("#111","#2b2b2b");
  if(/navy federal/.test(n)) return T("#0a2b57","#071a35");
  if(/hilton/.test(n)) return T("#143a73","#0a1f40");
  return T("#4b5563","#1f2937");
}
function cardArtSvg(c,w=96){
  const col=artColors(c), h=Math.round(w*0.63), id="g"+Math.abs([...c.name].reduce((s,ch)=>(s*31+ch.charCodeAt(0))|0,7));
  const label=c.name.replace(" (you have it)","").replace(/ \((Amex|Chase|Barclays|Bank of America)\)/,"");
  let lines=[label];
  if(label.length>15){ let cut=label.lastIndexOf(" ",15); if(cut<6) cut=label.indexOf(" ",15); lines= cut>0 ? [label.slice(0,cut),label.slice(cut+1)] : [label]; if(lines[1]&&lines[1].length>20) lines[1]=lines[1].slice(0,19)+"…"; }
  const fs=w*0.095;
  return `<svg class="art" width="${w}" height="${h}" viewBox="0 0 160 101" role="img" aria-label="Illustration of the ${esc(label)} card" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col.a}"/><stop offset="1" stop-color="${col.b}"/></linearGradient>
  ${c.metal?`<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`:""}</defs>
  <rect x="1" y="1" width="158" height="99" rx="9" fill="url(#${id})" stroke="rgba(0,0,0,.25)"/>
  ${c.metal?`<rect x="1" y="1" width="158" height="99" rx="9" fill="url(#${id}m)"/>`:""}
  <rect x="14" y="30" width="22" height="16" rx="3" fill="#d9b86a" opacity=".92"/><path d="M14 38h22M25 30v16" stroke="#8a6d2a" stroke-width=".8" opacity=".7"/>
  ${lines.map((t,i)=>`<text x="14" y="${68+i*15}" fill="${col.ink}" font-size="13.5" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,sans-serif">${esc(t)}</text>`).join("")}
  <text x="146" y="20" text-anchor="end" fill="${col.ink}" opacity=".75" font-size="8.5" font-weight="600" font-family="-apple-system,Segoe UI,Roboto,sans-serif">${c.fee?"$"+c.fee+" fee":"No fee"}</text>
  </svg>`;
}
function cardArt(c,w=96){
  const svg=cardArtSvg(c,w);
  if(!c.img) return svg;
  const h=Math.round(w*0.63);
  return `<span class="artbox" style="width:${w}px;height:${h}px"><img class="artimg" src="${esc(c.img)}" width="${w}" alt="${esc(c.name)} card" loading="lazy" referrerpolicy="no-referrer"><span class="artfb">${svg}</span></span>`;
}
function rateRows(r){
  const c=r.c, e=c.earn, portal=S.portal;
  const own=c.airline?e.aa:(portal&&e.flights_portal!=null?e.flights_portal:e.flights);
  const hot=portal&&e.hotels_portal!=null?e.hotels_portal:e.hotels;
  return [["dining","Dining",e.dining],["groceries","Groceries",e.groceries],["gas","Gas",e.gas],["flights",c.airline?"Its airline":"Flights",own],["hotels","Hotels",hot],["rideshare","Uber & rides",e.rideshare],["other","Everything else",e.other],["amazon","Amazon",e.amazon??e.other]].map(([k,l,x])=>({k,l,x,pct:x*r.v*100}));
}
const pctTxt=p=>(p>=10?p.toFixed(0):p.toFixed(1))+"%";
/* ---------- table view ---------- */
const COLS=[
 {k:"name",l:"Card",g:""},
 {k:"ptsTotal",l:"Points or miles it earns / yr",g:"gives",v:r=>r.ptsTotal,f:r=>Math.round(r.ptsTotal).toLocaleString(),sep:1},
 {k:"creditFace",l:"Credits it offers / yr",g:"gives",v:r=>r.creditFace,f:r=>r.creditFace?usd(r.creditFace):"-"},
 {k:"bonusFace",l:"Sign-up bonus it offers",g:"gives",v:r=>(r.c.bonus_pts||0)*r.v+(r.c.bonus_cash||0),f:r=>r.bonusGives||"-"},
 {k:"cpp",l:"1 point is worth",g:"worth",v:r=>r.v,f:r=>(r.v*100).toFixed(2)+"¢",sep:1},
 {k:"rewards",l:"Rewards, in dollars",g:"worth",v:r=>r.everyday+r.trips,f:r=>usd(r.everyday+r.trips)},
 {k:"creditWorth",l:"Credits you'd use",g:"worth",v:r=>r.credits,f:r=>usd(r.credits)},
 {k:"bonus",l:"Bonus counted",g:"worth",v:r=>r.bonus,f:r=>usd(r.bonus)},
 {k:"other",l:"Other factors",g:"worth",v:r=>r.other,f:r=>usd(r.other)},
 {k:"fee",l:"Annual fee",g:"worth",v:r=>-r.fee,f:r=>r.fee?"−"+usd(r.fee).replace("-",""):"$0"},
 {k:"net",l:"Worth to you / yr",g:"worth",v:r=>r.net,f:r=>usd(r.net),cls:"net"},
 {k:"r_dining",l:"Dining",g:"rates",rate:"dining",sep:1},
 {k:"r_groceries",l:"Groceries",g:"rates",rate:"groceries"},
 {k:"r_gas",l:"Gas",g:"rates",rate:"gas"},
 {k:"r_flights",l:"Flights",g:"rates",rate:"flights"},
 {k:"r_hotels",l:"Hotels",g:"rates",rate:"hotels"},
 {k:"r_rideshare",l:"Uber & rides",g:"rates",rate:"rideshare"},
 {k:"r_other",l:"Everything else",g:"rates",rate:"other"},
 {k:"metal",l:"Metal card",g:"facts",v:r=>r.c.metal?1:0,f:r=>r.c.metal?'<span class="yes">Yes</span>':'<span class="no">-</span>',sep:1},
 {k:"ftf",l:"Foreign fee",g:"facts",v:r=>r.c.ftf==null?99:r.c.ftf,f:r=>r.c.ftf==null?'<span class="no">?</span>':(r.c.ftf===0?'<span class="yes">None</span>':'<span class="warn">'+r.c.ftf+'%</span>')},
 {k:"apr",l:"APR",g:"facts",v:r=>r.c.apr?r.c.apr[0]:999,f:r=>r.c.apr?r.c.apr[0]+"–"+r.c.apr[1]+"%":'<span class="no">?</span>'},
 {k:"apy",l:"Card APY",g:"facts",v:r=>r.c.apy??0,f:r=>r.c.apy!=null?r.c.apy+"%":'<span class="no">-</span>'},
 {k:"avail",l:"Can I get it?",g:"facts",v:r=>({yours:0,open:1,check:2,blocked:3})[r.c.avail&&r.c.avail.tier]??1,f:r=>{const a=r.c.avail||{tier:"open",note:""};const lab={yours:"Yours / approved",open:"Open to apply",check:"Check odds first",blocked:"Blocked"}[a.tier]||"Open";const cl={yours:"yes",open:"",check:"warn",blocked:"warn"}[a.tier];return `<span class="${cl}" title="${esc(a.note)}">${lab}</span>`;}},
 {k:"url",l:"Apply",g:"facts",v:r=>0,f:r=>`<a href="${esc(r.c.url||("https://www.google.com/search?q="+encodeURIComponent(r.c.name+" credit card apply")))}" target="_blank" rel="noopener">${r.c.url?"Issuer page":"Search"}</a>`},
 {k:"lock",l:"Lock / status",g:"facts",v:r=>0,f:r=>{const t=[];if(r.c.status==="custom")t.push("Added by you");if(r.bonusBlocked)t.push("Bonus out of reach");if(r.c.lock==="airline")t.push("Airline");if(r.c.chain)t.push("Hotel chain");if(r.c.status==="approved")t.push("Approved");if(r.c.status==="has")t.push("You have it");if(r.c.status==="waitlist")t.push("Waitlist");if(r.c.status==="membership needed")t.push("Membership");if(r.c.status==="students only")t.push("Students");if(r.c.checked!=="issuer")t.push("Unchecked");return t.join(", ")||'<span class="no">-</span>';}}
];
const GORD={"":0,rates:1,gives:2,worth:3,facts:4};
COLS.sort((a,b)=>GORD[a.g||""]-GORD[b.g||""]);
function tableHTML(rows){
  const ts=S.tsort, col=COLS.find(c=>c.k===ts.k)||COLS.find(c=>c.k==="net");
  const val=r=>col.k==="name"?r.c.name.toLowerCase():col.v(r);
  rows=[...rows].sort((a,b)=>{const x=val(a),y=val(b);return (x<y?-1:x>y?1:0)*ts.dir;});
  const grp=(g,l,n)=>`<th class="g-${g}" colspan="${n}">${l}</th>`;
  const head=`<thead><tr class="grp"><th></th>${grp("rates","Points or miles earned per $1, and what that is worth",7)}${grp("gives","What it gives",3)}${grp("worth","What it's worth to you",7)}${grp("facts","Facts",7)}</tr>
  <tr class="cols">${COLS.map(c=>`<th data-sort="${c.k}" class="${c.sep?"sep":""} ${c.g?"g-"+c.g:""}">${c.l}${ts.k===c.k?`<span class="arrow">${ts.dir<0?"▼":"▲"}</span>`:""}</th>`).join("")}</tr></thead>`;
  const body=rows.map(r=>{ const rr=Object.fromEntries(rateRows(r).map(x=>[x.k,x])); return `<tr>${COLS.map(c=>{
    if(c.rate){ const x=rr[c.rate]; const hi=x.pct>=4; return `<td class="${c.sep?"sep":""} ${hi?"hi":""}">${x.x}x<small>${pctTxt(x.pct)}</small></td>`; }
    if(c.k==="name") return `<td class="name"><div class="nm">${cardArt(r.c,78)}<div><button data-open="${esc(r.c.name)}">${esc(r.c.name)}</button><small>${r.c.fee?usd(r.c.fee)+" fee":"No fee"}${r.c.fee_note?" · "+esc(r.c.fee_note):""}</small></div></div></td>`;
    const neg=c.k==="net"&&r.net<0;
    return `<td class="${c.cls||""} ${neg?"neg":""} ${c.sep?"sep":""}">${c.f(r)}</td>`;}).join("")}</tr>`;}).join("");
  return `<div class="tablewrap"><table class="sheet">${head}<tbody>${body}</tbody></table></div>`;
}
function csvDownload(){
  const rows=allCards().map(calc).filter(r=>visible(r.c));
  const cols=COLS.filter(c=>c.k!=="name"&&c.k!=="lock");
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const strip=s=>String(s).replace(/<[^>]*>/g,"");
  const lines=[["Card",...cols.map(c=>c.l)].map(q).join(",")];
  for(const r of rows.sort((a,b)=>b.net-a.net)) lines.push([r.c.name,...cols.map(c=>strip(c.f(r)))].map(q).join(","));
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/csv"})); a.download="card-value.csv"; a.click();
}

/* ---------- rendering ---------- */
let OPEN = new Set();
function render(){
  const all = allCards().map(calc);
  const rows = all.filter(r=>visible(r.c));
  const sorters = {net:(a,b)=>b.net-a.net, rewards:(a,b)=>(b.everyday+b.trips)-(a.everyday+a.trips), fee:(a,b)=>a.fee-b.fee||b.net-a.net, trips:(a,b)=>b.trips-a.trips};
  rows.sort(sorters[S.sort]||sorters.net);
  renderStacks([...rows].sort(sorters.net));
  renderFilters(rows.length, all.length);
  const maxGross = Math.max(1,...rows.map(r=>r.everyday+r.trips+Math.max(0,r.credits)+r.bonus));
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===S.view)));
  $("sort").style.display = S.view==="table" ? "none" : "";
  $("list").innerHTML = !rows.length ? '<div class="card">No cards match these filters.</div>' : (S.view==="table" ? tableHTML(rows) : rows.map((r,i)=>cardHTML(r,i+1,maxGross)).join(""));
  $("foot").innerHTML = footHTML();
  renderTray();
}
function renderStacks(sorted){
  const st = bestStacks(sorted);
  const names=["One card","Two cards","Three cards"];
  $("stacks").innerHTML = [1,2,3].map(k=>{
    const b=st[k]; if(!b) return "";
    const lines = b.pick.map(r=>{
      const cats = CATS.filter(c=>b.asg[c]===r && (r.rew[c]>0)).map(c=>CAT_LABEL[c].toLowerCase());
      return `<li><b>${esc(shortName(r.c.name))}</b>${cats.length?`: ${esc(cats.join(", "))}`:""}</li>`;
    }).join("");
    return `<div class="stack"><div class="k">Best ${names[k-1].toLowerCase()}</div><div class="v num">${usd(b.tot)}<span style="font-size:14px;font-weight:500;color:var(--muted)"> /yr</span></div><ul>${lines}</ul></div>`;
  }).join("");
}
function shortName(n){ return n.replace(" (you have it)","").replace("Capital One ","CapOne ").replace("Bank of America ","BofA ").replace("Navy Federal ","NFCU ").replace(" Visa Signature",""); }
function renderFilters(n,total){
  const chips=[...(SHARE?[]:[["approved","Approved / yours"]]),["nolock","No airline or hotel lock"],["nofee","No annual fee"],["premium","$500+ fee cards only"],["cash","Cash back only"],["metal","Metal card"],["nofx","No foreign fee"]];
  $("filters").innerHTML = chips.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${S.f[k]}">${l}</button>`).join("")
   + `<select id="sort" aria-label="Sort"><option value="net">Sort: worth to me</option><option value="rewards">Sort: everyday + trip rewards</option><option value="trips">Sort: best on trips</option><option value="fee">Sort: lowest fee</option></select>`
   + `<span class="count">Showing ${n} of ${total}</span>`;
  $("sort").value=S.sort;
}
function tagsHTML(c){
  const t=[];
  if(c.status==="approved") t.push('<span class="tag good">Approved for you</span>');
  if(c.status==="has") t.push('<span class="tag good">You have it</span>');
  if(c.status==="waitlist") t.push('<span class="tag warn">Waitlist</span>');
  if(c.status==="membership needed") t.push('<span class="tag warn">Membership needed</span>');
  if(c.status==="students only") t.push('<span class="tag warn">Students only</span>');
  if(c.lock==="airline") t.push('<span class="tag warn">Airline-locked</span>');
  if(c.chain) t.push('<span class="tag warn">One hotel chain</span>');
  if(c.fee===0) t.push('<span class="tag">No fee</span>'); else t.push(`<span class="tag">${usd(c.fee)} fee${c.fee_note?` · ${esc(c.fee_note)}`:""}</span>`);
  if(c.metal) t.push('<span class="tag good" title="Physical metal card">Metal card</span>');
  if(c.ftf===0) t.push('<span class="tag good" title="'+(c.ftf_src==="page"?"Read on the issuer page":"From memory, not checked")+'">No foreign fee</span>');
  else if(c.ftf>0) t.push('<span class="tag warn" title="From memory, not checked">'+c.ftf+'% foreign fee</span>');
  if(c.apr) t.push('<span class="tag" title="Variable purchase APR">APR '+c.apr[0]+(c.apr[1]!==c.apr[0]?'–'+c.apr[1]:'')+'%</span>');
  if(c.intro) t.push('<span class="tag">'+esc(c.intro)+'</span>');
  if(c.apy!=null) t.push('<span class="tag good" title="'+esc(c.apy_note||"")+'">'+c.apy+'% APY</span>');
  if(c.avail&&c.avail.tier==="check") t.push('<span class="tag warn" title="'+esc(c.avail.note)+'">Check odds first</span>');
  if(c.avail&&c.avail.tier==="blocked") t.push('<span class="tag warn" title="'+esc(c.avail.note)+'">Blocked</span>');
  if(c.checked!=="issuer") t.push('<span class="tag" title="Terms were not read on the issuer page">Unchecked terms</span>');
  return t.join("");
}
function whyLine(r){
  const items = CATS.map(k=>[k,r.rew[k]]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const parts = items.map(([k,val])=>`${CAT_LABEL[k].toLowerCase()} ${usd(val)}`);
  if(r.credits>=40) parts.push(`credits ${usd(r.credits)}`);
  return (parts.length? "Most comes from "+parts.join(", ")+"." : "")+(r.bonusBlocked?" Sign-up bonus is out of reach at your spending.":"");
}
function cardHTML(r,rank,maxGross){
  const c=r.c, open=OPEN.has(c.name), pinned=S.pins.includes(c.name);
  const seg=(val,col)=>val>0?`<i style="width:${(val/maxGross*100).toFixed(2)}%;background:var(${col})"></i>`:"";
  const meter = seg(r.everyday,"--c-everyday")+seg(r.trips,"--c-trips")+seg(Math.max(0,r.credits),"--c-credits")+seg(r.bonus,"--c-bonus");
  return `<article class="card ${pinned?"pinned":""}" data-name="${esc(c.name)}">
    <div class="head">
      <div class="rank num">${rank}</div>
      <div class="artcell">${cardArt(c,150)}</div>
      <div><div class="name">${esc(c.name)}</div><div class="tags">${tagsHTML(c)}</div></div>
      <div class="big"><div class="n num ${r.net<0?"neg":""}">${usd(r.net)}</div><div class="u">worth to you / yr</div></div>
    </div>
    <div class="meter" aria-hidden="true">${meter}</div>
    <div class="legend"><span style="--c:var(--c-everyday)">Everyday ${usd(r.everyday)}</span><span style="--c:var(--c-trips)">Trips ${usd(r.trips)}</span><span style="--c:var(--c-credits)">Credits ${usd(r.credits)}</span>${r.bonus?`<span style="--c:var(--c-bonus)">Bonus ${usd(r.bonus)}</span>`:""}${r.other?`<span style="--c:var(--accent)">Other ${usd(r.other)}</span>`:""}<span style="--c:var(--bad)">Fee −${usd(r.fee).replace("$","$")}</span></div>
    <div class="rates" aria-label="Earn rate per dollar">${rateRows(r).filter(x=>x.x>0).map(x=>`<div class="rt ${x.pct>=4?"hi":""}"><b>${x.x}x ${esc(x.l)}</b>= ${pctTxt(x.pct)} back</div>`).join("")}</div>
    <p class="why">1 ${r.cur==="cash"?"point":"point or mile"} = ${(r.v*100).toFixed(2)}¢. ${esc(whyLine(r))}</p>
    <div class="acts"><button class="btn" data-act="open">${open?"Hide details":"Show details"}</button><button class="btn ${pinned?"primary":""}" data-act="pin">${pinned?"Pinned":"Compare"}</button></div>
    ${open?detailHTML(r):""}
  </article>`;
}
function detailHTML(r){
  const c=r.c;
  const rates = CATS.map(k=>{
    let m=c.earn[k]??c.earn.other;
    if(k==="flights"&&S.portal&&c.earn.flights_portal!=null) m=c.earn.flights_portal;
    if(k==="hotels"&&S.portal&&c.earn.hotels_portal!=null) m=c.earn.hotels_portal;
    return `<div><span>${CAT_LABEL[k]}</span><span class="num">${m}x → ${usd(r.rew[k])}</span></div>`;
  }).join("");
  const perks = r.perkVals.length ? r.perkVals.map(pv=>`<label class="perk"><input type="checkbox" data-perk="${esc(pv.key)}" ${pv.on?"checked":""}><span>${esc(pv.p.label)} · ${usd(pv.p.amount)}${pv.p.type==="security"&&pv.p.amount===30?"/yr":"/yr"} <b class="num" style="color:var(--accent)">${pv.val?`counts ${usd(pv.val)}`:"counts $0"}</b><small>${esc(PERKTYPE[pv.p.type]?.[0]||"")}${pv.p.note?" · "+esc(pv.p.note):""}</small></span></label>`).join("") : '<div class="notes">No itemized credits.</div>';
  return `<div class="detail">
    <div><h4>How the rewards add up</h4><div class="kv">${rates}</div>
      <div class="notes" style="margin-top:8px">${r.cur==="cash"?"Valued as cash":`1 point = ${S.pv[r.cur]}¢ (${esc(CUR[r.cur][0])})`}. ${c.chain?`Hotel points assume ${Math.round(S.chain_share*100)}% of your nights are at this chain.`:""}</div>
    </div>
    <div><h4>Credits and perks</h4>${perks}
      <div class="extra"><label for="x-${esc(c.name)}">Extra value to me $/yr</label><input id="x-${esc(c.name)}" type="number" step="10" data-extra="${esc(c.name)}" value="${S.extra[c.name]||0}"></div>
      <div class="notes" style="margin-top:6px">Use this for things the list can't price: free bags, lounges, trip protection.</div>
    </div>
    <div class="notes" style="grid-column:1/-1">
      <b>Can I get it?</b> ${esc((c.avail&&c.avail.note)||"")}${c.url?` <a href="${esc(c.url)}" target="_blank" rel="noopener">Issuer page</a>`:` <a href="https://www.google.com/search?q=${encodeURIComponent(c.name+" credit card apply")}" target="_blank" rel="noopener">Search</a>`}<br>
      ${r.bonusBlocked?`<b>Bonus:</b> needs ${usd(r.bonusBlocked.need)} in ${r.bonusBlocked.days} days; at your pace you would reach about ${usd(r.bonusBlocked.reach)}, so it counts as $0.<br>`:""}
      <b>Perks:</b> ${esc(c.perks||"")}<br>
      ${c.bonus_note?`<b>Sign-up bonus:</b> ${esc(c.bonus_note)}<br>`:""}
      ${c.cover?`<b>Trip cover:</b> ${esc(c.cover)}<br>`:""}
      ${c.college?`<b>For college visits:</b> ${esc(c.college)}<br>`:""}
      <b>Points go to:</b> ${esc(c.points_to||"")}<br>
      <b>Good to know:</b> ${[
        c.metal?"physical metal card":"",
        c.ftf===0?"no foreign transaction fee":(c.ftf>0?c.ftf+"% foreign transaction fee":"foreign fee not checked"),
        c.apr?"purchase APR "+c.apr[0]+"% to "+c.apr[1]+"%":"APR not checked",
        c.intro||"",
        c.apy!=null?c.apy+"% APY: "+(c.apy_note||""):""
      ].filter(Boolean).map(esc).join(" · ")}
    </div>
  </div>`;
}
function footHTML(){
  const nm=(D.not_modeled||[]).length?`Seen on your Amex page but not modeled (no rates, and airline- or hotel-locked): ${esc(D.not_modeled.join("; "))}. `:"";
  return `${nm}Numbers are estimates from issuer pages (checked October 2026) and your own spending. Sign-up bonuses need their minimum spend. Cards marked Unchecked terms came from secondary sources. This page doesn't apply for anything, uses no affiliate links, and is not financial advice. Check each issuer's page before you apply.`;
}
function renderTray(){
  const tray=$("tray");
  if(!S.pins.length){ tray.hidden=true; return; }
  tray.hidden=false;
  $("trayin").innerHTML = S.pins.map(n=>`<span class="pill">${esc(shortName(n))}</span>`).join("")
    + `<button class="btn primary" id="cmpgo" ${S.pins.length<2?"disabled":""}>Compare side by side</button><button class="btn" id="cmpclear">Clear</button>`;
}
function openCompare(){
  const rs=S.pins.map(n=>calc(allCards().find(c=>c.name===n))).filter(Boolean);
  const best=Math.max(...rs.map(r=>r.net));
  $("cmp").hidden=false;
  $("cmp").innerHTML = `<div class="box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">Side by side</h2><button class="btn" id="cmpx">Close</button></div>
  <div class="cmpgrid" style="--n:${rs.length}">${rs.map(r=>`<div class="cmpcol">
    <h3>${esc(r.c.name)}</h3><div class="tags">${tagsHTML(r.c)}</div>
    <div class="big" style="text-align:left;margin:12px 0"><div class="n num" style="${r.net===best?"color:var(--accent)":""}">${usd(r.net)}</div><div class="u">worth to you / yr</div></div>
    <div class="kv">
      <div><span>Everyday rewards</span><span class="num">${usd(r.everyday)}</span></div>
      <div><span>Trip rewards</span><span class="num">${usd(r.trips)}</span></div>
      <div><span>Credits you'd use</span><span class="num">${usd(r.credits)}</span></div>
      <div><span>Sign-up bonus</span><span class="num">${usd(r.bonus)}</span></div>
      <div><span>Other factors</span><span class="num">${usd(r.other)}</span></div>
      <div><span>Annual fee</span><span class="num">−${usd(r.fee).replace("-","")}</span></div>
      <div><span>Metal card</span><span>${r.c.metal?"Yes":"No"}</span></div>
      <div><span>Foreign fee</span><span>${r.c.ftf==null?"not checked":r.c.ftf+"%"}</span></div>
      <div><span>APR</span><span>${r.c.apr?r.c.apr[0]+"–"+r.c.apr[1]+"%":"not checked"}</span></div>
      <div><span>Card APY</span><span>${r.c.apy!=null?r.c.apy+"%":"none"}</span></div>
      ${CATS.map(k=>`<div><span>${CAT_LABEL[k]}</span><span class="num">${r.c.earn[k]??r.c.earn.other}x</span></div>`).join("")}
    </div>
    <p class="notes">${esc(r.c.perks||"")}</p>
    ${r.c.cover?`<p class="notes"><b>Trip cover:</b> ${esc(r.c.cover)}</p>`:""}
  </div>`).join("")}</div></div>`;
}

/* ---------- value panel ---------- */
function slider(id,label,desc,min,max,step,val,fmt){
  return `<div class="row"><label class="t" for="${id}"><span>${esc(label)}</span><output id="${id}-o">${fmt(val)}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">${desc?`<p class="d">${esc(desc)}</p>`:""}</div>`;
}
function numField(path,label,step){
  const ps=path.split("."); const val=ps.reduce((o,k)=>o[k],S);
  return `<label class="field">${esc(label)}<input type="number" step="${step||"any"}" inputmode="decimal" data-path="${path}" value="${val}"></label>`;
}
function buildPanel(){
  const pts = Object.keys(CUR).map(k=>slider("pv-"+k,CUR[k][0],CUR[k][1],k==="hyatt"?0:0,k==="cash"?3:4,0.05,S.pv[k],v=>v.toFixed(2)+"¢")).join("");
  const perks = Object.keys(PERKTYPE).map(k=>slider("use-"+k,PERKTYPE[k][0],PERKTYPE[k][1],0,100,5,S.use[k],v=>v+"%")).join("");
  $("panel").innerHTML = `
  <details class="sec" open><summary>What one point is worth</summary><div class="body">${pts}</div></details>
  <details class="sec"><summary>How much of each credit you'd use</summary><div class="body"><p class="d" style="margin:0;color:var(--muted);font-size:13px">100% means a $100 credit is worth $100 to you. 0% means you'd never use it.</p>${perks}</div></details>
  <details class="sec" open><summary>Sign-up bonuses</summary><div class="body">
    <div class="seg" role="group" aria-label="Bonus mode">
      <button data-mode="year1" aria-pressed="${S.mode==="year1"}">Year 1</button>
      <button data-mode="avg3" aria-pressed="${S.mode==="avg3"}">3-yr average</button>
      <button data-mode="steady" aria-pressed="${S.mode==="steady"}">Ignore</button>
    </div>
    <p class="d" style="margin:0;color:var(--muted);font-size:13px">Year 1 also uses first-year fee waivers.</p></div></details>
  <details class="sec"><summary>Your spending (per year)</summary><div class="body">
    ${(M.bases&&M.bases.b12p)?`<div class="seg" role="group" aria-label="Spending basis">
      <button data-basis="b12" aria-pressed="${S.basis==="b12"}">Last 12 months</button>
      <button data-basis="b12p" aria-pressed="${S.basis==="b12p"}">+ unseen PayPal</button>
      <button data-basis="b6" aria-pressed="${S.basis==="b6"}">Last 6 mo × 2</button>
    </div>
    <p class="d" style="margin:0;color:var(--muted);font-size:13px">Pulled from your statements and exports. Pick the basis, then edit any number.</p>`:`<p class="d" style="margin:0;color:var(--muted);font-size:13px">Example numbers. Replace them with your own yearly spending.</p>`}
    <div class="grid2">
    ${numField("spend.dining","Dining")}${numField("spend.groceries","Groceries")}${numField("spend.gas","Gas")}${numField("spend.amazon","Amazon")}${numField("spend.other","Everything else")}${numField("spend.parents","Bought for parents, repaid")}
    </div>
    ${numField("spend.paypal","Of that, paid through PayPal checkout")}
  </div></details>
  ${(M.audit&&M.audit.length)?`<details class="sec" open><summary>Check my numbers</summary><div class="body audit"><ul>${M.audit.map(a=>`<li><b class="${a.s}">${a.s==="ok"?"Ties out":a.s==="fixed"?"Fixed":"Heads up"}.</b> ${esc(a.t)}</li>`).join("")}</ul></div></details>`:""}
  <details class="sec"><summary>College visits</summary><div class="body"><div class="grid2">
    ${numField("trips.visits","Visits a year")}${numField("trips.flights_per_visit","Flights $ per visit")}${numField("trips.hotel_nights","Hotel nights")}${numField("trips.hotel_rate","Hotel $ per night")}${numField("trips.uber_per_visit","Uber $ per visit")}${numField("trips.share.aa","Flights on American (0-1)","0.05")}${numField("trips.share.delta","Flights on Delta (0-1)","0.05")}${numField("trips.share.united","Flights on United (0-1)","0.05")}${numField("trips.share.southwest","Flights on Southwest (0-1)","0.05")}${numField("trips.share.jetblue","Flights on JetBlue (0-1)","0.05")}${numField("trips.share.alaska","Flights on Alaska (0-1)","0.05")}${numField("trips.bag_fee","Checked bag fee per flight $")}
  </div>
  <label class="check"><input type="checkbox" id="portal" ${S.portal?"checked":""}><span>I'll book flights and hotels in card travel sites<br><small style="color:var(--muted)">Unlocks 5x to 12x rates. Prices there may differ.</small></span></label></div></details>
  <details class="sec"><summary>Other things that matter</summary><div class="body">
    <label class="field">A metal card is worth to me, $ a year<input type="number" step="5" data-path="other.metal" value="${S.other.metal}"></label>
    <label class="field">Spend abroad, $ a year<input type="number" step="100" data-path="other.abroad" value="${S.other.abroad}"></label>
    <p class="d" style="margin:0;color:var(--muted);font-size:13px">Cards that charge a foreign fee lose that share of this. Italy and Japan this year is why it starts at $1,500, a guess.</p>
    <label class="field">Balance I carry month to month, $<input type="number" step="100" data-path="other.carry" value="${S.other.carry}"></label>
    <p class="d" style="margin:0;color:var(--muted);font-size:13px">Costs the middle of each card's APR. Leave at 0 if you pay in full.</p>
    <label class="field">Cash I'd keep in a card's savings or brokerage, $<input type="number" step="500" data-path="other.parked" value="${S.other.parked}"></label>
    <label class="field">What my savings pays now, APY %<input type="number" step="0.1" data-path="other.base_apy" value="${S.other.base_apy}"></label>
  </div></details>
  <details class="sec"><summary>Add a card of your own</summary><div class="body">
    <p class="d" style="margin:0;color:var(--muted);font-size:13px">Anything the list is missing. It ranks with the rest and is saved in this browser only.</p>
    <div class="cform">
      <label class="field wide">Card name<input id="cc-name" type="text" placeholder="Example Rewards Visa"></label>
      <label class="field">Annual fee $<input id="cc-fee" type="number" value="0"></label>
      <label class="field">1 point is worth ¢<input id="cc-cpp" type="number" step="0.1" value="1"></label>
      <label class="field">Dining x<input id="cc-d" type="number" step="0.5" value="1"></label>
      <label class="field">Groceries x<input id="cc-g" type="number" step="0.5" value="1"></label>
      <label class="field">Gas x<input id="cc-ga" type="number" step="0.5" value="1"></label>
      <label class="field">Everything else x<input id="cc-o" type="number" step="0.5" value="1"></label>
      <label class="field">Flights x<input id="cc-fl" type="number" step="0.5" value="1"></label>
      <label class="field">Hotels x<input id="cc-h" type="number" step="0.5" value="1"></label>
      <label class="field">Uber and rides x<input id="cc-r" type="number" step="0.5" value="1"></label>
      <label class="field">Amazon x<input id="cc-am" type="number" step="0.5" value="1"></label>
      <label class="field">Credits worth $ a year<input id="cc-cr" type="number" value="0"></label>
      <label class="field">Sign-up bonus $<input id="cc-b" type="number" value="0"></label>
    </div>
    <button class="btn primary" id="ccadd">Add this card</button>
    <div class="clist">${(S.custom||[]).map((c,i)=>`<div><span>${esc(c.name)}</span><button class="btn" data-rmc="${i}">Remove</button></div>`).join("")}</div>
  </div></details>
  <details class="sec"><summary>Other switches</summary><div class="body">
    <label class="check"><input type="checkbox" id="prime" ${S.has_prime?"checked":""}><span>I have Amazon Prime</span></label>
    <label class="check"><input type="checkbox" id="pair" ${S.pair_freedom?"checked":""}><span>Count Freedom card points as Chase points<br><small style="color:var(--muted)">Only true if you also hold a Sapphire.</small></span></label>
    ${slider("chain",'Share of hotel nights at a card\'s own chain',"Applies to Hyatt, Hilton, IHG and Marriott cards",0,100,5,Math.round(S.chain_share*100),v=>v+"%")}
  </div></details>`;
}

/* ---------- spending wizard: type it in, or read a CSV in the browser ---------- */
const TYPICAL={dining:0.12,groceries:0.15,gas:0.07,amazon:0.05,other:0.61};
const WCATS=[["dining","Dining and restaurants"],["groceries","Groceries"],["gas","Gas"],["amazon","Amazon"],["other","Everything else (shopping, bills, subscriptions)"]];
const W={tab:"type",per:"month",v:{dining:"",groceries:"",gas:"",amazon:"",other:""},trip:{trips:"",flight:"",nights:"",rate:"",rides:""},total:"",up:null,sign:"auto",months:""};
const wnum=x=>{const n=parseFloat(String(x).replace(/[$,\s]/g,""));return isFinite(n)?n:0;};
const toYear=v=>W.per==="month"?wnum(v)*12:wnum(v);
const fromYear=y=>Math.round(W.per==="month"?y/12:y);
function openWizard(){
  const sp=S.spend,t=S.trips;
  const blank=SHARE&&!S.onboarded;
  for(const [k] of WCATS) W.v[k]=blank?"":fromYear(sp[k]||0);
  W.trip=blank?{trips:"",flight:"",nights:"",rate:"",rides:""}:{trips:t.visits||"",flight:Math.round(t.flights_per_visit||0)||"",nights:t.hotel_nights||"",rate:t.hotel_rate||"",rides:Math.round(t.uber_per_visit||0)||""};
  W.total=""; W.up=null;
  W.tab="type"; $("wiz").hidden=false; renderWizard();
}
function closeWizard(){ $("wiz").hidden=true; }
function wizTotals(){
  const ev=WCATS.reduce((s,[k])=>s+toYear(W.v[k]),0);
  const tr=wnum(W.trip.trips), trip=tr*(wnum(W.trip.flight)+wnum(W.trip.nights)*wnum(W.trip.rate)+wnum(W.trip.rides));
  return {ev,trip,year:ev+trip,month:(ev+trip)/12};
}
function renderWizard(){
  const T=wizTotals(), unit=W.per==="month"?"a month":"a year";
  const fld=(k,l)=>`<label class="field">${esc(l)} <small style="color:var(--muted)">${unit}</small><input type="number" inputmode="decimal" min="0" step="any" data-wv="${k}" value="${W.v[k]}" placeholder="0"></label>`;
  const type=`
    <p class="d" style="margin:0 0 10px;color:var(--muted)">Pick whether you think in months or years, then fill in what you spend. Leave a box empty for $0. Only card-friendly spending counts: skip rent, loans and transfers.</p>
    <div class="seg" style="grid-template-columns:1fr 1fr;max-width:320px;margin-bottom:12px" role="group" aria-label="Enter by"><button data-wper="month" aria-pressed="${W.per==="month"}">Per month</button><button data-wper="year" aria-pressed="${W.per==="year"}">Per year</button></div>
    <div class="cform" style="margin-bottom:6px">
      <label class="field wide">About how much do you spend ${unit} in total on everyday things? <small style="color:var(--muted)">(optional shortcut)</small>
        <span style="display:flex;gap:8px"><input type="number" inputmode="decimal" min="0" step="any" id="wtotal" value="${W.total}" placeholder="e.g. 2500" style="flex:1"><button class="btn" id="wsplit">Split it for me</button></span></label>
      <p class="d wide" style="margin:0;color:var(--muted);font-size:12.5px">The split uses a typical US spending mix (dining 12%, groceries 15%, gas 7%, Amazon 5%, everything else 61%). Change any number after.</p>
      ${WCATS.map(([k,l])=>fld(k,l)).join("")}
    </div>
    <h3 style="margin:16px 0 6px">Travel</h3>
    <p class="d" style="margin:0 0 8px;color:var(--muted);font-size:13px">Round trips you take in a year, and what one trip costs. Leave at 0 if you rarely travel.</p>
    <div class="cform">
      <label class="field">Round trips a year<input type="number" min="0" step="1" data-wt="trips" value="${W.trip.trips}" placeholder="0"></label>
      <label class="field">Flights per round trip $<input type="number" min="0" data-wt="flight" value="${W.trip.flight}" placeholder="0"></label>
      <label class="field">Hotel nights per trip<input type="number" min="0" data-wt="nights" value="${W.trip.nights}" placeholder="0"></label>
      <label class="field">Hotel $ per night<input type="number" min="0" data-wt="rate" value="${W.trip.rate}" placeholder="0"></label>
      <label class="field wide">Uber, taxis and rides per trip $<input type="number" min="0" data-wt="rides" value="${W.trip.rides}" placeholder="0"></label>
    </div>`;
  const U=W.up;
  const upload=`
    <p class="d" style="margin:0 0 10px;color:var(--muted)">Drop in CSV exports from your bank, credit card, Rocket Money, Mint or similar. The file is read in this browser and never uploaded. Only the category totals are kept. Payments, transfers and deposits are skipped.</p>
    <label class="btn primary" style="display:inline-block;cursor:pointer">Choose CSV file(s)<input type="file" id="wfile" accept=".csv,text/csv" multiple style="display:none"></label>
    ${U?`<div style="margin-top:14px">
      <p style="margin:0 0 6px"><b>${U.used.toLocaleString()}</b> purchases found in ${U.files.length} file${U.files.length>1?"s":""}, ${esc(U.range)} (${U.months.toFixed(1)} months).</p>
      <div class="cform" style="margin:6px 0 10px">
        <label class="field">In my file, spending shows as<select id="wsign"><option value="auto" ${W.sign==="auto"?"selected":""}>Auto-detect (${U.autoSign==="neg"?"negative numbers":"positive numbers"})</option><option value="neg" ${W.sign==="neg"?"selected":""}>Negative numbers</option><option value="pos" ${W.sign==="pos"?"selected":""}>Positive numbers</option></select></label>
        <label class="field">Months the file(s) cover<input type="number" min="0.5" step="0.5" id="wmonths" value="${W.months||U.months.toFixed(1)}"></label>
      </div>
      <div class="kv" style="margin-bottom:10px">${U.rows.map(r=>`<div><span>${esc(r.l)}</span><span class="num">${usd(r.year)} a year · ${usd(r.year/12)} a month</span></div>`).join("")}
        <div><b>Total</b><span class="num"><b>${usd(U.totalYear)} a year · ${usd(U.totalYear/12)} a month</b></span></div></div>
      ${U.top.length?`<p class="d" style="margin:0 0 10px;color:var(--muted);font-size:12.5px">Biggest merchants left in "everything else": ${U.top.map(t=>esc(t[0])+" "+usd(t[1])).join(", ")}</p>`:""}
      <button class="btn primary" id="wuse">Use these numbers</button> <button class="btn" id="wedit">Edit them first</button>
    </div>`:""}
    <p class="d" style="margin:14px 0 0;color:var(--muted);font-size:12.5px">Tip: use a full year if you can. If a file covers only a few months, totals are scaled up to 12 months. Don't upload a card and the bank account that pays it on top of each other: payments are skipped, but a purchase can show in both.</p>`;
  $("wiz").innerHTML=`<div class="wbox"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px"><h2 id="wiztitle" style="margin:0">What do you spend?</h2><button class="btn" id="wclose">Close</button></div>
    <div class="seg" style="grid-template-columns:1fr 1fr;max-width:380px;margin-bottom:14px" role="group" aria-label="How to enter"><button data-wtab="type" aria-pressed="${W.tab==="type"}">Type it in</button><button data-wtab="upload" aria-pressed="${W.tab==="upload"}">Upload transactions</button></div>
    ${W.tab==="type"?type:upload}
    ${W.tab==="type"?`<div class="ctl" style="margin-top:14px"><label><span>Your total</span><output>${usd(T.month)} a month · ${usd(T.year)} a year</output></label><p>Everyday ${usd(T.ev)} a year plus travel ${usd(T.trip)} a year. Saved in this browser only.</p></div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn primary" id="wapply">Use these numbers</button><button class="btn" id="wclose2">Cancel</button></div>`:""}
  </div>`;
}
function applyWizard(){
  for(const [k] of WCATS) S.spend[k]=Math.round(toYear(W.v[k]));
  S.spend.parents=0; S.spend.paypal=0;
  const tr=wnum(W.trip.trips);
  S.trips.visits=tr; S.trips.flights_per_visit=wnum(W.trip.flight); S.trips.hotel_nights=wnum(W.trip.nights); S.trips.hotel_rate=wnum(W.trip.rate); S.trips.uber_per_visit=wnum(W.trip.rides);
  S.scale=1; S.onboarded=true; save();
  if($("scale")){ $("scale").value=100; updateControls(); }
  buildPanelKeepOpen(); closeWizard(); render();
}
/* --- CSV reading --- */
function parseCSV(t){
  const rows=[];let row=[],cur="",q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){ if(ch==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===',') {row.push(cur);cur="";}
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&t[i+1]==="\n") i++; row.push(cur); rows.push(row); row=[]; cur=""; }
    else cur+=ch; }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  return rows.filter(r=>r.some(c=>c.trim()!==""));
}
function parseDate(s){
  s=String(s||"").trim().replace(/ .*$/,"").replace(/T.*$/,"");
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if(m) return new Date(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(m){ let y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[1]-1,+m[2]); }
  const d=new Date(String(s)); return isNaN(d)?null:d;
}
function parseAmt(s){ if(s==null) return NaN; let t=String(s).trim(); if(!t) return NaN; const neg=/^\(.*\)$/.test(t)||/^[-−]/.test(t)||/-\s*\$/.test(t); t=t.replace(/[^0-9.]/g,""); const n=parseFloat(t); return isNaN(n)?NaN:(neg?-n:n); }
const EXC_DESC=/\b(atm|withdrawal|deposited item|cash advance|overdraft|check #|payment|autopay|auto-pay|thank you|payroll|direct dep|deposit|transfer|xfer|zelle|venmo|cash app|apple cash|wire|interest|dividend|statement credit|reversal|round up|savings|brokerage|wealthfront|robinhood|coinbase|mortgage|loan|pmt)\b/i;
const EXC_CAT=/payment|transfer|income|investment|savings|credit card|deposit|paycheck|refund|loan|tax|interest|cash & checks|reimburse/i;
const RX={
 flights:/\b(delta air|american air|southwest|united air|spirit air|frontier|jetblue|alaska air|airlines?|airways|aa\.com|expedia.*flight)\b/i,
 hotels:/\b(hotel|marriott|hilton|hyatt|airbnb|vrbo|motel|resort|holiday inn|hampton inn|courtyard|ihg|best western|sheraton|westin|embassy suites|booking\.com|lodging)\b/i,
 rideshare:/\b(uber(?! ?eats)|lyft|taxi|cab\b)\b/i,
 amazon:/\b(amazon|amzn)\b/i,
 groceries:/\b(kroger|safeway|albertsons|publix|h-?e-?b\b|aldi|trader joe|whole foods|wegmans|food lion|giant|stop & shop|meijer|sprouts|winn-?dixie|tom thumb|central market|fred meyer|ralphs|vons|harris teeter|grocery|supermarket|market basket|shoprite|piggly)\b/i,
 gas:/\b(shell|exxon|mobil|chevron|bp\b|sunoco|valero|marathon|citgo|texaco|speedway|quiktrip|qt \d|racetrac|wawa|sheetz|buc-?ee|7-?eleven|circle k|murphy|casey|pilot|love'?s|conoco|phillips 66|gas station|fuel)\b/i,
 dining:/\b(restaurant|cafe|caf[eé]|coffee|pizza|grill|bbq|sushi|taco|burger|bakery|diner|kitchen|pub\b|bar &|doordash|grubhub|uber ?eats|postmates|starbucks|mcdonald|chipotle|wendy|subway|chick-?fil|panera|dunkin|domino|papa john|kfc|popeyes|five guys|in-?n-?out|whataburger|wingstop|cane'?s|sonic|jack in the box|panda express|olive garden|applebee|chili'?s|ihop|denny|shake shack|taqueria|steakhouse|bistro|tst\*|brewing|donut|ice cream|dairy queen|little caesars|raising cane)\b/i
};
function classify(text,bank){
  if(EXC_DESC.test(text)) return null;
  if(bank&&EXC_CAT.test(bank)) return null;
  for(const k of ["flights","hotels","rideshare","amazon","groceries","gas","dining"]) if(RX[k].test(text)) return k;
  if(bank){ if(/dining|restaurant|food & drink|fast food|coffee/i.test(bank)) return "dining"; if(/grocer|supermarket/i.test(bank)) return "groceries"; if(/\bgas\b|fuel/i.test(bank)) return "gas"; if(/airfare|airline|flight/i.test(bank)) return "flights"; if(/hotel|lodging/i.test(bank)) return "hotels"; if(/rideshare|taxi/i.test(bank)) return "rideshare"; }
  return "other";
}
function tidy(s){ return String(s||"").replace(/\s+/g," ").replace(/\b(PURCHASE|RECURRING PAYMENT|PAYPAL PURCHASE|PAYPAL RETRY PYMT|POS DEBIT|DEBIT CARD PURCHASE)\b(\s+AUTHORIZED ON\s+\d+\/\d+)?(\s+\d{6})?/i,"").replace(/\s+S\d{10,}.*$/,"").replace(/\s+CARD \d{4}$/i,"").replace(/\b\d{2}\/\d{2}\b/g,"").trim(); }
function readTable(rows){
  const H=/^(transaction date|posted date|post date|trans\.? date|date)$/i;
  let hi=-1; for(let i=0;i<Math.min(rows.length,8);i++){ const c=rows[i].map(x=>x.trim().toLowerCase()); if(c.some(x=>H.test(x))&&c.some(x=>/^(amount|debit|credit|description|name|merchant|payee)/.test(x))){hi=i;break;} }
  const out=[];
  if(hi>=0){
    const head=rows[hi].map(x=>x.trim().toLowerCase());
    const find=(...rxs)=>{ for(const r of rxs){ const i=head.findIndex(x=>r.test(x)); if(i>=0) return i; } return -1; };
    const di=find(/^transaction date$/,/^posted date$/,/^post date$/,/^date$/,/date/), ai=find(/^amount$/,/^amount \(/), de=find(/^debit$/), cr=find(/^credit$/);
    const ni=find(/^name$/,/^merchant$/,/^payee$/,/^description$/,/^original description$/,/^memo$/,/^details$/), xi=find(/^description$/,/^original description$/,/^memo$/,/^notes?$/), ci=find(/^category$/), ti=find(/^type$/);
    const dc=(ai<0)&&(de>=0||cr>=0);
    for(const r of rows.slice(hi+1)){
      const d=parseDate(r[di]); if(!d) continue;
      let a; if(dc){ const dv=parseAmt(r[de]), cv=parseAmt(r[cr]); a=(isNaN(dv)?0:-Math.abs(dv))+(isNaN(cv)?0:Math.abs(cv)); } else a=parseAmt(r[ai]);
      if(isNaN(a)||a===0) continue;
      const text=[r[ni],ni!==xi?r[xi]:"",ti>=0&&/payment|transfer/i.test(r[ti]||"")?"payment":""].filter(Boolean).join(" ").replace(/\s+/g," ");
      out.push({d,a,text,label:tidy(text),cat:ci>=0?(r[ci]||""):"",dc});
    }
  } else { // no header, e.g. Wells Fargo: date, amount, *, blank, description
    for(const r of rows){ const d=parseDate(r[0]), a=parseAmt(r[1]); if(!d||isNaN(a)||a===0) continue; const text=(r.slice(2).sort((x,y)=>y.length-x.length)[0]||"").replace(/\s+/g," ").replace(/\b(PURCHASE|RECURRING PAYMENT)\s+AUTHORIZED ON \d+\/\d+\b/i,"").trim(); out.push({d,a,text,label:tidy(text),cat:"",dc:false}); }
  }
  return out;
}
function summarize(){
  const U=W.up; if(!U) return;
  const sign=W.sign==="auto"?U.autoSign:W.sign;
  const tot={dining:0,groceries:0,gas:0,amazon:0,other:0,flights:0,hotels:0,rideshare:0}, cnt={flights:0}, oth={};
  let used=0,min=null,max=null;
  for(const r of U.raw){
    const k=classify(r.text,r.cat); if(!k) continue;
    const sp=sign==="neg"?-r.a:r.a; if(sp<=0) continue;
    tot[k]+=sp; used++; if(k==="flights") cnt.flights++;
    if(k==="other"){ const m=(r.label||r.text).split(" ").slice(0,3).join(" ").toUpperCase().slice(0,26); oth[m]=(oth[m]||0)+sp; }
    if(!min||r.d<min) min=r.d; if(!max||r.d>max) max=r.d;
  }
  const dates=U.raw.map(r=>r.d.getTime()); const lo=new Date(Math.min(...dates)), hi=new Date(Math.max(...dates));
  const months=Math.max(0.5,((hi-lo)/86400000+1)/30.44);
  const mo=wnum(W.months)||months, f=12/mo;
  const labels={dining:"Dining and restaurants",groceries:"Groceries",gas:"Gas",amazon:"Amazon",other:"Everything else",flights:"Flights",hotels:"Hotels",rideshare:"Uber, taxis and rides"};
  U.used=used; U.months=months; U.range=lo.toLocaleDateString()+" to "+hi.toLocaleDateString();
  U.rows=Object.keys(labels).map(k=>({k,l:labels[k],year:tot[k]*f})); U.totalYear=U.rows.reduce((s,r)=>s+r.year,0);
  U.flightCount=cnt.flights*f; U.top=Object.entries(oth).sort((a,b)=>b[1]-a[1]).slice(0,6);
}
async function loadFiles(files){
  const raw=[],names=[]; let dcAll=true;
  for(const f of files){ const t=await f.text(); const rows=readTable(parseCSV(t)); if(!rows.length) continue; names.push(f.name); for(const r of rows){ raw.push(r); if(!r.dc) dcAll=false; } }
  if(!raw.length){ W.up=null; renderWizard(); alert("I couldn't find dates and amounts in that file. It needs a date column and an amount (or debit and credit) column."); return; }
  let neg=0,pos=0; for(const r of raw){ if(!classify(r.text,r.cat)) continue; r.a<0?neg++:pos++; }
  W.up={raw,files:names,autoSign:dcAll||neg>pos?"neg":"pos"}; W.sign="auto"; W.months=""; summarize(); renderWizard();
}
function useUpload(editFirst){
  const U=W.up; if(!U) return;
  const y=Object.fromEntries(U.rows.map(r=>[r.k,r.year]));
  const trips=Math.max(1,Math.round(U.flightCount/2));
  for(const [k] of WCATS) W.v[k]=fromYear(y[k]);
  const hasTravel=(y.flights+y.hotels+y.rideshare)>0;
  if(hasTravel) W.trip={trips,flight:Math.round(y.flights/trips),nights:y.hotels>0?1:0,rate:Math.round(y.hotels/trips),rides:Math.round(y.rideshare/trips)};
  if(editFirst){ W.tab="type"; renderWizard(); } else applyWizard();
}
function wizEvents(){
  const w=$("wiz");
  w.addEventListener("click",e=>{
    const b=e.target.closest("button"); if(!b) return;
    if(b.id==="wclose"||b.id==="wclose2"){ S.onboarded=true; save(); closeWizard(); return; }
    if(b.dataset.wtab){ W.tab=b.dataset.wtab; renderWizard(); return; }
    if(b.dataset.wper){ const old=W.per; for(const [k] of WCATS) W.v[k]=W.v[k]===""?"":Math.round(toYear(W.v[k])/(b.dataset.wper==="month"?12:1)); W.total=W.total===""?"":Math.round(wnum(W.total)*(old==="month"?12:1)/(b.dataset.wper==="month"?12:1)); W.per=b.dataset.wper; renderWizard(); return; }
    if(b.id==="wsplit"){ const t=wnum($("wtotal").value); if(t>0){ W.total=t; for(const [k] of WCATS) W.v[k]=Math.round(t*TYPICAL[k]); renderWizard(); } return; }
    if(b.id==="wapply"){ applyWizard(); return; }
    if(b.id==="wuse"){ useUpload(false); return; }
    if(b.id==="wedit"){ useUpload(true); return; }
  });
  w.addEventListener("input",e=>{ const t=e.target;
    if(t.dataset.wv){ W.v[t.dataset.wv]=t.value; const T=wizTotals(); const o=w.querySelector(".ctl output"); if(o) o.textContent=usd(T.month)+" a month · "+usd(T.year)+" a year"; }
    else if(t.dataset.wt){ W.trip[t.dataset.wt]=t.value; const T=wizTotals(); const o=w.querySelector(".ctl output"); if(o) o.textContent=usd(T.month)+" a month · "+usd(T.year)+" a year"; }
    else if(t.id==="wtotal") W.total=t.value;
    else if(t.id==="wmonths"){ W.months=t.value; summarize(); renderWizardKeepFocus("wmonths"); }
  });
  w.addEventListener("change",e=>{ const t=e.target;
    if(t.id==="wfile") loadFiles([...t.files]);
    else if(t.id==="wsign"){ W.sign=t.value; summarize(); renderWizard(); }
  });
  w.addEventListener("click",e=>{ if(e.target===w){ S.onboarded=true; save(); closeWizard(); } });
}
function renderWizardKeepFocus(id){ const el=$(id), v=el&&el.value, pos=el&&el.selectionStart; renderWizard(); const n=$(id); if(n){ n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){} } }

/* ---------- controls strip ---------- */
function buildControls(){
  $("controls").innerHTML=`
   <div class="ctl"><label for="scale"><span>Everyday spending from now on</span><output id="scale-o"></output></label>
     <input type="range" id="scale" min="10" max="130" step="5" value="${Math.round(S.scale*100)}">
     <p>Compared with your last 12 months. Trips are set separately. Bonuses you couldn't reach at this pace count as $0.</p></div>
   <div class="ctl"><label for="feemax"><span>Annual fees I'll pay</span><output id="feemax-o"></output></label>
     <input type="range" id="feemax" min="0" max="1000" step="25" value="${S.feeMax}">
     <div class="quick">${[0,100,250,500,1000].map(v=>`<button class="chip" data-fee="${v}">${v===0?"$0":v>=1000?"No limit":"$"+v}</button>`).join("")}</div></div>`;
  updateControls();
}
function updateControls(){
  const base=S.spend.dining+S.spend.groceries+S.spend.gas+S.spend.amazon+S.spend.other+(S.spend.parents||0);
  $("scale-o").textContent=Math.round(S.scale*100)+"% · about "+usd(base*S.scale/12)+" a month";
  const hid=allCards().filter(c=>S.feeMax<1000&&c.fee>S.feeMax).length;
  $("feemax-o").textContent=S.feeMax>=1000?"No limit":"Up to "+usd(S.feeMax)+" a year"+(hid?" · hiding "+hid+" pricier cards":"");
  document.querySelectorAll("[data-fee]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.fee===S.feeMax)));
}
/* ---------- events ---------- */
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="scale"){ S.scale=t.value/100; updateControls(); }
  else if(t.id==="feemax"){ S.feeMax=+t.value; updateControls(); }
  else if(t.id && t.id.startsWith("pv-")){ S.pv[t.id.slice(3)]=+t.value; $(t.id+"-o").textContent=(+t.value).toFixed(2)+"¢"; }
  else if(t.id && t.id.startsWith("use-")){ S.use[t.id.slice(4)]=+t.value; $(t.id+"-o").textContent=t.value+"%"; }
  else if(t.id==="chain"){ S.chain_share=t.value/100; $("chain-o").textContent=t.value+"%"; }
  else if(t.dataset.path){ const ps=t.dataset.path.split("."); const last=ps.pop(); ps.reduce((o,k)=>o[k],S)[last]=parseFloat(t.value)||0; }
  else if(t.dataset.extra){ S.extra[t.dataset.extra]=parseFloat(t.value)||0; }
  else return;
  save(); render();
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.id==="portal"){ S.portal=t.checked; }
  else if(t.id==="prime"){ S.has_prime=t.checked; }
  else if(t.id==="pair"){ S.pair_freedom=t.checked; }
  else if(t.id==="sort"){ S.sort=t.value; }
  else if(t.dataset.perk){ S.off[t.dataset.perk]=!t.checked; }
  else return;
  save(); render();
});
document.addEventListener("click",e=>{
  const th=e.target.closest("th[data-sort]");
  if(th){ const k=th.dataset.sort; S.tsort = S.tsort.k===k ? {k,dir:-S.tsort.dir} : {k,dir:(k==="name"?1:-1)}; save(); render(); return; }
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.fee!==undefined){ S.feeMax=+b.dataset.fee; $("feemax").value=S.feeMax; updateControls(); save(); render(); return; }
  if(b.dataset.f){ S.f[b.dataset.f]=!S.f[b.dataset.f]; save(); render(); return; }
  if(b.dataset.view){ S.view=b.dataset.view; save(); render(); return; }
  if(b.dataset.basis){ const bs=M.bases&&M.bases[b.dataset.basis]; if(bs){ S.basis=b.dataset.basis; for(const k of ["dining","groceries","gas","amazon","other"]) S.spend[k]=bs[k]; save(); buildPanelKeepOpen(); render(); } return; }
  if(b.dataset.open){ S.view="cards"; OPEN.add(b.dataset.open); save(); render(); const el=[...document.querySelectorAll("article.card")].find(x=>x.dataset.name===b.dataset.open); if(el) el.scrollIntoView({block:"start"}); return; }
  if(b.id==="csv"){ csvDownload(); return; }
  if(b.dataset.rmc!==undefined){ S.custom.splice(+b.dataset.rmc,1); save(); buildPanelKeepOpen(); render(); return; }
  if(b.id==="ccadd"){
    const g=id=>parseFloat($(id).value)||0, name=($("cc-name").value||"").trim()||"My card";
    const x=(id)=>g(id);
    S.custom.push({name,fee:g("cc-fee"),fee_note:"",own_cpp:g("cc-cpp"),currency:"cash",status:"custom",checked:"issuer",perks:"Added by you",points_to:"",best_if:"",
      earn:{dining:x("cc-d"),groceries:x("cc-g"),gas:x("cc-ga"),other:x("cc-o"),flights:x("cc-fl"),aa:x("cc-fl"),other_airline:x("cc-fl"),hotels:x("cc-h"),rideshare:x("cc-r"),amazon:x("cc-am")},
      perks_list:g("cc-cr")?[{label:"Credits",amount:g("cc-cr"),type:"custom",note:""}]:[],bonus_cash:g("cc-b"),bonus_note:g("cc-b")?"Sign-up bonus you entered":"",
      avail:{tier:"open",note:"A card you added."}});
    save(); buildPanelKeepOpen(); render(); return; }
  if(b.id==="spendbtn"){ openWizard(); return; }
  if(b.id==="panelbtn"){ document.body.classList.toggle("panel-open"); return; }
  if(b.id==="panelx"){ document.body.classList.remove("panel-open"); return; }
  if(b.dataset.mode){ S.mode=b.dataset.mode; save(); buildPanelKeepOpen(); render(); return; }
  if(b.dataset.act){
    const name=b.closest(".card").dataset.name;
    if(b.dataset.act==="open"){ OPEN.has(name)?OPEN.delete(name):OPEN.add(name); }
    if(b.dataset.act==="pin"){ const i=S.pins.indexOf(name); if(i>=0) S.pins.splice(i,1); else if(S.pins.length<4) S.pins.push(name); save(); }
    render(); return;
  }
  if(b.id==="cmpgo") openCompare();
  if(b.id==="cmpclear"){ S.pins=[]; save(); render(); }
  if(b.id==="cmpx"){ $("cmp").hidden=true; }
  if(b.id==="reset"){ if(confirm("Reset all your values to the defaults?")){ S=DEF(); save(); buildPanel(); render(); } }
  if(b.id==="theme"){ const r=document.documentElement; const dark=(r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches); r.dataset.theme=dark?"light":"dark"; try{localStorage.setItem("cardvalue.theme",r.dataset.theme)}catch(e){} }
});
$("cmp").addEventListener("click",e=>{ if(e.target===$("cmp")) $("cmp").hidden=true; });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ if(!$("wiz").hidden){ S.onboarded=true; save(); closeWizard(); } $("cmp").hidden=true; document.body.classList.remove("panel-open"); } });
function buildPanelKeepOpen(){
  const open=[...document.querySelectorAll("#panel details")].map(d=>d.open);
  buildPanel();
  document.querySelectorAll("#panel details").forEach((d,i)=>d.open=open[i]);
}
try{ const th=localStorage.getItem("cardvalue.theme"); if(th) document.documentElement.dataset.theme=th; }catch(e){}
if(SHARE){ $("subline").textContent="Compare "+D.cards.length+" credit cards on what they are worth to you. Set what a point, a credit and a perk is worth, how much you spend and the fees you will pay. Everything runs in your browser and nothing is sent anywhere."; }
buildControls(); buildPanel(); render(); wizEvents();
if(SHARE && !S.onboarded) openWizard();
