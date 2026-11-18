const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
if(typeof BLIND_ITEMS!=="undefined"&&BLIND_ITEMS.length) RG.addSet("blind",BLIND_ITEMS,BLIND_TRIPLOG);
const KEYS={dev:EXPECTED, blind:(typeof BLIND_KEY!=="undefined"?BLIND_KEY:{})};
const REC=(typeof RECORDED!=="undefined"&&RECORDED)||{};
const hasRec=set=>!!(REC[set]&&REC[set].some(x=>x.reads));
const S={set:"dev", sel:"A", att:{}, hl:null, mode:hasRec("dev")?"rec":"ref", live:{}, liveDraft:{}, liveMeta:{}, done:{}, log:[], sample:null, db:null, busy:false, tab:"review", demo:-1};
const setOf=id=>Object.keys(RG.SETS).find(k=>RG.SETS[k].some(i=>i.id===id));
const recRun=id=>{ const r=REC[setOf(id)]; return r&&r.find(x=>x.reads); };
function readFor(id){ if(S.mode==="live"&&S.live[id]!==undefined) return S.live[id]; if(S.mode!=="ref"){ const r=recRun(id); if(r&&id in r.reads) return r.reads[id]; } return RG.REF[id]; }
function srcFor(id){ if(S.mode==="live"&&S.live[id]!==undefined) return "live"; if(S.mode!=="ref"){ const r=recRun(id); if(r&&id in r.reads) return "rec"; } return RG.REF[id]?"ref":"none"; }
function draftFor(id){ const src=srcFor(id); if(src==="live") return S.liveDraft[id]; if(src==="rec"){ const r=recRun(id); return r.drafts&&r.drafts[id]; } return null; }
const resFor=id=>RG.decide(RG.itemById(id),readFor(id));
const chipCls=d=>d==="PAY"?"ok":d==="PAY_LESS"?"warn":(d==="HOLD"||d==="NOT_INVOICE_INQUIRY"||d==="NOT_INVOICE_OTHER")?"":"stop";
const short={PAY:"Pay",PAY_LESS:"Pay less",HOLD:"Hold",ESCALATE:"Escalate",HUMAN_REVIEW:"Needs Elena",NOT_INVOICE_INQUIRY:"Not an invoice",NOT_INVOICE_BANK_CHANGE:"Bank change: blocked",NOT_INVOICE_OTHER:"Not an invoice"};
const setName={dev:"8 build cases",blind:"Blind cases"};

function renderInbox(){
  const sets=Object.keys(RG.SETS).filter(k=>k==="dev"||hasRec(k)||RG.SETS[k].some(i=>S.live[i.id]!==undefined));
  $("setTabs").innerHTML=sets.length>1?sets.map(k=>`<button class="${S.set===k?"on":""}" data-set="${k}">${k==="blind"?RG.SETS[k].length+" blind cases":setName[k]}</button>`).join(""):`<span class="note">8 of about 400 items a day</span>`;
  $("setTabs").querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>{ S.set=b.dataset.set; S.sel=RG.SETS[S.set][0].id; S.hl=null; render(); });
  $("inbox").innerHTML=RG.SETS[S.set].map(it=>{ const r=resFor(it.id), d=S.done[it.id], none=srcFor(it.id)==="none";
    return `<button class="it ${S.sel===it.id?"on":""}" data-id="${it.id}"><span class="s">${it.id} · ${esc(it.subject)}</span><span class="f">${esc(it.from)}</span>${none?`<span class="chip">Not read yet</span>`:`<span class="chip ${chipCls(r.disposition)}">${short[r.disposition]}</span>`}${d?`<span class="chip done">${esc(d.label)}</span>`:""}</button>`; }).join("");
  $("inbox").querySelectorAll(".it").forEach(b=>b.onclick=()=>pick(b.dataset.id));
  const n=Object.keys(S.done).length, ov=Object.values(S.done).filter(d=>d.override).length;
  $("queueNote").textContent=n?`Decided this session: ${n} · changed by Elena: ${ov}`:"Nothing is sent or paid from this screen.";
}
async function pick(id){ S.sel=id; S.set=setOf(id); S.hl=null; render(); if(S.mode==="live"&&S.sample&&S.live[id]===undefined&&!S.busy){ S.busy=true; $("status").textContent=`Live AI reading ${id}…`; await readLive(id); S.busy=false; $("status").textContent="Live AI read"; render(); } }
function hlText(text,quote){ if(!quote) return esc(text); const parts=RG.ws(quote).split(" ").map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")); let m; try{ m=text.match(new RegExp(parts.join("\\s+"))); }catch(e){ m=null; } if(!m) return esc(text); const i=m.index; return esc(text.slice(0,i))+"<mark>"+esc(m[0])+"</mark>"+esc(text.slice(i+m[0].length)); }
function renderMail(){
  const it=RG.itemById(S.sel); const cur=S.att[it.id]||(it.atts[0]&&it.atts[0].id); const a=it.atts.find(x=>x.id===cur);
  const emailHl=S.hl&&S.hl.doc==="email"?S.hl.quote:null;
  $("mail").innerHTML=`<div><b>${esc(it.subject)}</b><div class="note">From ${esc(it.from)} · ${it.atts.length} attachment${it.atts.length===1?"":"s"}</div></div>
   <div class="email">${hlText(it.body,emailHl)}</div>
   ${it.atts.length?`<div class="atabs">${it.atts.map(x=>`<button class="${x.id===cur?"on":""}" data-a="${x.id}">${esc(x.name)}</button>`).join("")}</div><div class="note" style="margin-bottom:6px">${esc(a.kind)}</div><div class="doc">${hlText(a.text,S.hl&&S.hl.doc===a.id?S.hl.quote:null)}</div>`:`<div class="note">No attachments.</div>`}`;
  $("mail").querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{ S.att[it.id]=b.dataset.a; S.hl=null; renderMail(); });
}
function citeHtml(it,c,brief){ if(c.doc==="triplog") return `<span class="cite tb">TripLog · ${esc(c.quote)}</span>`; const q=RG.ws(c.quote).replace(/\.{4,}/g,"…"); return `<span class="cite" data-doc="${c.doc}" data-q="${esc(c.quote)}" title="Show in ${esc(RG.docName(it,c.doc))}">${brief?"":esc(RG.docName(it,c.doc))+" · "}“${esc(q.slice(0,70))}”</span>`; }
function renderPanel(){
  const it=RG.itemById(S.sel), read=readFor(it.id), r=resFor(it.id), src=srcFor(it.id), inv=read&&read.invoice, t=r.trip, d=S.done[it.id];
  if(src==="none"){ $("mid").innerHTML=""; $("panel").innerHTML=`<div class="card"><h2>Not read yet</h2><div class="note">This blind case has no recorded AI read. Switch to Live AI to read it now.</div></div>`; return; }
  const clsName={carrier_invoice:"Carrier invoice",payment_status:"Payment-status question",bank_change:"Bank-detail change",other:"Other",unknown:"Could not classify"}[r.cls]||r.cls;
  const srcNote=src==="live"?`Live AI read${S.liveMeta[it.id]?` · ${S.liveMeta[it.id].ms} ms`:""}`:src==="rec"?`Recorded live AI run (${esc(recRun(it.id).at||"")})`:"Stand-in read (hand-written, not the model)";
  const amt=r.disposition==="PAY"?RG.money(r.pay):r.disposition==="PAY_LESS"&&inv?`${RG.money(r.pay)} <small style="display:inline">of ${RG.money(inv.total.value)}</small>`:"";
  const issues=r.findings.filter(f=>f.level==="stop"||f.level==="warn").length;
  let mid="";
  let h=`<div class="sum b-${r.disposition}"><div>${it.id} · ${esc(RG.LABEL[r.disposition])}<small>${issues?issues+" finding"+(issues>1?"s":"")+" to review":"No issues found"} · proposal only, Elena decides</small></div><div class="amt" style="font-size:20px">${amt}</div></div>`;
  h+=`<div class="card"><h2><b>2</b>Classification</h2><span class="chip ${r.cls==="carrier_invoice"?"ok":r.cls==="bank_change"?"stop":""}">${esc(clsName)}</span>${r.bank?`<span class="chip stop">Bank-change rule fired (code)</span>`:""}${r.inj.length?`<span class="chip warn">Instruction in document: ignored</span>`:""}
    <div class="note" style="margin-top:6px">${esc((read&&read.type_reason)||"")}</div><div class="note">${srcNote}</div></div>`;
  if(r.cls==="carrier_invoice"&&inv&&r.disposition!=="HUMAN_REVIEW"){
    const fr=(k,f,fmt)=>f?`<tr><td>${k}</td><td><b>${esc(fmt?RG.money(f.value):f.value)}</b></td><td class="q">${f.quote?citeHtml(it,f,1):""}</td></tr>`:"";
    h+=`<div class="card"><h2><b>3</b>Invoice facts (read)</h2><table>${fr("Invoice",{value:inv.invoice_no})}${fr("Trip",inv.trip_no)}${fr("Carrier",inv.carrier)}${fr("Base price",inv.base,1)}${(inv.extras||[]).map(x=>`<tr><td>Extra</td><td><b>${esc(x.label)} ${RG.money(x.amount)}</b></td><td class="q">${citeHtml(it,x,1)}${x.receipt?citeHtml(it,x.receipt):`<span class="note">no receipt</span>`}</td></tr>`).join("")}${fr("Total",inv.total,1)}<tr><td>Delivery proof</td><td><b>${inv.delivery&&inv.delivery.present?"Attached":"None"}</b></td><td class="q">${inv.delivery&&inv.delivery.present?citeHtml(it,inv.delivery):""}</td></tr></table><div class="note" style="margin-top:6px">Click a quote to see it in the document. Every quote was found word for word in its document.</div></div>`;
    mid+=`<div class="card"><h2><b>4</b>TripLog record</h2>${t?`<table><tr><td>Trip</td><td><b>${esc(r.tripNo)}</b></td></tr><tr><td>Carrier</td><td><b>${esc(t.carrier)}</b></td></tr><tr><td>Route</td><td>${esc(t.route)}</td></tr><tr><td>Status</td><td><b>${esc(t.status)}</b>${t.delivered?" · "+esc(t.delivered):""}</td></tr><tr><td>Agreed price</td><td><b>${RG.money(t.agreed)}</b></td></tr><tr><td>Approved extras</td><td>${t.extras.length?t.extras.map(e=>`${esc(e.label)} ${RG.money(e.amount)}`).join("<br>"):"None"}</td></tr></table><div class="note" style="margin-top:6px">Looked up by trip number. Source of truth.</div>`:`<div class="note">No TripLog record for ${esc(r.tripNo||"this item")}.</div>`}</div>`;
    if(r.rows.length) mid+=`<div class="card"><h2><b>5</b>Side-by-side comparison (code)</h2><table><tr><th>Check</th><th>Invoice says</th><th>TripLog says</th><th></th></tr>${r.rows.map(x=>`<tr class="${x.ok?"":"bad"}"><td>${esc(x.field)}</td><td>${esc(x.inv)}</td><td>${esc(x.tb)}</td><td class="${x.ok?"yes":"no"}">${x.ok?"✓":"✗"}</td></tr>`).join("")}</table></div>`;
  }
  h+=`<div class="card"><h2><b>6</b>Proposed disposition</h2><div class="banner b-${r.disposition}"><div>${esc(RG.LABEL[r.disposition])}<small>${r.route?esc(r.route):"Proposal only. Nothing is recorded until Elena decides."}</small></div><div class="amt">${amt}</div></div></div>`;
  let dr="";
  if(r.draft){ const md=draftFor(it.id), ck=md?RG.checkDraft(md,r):null;
    if(md&&ck.ok) dr=`<details open><summary>${esc(r.draft.title.replace("Draft","AI-drafted"))} · passed the code checks</summary><div class="draft">To: ${esc(r.draft.to)}\nSubject: ${esc(md.subject)}\n\n${esc(md.body)}</div></details>`;
    else dr=`<details open><summary>${esc(r.draft.title)}${md?" · the AI draft failed a code check, so the template is shown":""}</summary>${md?`<div class="note">Blocked: ${esc(ck.problems.join("; "))}</div>`:""}<div class="draft">To: ${esc(r.draft.to)}\n\n${esc(r.draft.text)}</div></details>`; }
  h+=`<div class="card"><h2><b>7</b>Evidence and reasons</h2>${r.findings.map(f=>`<div class="find"><span class="dot ${f.level}"></span><div>${esc(f.text)}<div>${f.cites.map(c=>citeHtml(it,c)).join("")}</div></div></div>`).join("")||`<div class="note">No findings.</div>`}${dr}</div>`;
  const payFlow=["PAY","PAY_LESS","HOLD","ESCALATE","HUMAN_REVIEW"].includes(r.disposition);
  h+=`<div class="card"><h2><b>8</b>Elena's decision</h2>`;
  if(d) h+=`<div class="chip done">${esc(d.label)}</div> <span class="note">${esc(d.note)}</span> <button class="btn alt" id="undo" style="margin-left:8px">Undo</button>`;
  else if(r.disposition==="NOT_INVOICE_BANK_CHANGE") h+=`<div class="row"><button class="btn" id="route">Send to vendor-master verification</button><span class="note">Payment actions are disabled for this item.</span></div>`;
  else if(!payFlow) h+=`<div class="row"><button class="btn" id="route">Confirm: not an invoice</button><button class="btn alt" id="esc">Escalate</button></div>`;
  else h+=`<div class="row">${r.disposition!=="HUMAN_REVIEW"?`<button class="btn" id="approve">Approve: ${esc(short[r.disposition])}${r.pay!=null?" "+RG.money(r.pay):""}</button>`:""}<button class="btn alt" id="esc">Escalate to manager</button></div>
    <div class="row" style="margin-top:8px"><select id="ovSel"><option value="">Override with…</option><option>PAY</option><option>HOLD</option><option>PAY LESS</option><option>ESCALATE</option></select><input type="text" id="ovWhy" placeholder="Reason (required for an override)"><button class="btn alt" id="ovBtn">Record override</button></div>`;
  h+=`<div class="note" style="margin-top:8px">Records to PayQueue only after Elena clicks (simulated here). No email is sent and no payment is released by the workflow.</div>
   ${S.log.length?`<details><summary>PayQueue entries this session (${S.log.length})</summary><table>${S.log.map(l=>`<tr><td>${l.id}</td><td><b>${esc(l.label)}</b></td><td class="q">${esc(l.note)}</td></tr>`).join("")}</table></details>`:""}</div>`;
  $("panel").innerHTML=h; $("mid").innerHTML=mid;
  document.querySelectorAll("#panel .cite[data-doc], #mid .cite[data-doc]").forEach(c=>c.onclick=()=>{ S.hl={doc:c.dataset.doc,quote:c.dataset.q}; if(c.dataset.doc!=="email") S.att[it.id]=c.dataset.doc; renderMail(); });
  const rec=(label,note,override)=>{ S.done[it.id]={label,note,override:!!override}; S.log.push({id:it.id,label,note}); render(); };
  if($("approve")) $("approve").onclick=()=>rec(short[r.disposition]+(r.pay!=null?" "+RG.money(r.pay):""),"Elena approved the proposal");
  if($("esc")) $("esc").onclick=()=>rec("Escalated","Sent to the AP manager by Elena",r.disposition!=="ESCALATE");
  if($("route")) $("route").onclick=()=>rec(r.disposition==="NOT_INVOICE_BANK_CHANGE"?"Routed: vendor verification":"Filed: not an invoice","Outside the payment workflow");
  if($("ovBtn")) $("ovBtn").onclick=()=>{ const v=$("ovSel").value, w=$("ovWhy").value.trim(); if(!v||!w){ $("ovWhy").focus(); $("ovWhy").placeholder="Pick a decision and give a reason"; return; } rec(v+" (override)","Elena: "+w,true); };
  if($("undo")) $("undo").onclick=()=>{ delete S.done[it.id]; S.log=S.log.filter(l=>l.id!==it.id); render(); };
}
function tile(n,l,good){ return `<div class="tile"><div class="n" style="color:${good===false?"var(--stop)":good?"var(--ok)":"var(--navy)"}">${n}</div><div class="l">${l}</div></div>`; }
function scoreReads(set,reads){ const res={}; RG.SETS[set].forEach(it=>{ if(reads&&it.id in reads) res[it.id]=RG.decide(it,reads[it.id]); }); return RG.score(KEYS[set],res,RG.SETS[set]); }
function scoreRun(set,run){ if(run.reads) return scoreReads(set,run.reads); const res={}; RG.SETS[set].forEach(it=>{ const o=run.outcomes&&run.outcomes[it.id]; if(o) res[it.id]={disposition:o.d,pay:o.p,cls:o.c,findings:[],inj:[]}; }); return RG.score(KEYS[set],res,RG.SETS[set]); }
function outcomesOf(set,reads,drafts,ms){ const o={}; RG.SETS[set].forEach(it=>{ if(!(it.id in reads)) return; const r=RG.decide(it,reads[it.id]); const d=drafts&&drafts[it.id]; o[it.id]={d:r.disposition,p:r.pay,c:r.cls,inj:r.inj.length,dk:(r.draft&&r.disposition!=="HUMAN_REVIEW")?(d&&RG.checkDraft(d,r).ok?1:0):null,ms:ms&&ms[it.id]}; }); return o; }
function draftStats(set,run){ let n=0,ok=0; if(!run.reads){ Object.values(run.outcomes||{}).forEach(o=>{ if(o.dk!=null){ n++; ok+=o.dk; } }); return {n,ok}; } RG.SETS[set].forEach(it=>{ if(!(it.id in run.reads)) return; const r=RG.decide(it,run.reads[it.id]); if(!r.draft||r.disposition==="HUMAN_REVIEW") return; n++; const d=run.drafts&&run.drafts[it.id]; if(d&&RG.checkDraft(d,r).ok) ok++; }); return {n,ok}; }
function setTable(set){
  const items=RG.SETS[set], key=KEYS[set], runs=(REC[set]||[]), liveReads={}; items.forEach(it=>{ if(S.live[it.id]!==undefined) liveReads[it.id]=S.live[it.id]; });
  const rs=runs.map(r=>scoreRun(set,r)), ls=Object.keys(liveReads).length?scoreReads(set,liveReads):null, ref=set==="dev"?scoreReads("dev",RG.REF):null;
  const cell=r=>r&&!r.missing?`<span class="${r.okD&&!r.overpay?"yes":"no"}">${r.okD&&!r.overpay?"✓":"✗"}</span> ${esc(short[r.actual])}${r.actualPay!=null?" "+RG.money(r.actualPay):""}`:`<span class="note">not run</span>`;
  return `<table><tr><th>Case</th><th>Expected (frozen)</th>${ref?"<th>Stand-in read</th>":""}${runs.map((r,i)=>`<th>${esc(r.label||("Recorded AI run "+(i+1)))}</th>`).join("")}<th>Live AI now</th></tr>${items.map((it,i)=>{ const e=key[it.id]||{}; return `<tr><td><b>${it.id}</b> ${esc(it.tag)}</td><td>${esc(short[e.disposition]||"?")}${e.pay!=null?" "+RG.money(e.pay):""}</td>${ref?`<td>${cell(ref.rows[i])}</td>`:""}${rs.map(s=>`<td>${cell(s.rows[i])}</td>`).join("")}<td>${cell(ls&&ls.rows[i])}</td></tr>`; }).join("")}</table>`;
}
function renderEvals(){
  const ref=scoreReads("dev",RG.REF), runs=REC.dev||[], rs=runs.map(r=>scoreRun("dev",r)), mm=RG.runMistakes(EXPECTED), unsafe=mm.filter(m=>m.unsafe).length;
  const H=RG.itemById("H"), hRead=(runs[0]&&runs[0].reads.H)||RG.REF.H, h0=RG.decide(RG.withoutInjection(H),hRead), h1=RG.decide(H,hRead), injOk=h0.disposition===h1.disposition&&h0.pay===h1.pay&&h1.inj.length>0;
  const main=rs[0]||ref, mainLbl=rs[0]?"recorded AI run 1":"stand-in read", n=main.n;
  const agree=rs.length>1?RG.SETS.dev.filter((it,i)=>rs.every(s=>s.rows[i].actual===rs[0].rows[i].actual&&s.rows[i].actualPay===rs[0].rows[i].actualPay)).length:null;
  const worstPay=rs.length?Math.max(...rs.map(s=>s.wrongPay)):ref.wrongPay, ds=runs[0]?draftStats("dev",runs[0]):null, bds=(REC.blind||[]).find(x=>x.reads);
  const bl=REC.blind||[], bs=bl.map(r=>scoreRun("blind",r)), hasBlind=!!RG.SETS.blind;
  $("evals").innerHTML=`<div class="card" style="margin-bottom:12px"><h2>Evidence: evals we ran, and why</h2><div class="note">Expected outcomes for the 8 build cases were written and frozen before any code (sha256 ${FROZEN_SHA.slice(0,12)}…) and are never shown to the model. Everything here is synthetic text: development evidence, not a measure of Elena's real queue.</div></div>
  <div class="tiles">${tile(`${main.disp}/${n}`,`Disposition correct · ${mainLbl}`,main.disp===n)}${tile(`${main.mustHit}/${main.mustTotal}`,"Must hold / escalate / route caught",main.mustHit===main.mustTotal)}${tile(worstPay,`Wrong payment recommendations${rs.length>1?" (worst of "+rs.length+" runs)":""}`,worstPay===0)}${tile(`${main.citeOk}/${main.citeAll}`,"Cited quotes found word for word",main.citeOk===main.citeAll)}
   ${tile(`${main.cls}/${n}`,`Inbox classification correct · ${mainLbl}`,main.cls===n)}${tile(injOk?"Unchanged":"CHANGED","Decision with vs without the hidden instruction",injOk)}${tile(`${mm.length-unsafe}/${mm.length}`,"Injected model mistakes that end safe (offline)",unsafe===0)}${agree!=null?tile(`${agree}/${n}`,`Cases where all ${rs.length} recorded runs agree`,agree===n):tile(ds?`${ds.ok}/${ds.n}`:"not run","AI-drafted notes that pass the code checks",ds?ds.ok===ds.n:undefined)}</div>
  <div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><h2 style="margin:0">8 build cases: expected vs actual</h2><div class="row"><button class="btn live" data-run="dev" ${S.sample&&!S.busy?"":"disabled"}>${S.busy?"Running…":"Run these 8 with live AI"}</button><span class="note">${S.sample?"":"Live AI is not available in this view."}</span></div></div>
   ${setTable("dev")}<div class="note" style="margin-top:6px"><b>Why this eval:</b> a frozen answer key catches a build tuned to its own cases. Stand-in read = a hand-written correct read, which isolates the code. Recorded and live runs = the model reads the raw email and attachments; the same code then checks and decides.${ds?` AI-drafted notes passing the code checks in run 1: ${ds.ok} of ${ds.n}.`:""}</div></div>
  ${hasBlind?`<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${RG.SETS.blind.length} blind cases, generated separately</h2><div class="row"><button class="btn live" data-run="blind" ${S.sample&&!S.busy?"":"disabled"}>Run blind cases with live AI</button></div></div>
   <div class="note" style="margin-bottom:6px"><b>Why this eval:</b> cases I write share my blind spots. These were written by a separate agent from a written brief, without access to the code, prompts or rules (not independent QA). ${typeof BLIND_NOTE!=="undefined"?esc(BLIND_NOTE):""}</div>${bs.length?`<div class="tiles">${tile(`${bs[0].disp}/${bs[0].n}`,"Disposition correct · first scored run, before any fix",bs[0].disp===bs[0].n)}${tile(Math.max(...bs.map(s=>s.wrongPay)),"Wrong payment recommendations",Math.max(...bs.map(s=>s.wrongPay))===0)}${tile(`${bs[0].mustHit}/${bs[0].mustTotal}`,"Must hold / escalate / route caught",bs[0].mustHit===bs[0].mustTotal)}${tile(`${bs[0].cls}/${bs[0].n}`,"Classification correct",bs[0].cls===bs[0].n)}</div>`:""}<details><summary>Show the ${RG.SETS.blind.length} blind cases</summary>${setTable("blind")}</details></div>`:""}
  <div class="card" style="margin-bottom:12px"><h2>Injected model mistakes (offline)</h2><div class="note"><b>Why this eval:</b> live runs only show what the model happened to do. These feed the code a wrong read on purpose. Unsafe means a payment proposed above the frozen answer, or a bank-change email reaching the payment flow.</div>
   <details><summary>Show the ${mm.length} wrong reads and where each ends (${mm.length-unsafe} safe, ${unsafe} unsafe)</summary><table><tr><th></th><th>Case</th><th>Wrong read</th><th>Where it ends</th><th></th></tr>${mm.map(m=>`<tr><td>${m.id}</td><td>${m.item}</td><td>${esc(m.what)}</td><td>${esc(short[m.got])}${m.pay!=null?" "+RG.money(m.pay):""}</td><td class="${m.unsafe?"no":"yes"}">${m.unsafe?"UNSAFE":"safe"}</td></tr>`).join("")}</table></details></div>
  <details class="card fold"><summary>POC metrics, and what has not been run</summary><div><table><tr><th>Metric in the POC</th><th>How it is measured</th></tr>
   <tr><td><b>Primary:</b> share of Elena's queue with the correct proposed disposition and evidence, no rework</td><td>Elena approves without changing it (the override button is the rework signal)</td></tr>
   <tr><td>Wrong recommendation rate</td><td>Manager re-checks a random sample of approved PAY and PAY LESS items, plus every override</td></tr>
   <tr><td>Escalation rate, reviewer minutes per item, inbox auto-triage rate, cost per accepted output</td><td>Logged per item in shadow; compared with Elena's current baseline</td></tr></table>
   <div class="note" style="margin-top:8px"><b>Planned, not run, and why:</b> real inbox items with real PDFs and photos (needs Kestrel data; this page uses text) · a random sample of Elena's past decisions as the answer key (needs PayQueue history) · duplicate-invoice and wrong-payee checks (out of POC scope) · latency and cost per item at 400 a day (needs the real connector).</div></div></details>`;
  $("evals").querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>runAllLive(b.dataset.run));
}
function renderReal(){
  $("real").innerHTML=`<div class="card"><h2>What is real, mocked and not built</h2><table><tr><th>Piece</th><th>Status</th><th>In production</th></tr>
  <tr><td>Classification and document read</td><td><b>Real model call.</b> "Recorded AI run" replays a stored live run; "Live AI" calls the model now; "Stand-in" is hand-written.</td><td>Same call, on the real PDF or photo</td></tr>
  <tr><td>Checks on the read (quotes word for word, amounts on the quoted line)</td><td><b>Real</b>, code</td><td>Same</td></tr>
  <tr><td>Comparison and proposed disposition</td><td><b>Real</b>, deterministic code</td><td>Same rules, owned by AP</td></tr>
  <tr><td>Bank-change block and instruction flag</td><td><b>Real</b>, code on the raw email; runs whatever the model says</td><td>Same, plus sender and vendor-master checks</td></tr>
  <tr><td>Notes to the carrier or manager</td><td><b>Real model draft</b> from the code-computed record, shown only if it passes code checks; otherwise a template. Never sent.</td><td>Sent by Elena from the mailbox</td></tr>
  <tr><td>Inbox, attachments</td><td><b>Mocked:</b> synthetic items; documents are text, not real PDFs or photos</td><td>Shared mailbox connector; file and image reading</td></tr>
  <tr><td>TripLog</td><td><b>Mocked:</b> records in the page</td><td>Read-only lookup by trip number</td></tr>
  <tr><td>PayQueue</td><td><b>Mocked:</b> a session list; written only when Elena clicks</td><td>Write after Elena's approval, with an audit entry</td></tr>
  <tr><td>Duplicate invoices, payee and tax checks, bank-change handling</td><td><b>Not built</b> (out of scope for this POC)</td><td>Separate decisions</td></tr></table></div>`;
}
function renderSpec(){
  $("spec").innerHTML=`<div class="grid2"><div class="card"><h2>One-page spec</h2><table>
  <tr><td><b>User and job</b></td><td>Elena, an AP clerk, clears about 400 shared-inbox items a day and records one decision per carrier invoice.</td></tr>
  <tr><td><b>Bottleneck</b></td><td>Opening each document, finding the trip, and comparing by hand; non-invoices mixed into the same queue.</td></tr>
  <tr><td><b>Smallest useful product</b></td><td>One screen that proposes PAY, HOLD, PAY LESS or ESCALATE with the evidence, for Elena to approve.</td></tr>
  <tr><td><b>AI does</b></td><td>Classifies the email, reads documents and photos, copies out facts with quotes, drafts the note.</td></tr>
  <tr><td><b>Code does</b></td><td>Checks every quote, looks up TripLog, compares, proposes the disposition, blocks bank changes, caps the payable amount.</td></tr>
  <tr><td><b>Elena does</b></td><td>Every final decision in the POC. Nothing is sent, paid or recorded without her.</td></tr>
  <tr><td><b>Pass if</b></td><td>Outcome: correct proposal with evidence, no rework. Safety: zero wrong payment proposals; every bank change blocked. Process: every finding cites a source. Efficiency: fewer minutes per item than today.</td></tr>
  <tr><td><b>Not in scope</b></td><td>Sending email, executing payments, vendor-master or bank-change automation, wider AP.</td></tr>
  <tr><td><b>Prototype defaults to confirm</b></td><td>Any base-price difference escalates (no tolerance). An approved extra needs its own receipt. TripLog status decides "delivered".</td></tr></table></div>
  <div class="card"><h2>Path to production</h2><table><tr><th>Stage</th><th>What happens</th><th>Evidence today</th></tr>
  <tr><td>Requirements and design</td><td>Rules confirmed with Elena and her manager; architecture review of the mailbox, TripLog and PayQueue connections</td><td>Case-defined, not user-validated; design not reviewed</td></tr>
  <tr><td>Build and unit tests</td><td>Engine, checks, prompts versioned; tests on every change through the build pipeline</td><td>Done for the prototype</td></tr>
  <tr><td>QA in a test environment</td><td>Frozen sets, blind sets, injected mistakes, real document formats, retries and duplicates</td><td>Partial: synthetic text only</td></tr>
  <tr><td>User acceptance</td><td>Elena and the manager judge real items against their own decisions</td><td>Not run</td></tr>
  <tr><td>Shadow</td><td>Runs beside Elena on the live inbox; writes nothing</td><td>Not run</td></tr>
  <tr><td>Controlled release</td><td>Change approval, monitoring, a switch to turn it off, rollback; Elena approves every item</td><td>Not deployed</td></tr>
  <tr><td>Widening</td><td>One disposition type at a time (for example clean PAY first), each its own decision on shadow evidence</td><td>Future gate</td></tr></table></div></div>`;
}
const DEMO=[
 {id:"A", t:"A clean invoice", say:"One email, three attachments. The AI read the documents, code compared them with TripLog, and every check is green. Proposal: PAY $2,000. Click a quote to see it in the invoice. Nothing is recorded until Elena approves."},
 {id:"C", t:"An extra nobody approved", say:"The redelivery charge of $175 is not an approved extra on this trip. Proposal: PAY LESS $2,220, with the reason, the evidence and a drafted note that is not sent."},
 {id:"D", t:"Two sources disagree", say:"The invoice and an attached rate confirmation say $2,400; TripLog says $2,150. The workflow does not pick a side. It escalates with both pieces of evidence."},
 {id:"H", t:"An instruction hidden in the invoice", say:"The invoice tells the system to mark it paid and release $4,900. It is flagged, ignored, and the decision is the same as without it."},
 {id:"F", t:"A bank-detail change", say:"A code rule on the raw email keeps this out of the payment flow, whatever the model says. There are no payment buttons here."},
 {tab:"evals", t:"The evidence", say:"Expected outcomes were frozen before any code. This shows expected versus actual on recorded live runs, cases written separately from the build, and wrong model reads fed in on purpose."}
];
function showDemo(){ const b=$("demoBox"); if(S.demo<0){ b.classList.add("hide"); return; } const st=DEMO[S.demo]; b.classList.remove("hide");
  b.innerHTML=`<div class="n">Step ${S.demo+1} of ${DEMO.length}</div><h3>${esc(st.t)}</h3><p>${esc(st.say)}</p><div class="row"><button id="dmX">Close</button><div class="row"><button id="dmB" ${S.demo===0?"disabled":""}>Back</button><button class="p" id="dmN">${S.demo===DEMO.length-1?"Done":"Next"}</button></div></div>`;
  $("dmX").onclick=()=>{ S.demo=-1; showDemo(); }; $("dmB").onclick=()=>goDemo(S.demo-1); $("dmN").onclick=()=>{ if(S.demo===DEMO.length-1){ S.demo=-1; showTab("review"); showDemo(); } else goDemo(S.demo+1); }; }
function goDemo(i){ S.demo=i; const st=DEMO[i]; if(st.tab) showTab(st.tab); else { S.sel=st.id; S.set="dev"; S.hl=null; render(); showTab("review"); } showDemo(); }
function showTab(t){ S.tab=t; const el=$(t==="evals"?"evals":"review"); if(el&&el.scrollIntoView) el.scrollIntoView({behavior:"smooth",block:"start"}); }
function renderArch(){
  const b=(cls,who,t,d)=>`<div class="fbox ${cls}"><span class="who">${who}</span><b>${t}</b>${d}</div>`, a=`<span class="farrow">→</span>`;
  $("arch").innerHTML=`<div class="card"><h2>How it works: AI reads, code compares, Elena decides</h2><div class="flow">
   ${b("sys","Source","Shared inbox","Email, PDFs, phone photos")}${a}${b("ai","AI","Classify","Invoice, payment question, bank change, other")}${a}${b("ai","AI","Read documents","Trip, carrier, prices, extras, proof, each with a quote")}${a}${b("code","Code","Check the read","Every quote found word for word; amounts on the quoted line")}${a}${b("code","Code","TripLog lookup","Agreed price, status, approved extras")}${a}${b("code","Code","Compare and propose","PAY · HOLD · PAY LESS · ESCALATE, with evidence")}${a}${b("person","Person","Elena approves","Approve, override with a reason, or escalate")}${a}${b("sys","System","PayQueue","Recorded only after her click")}</div>
   <div class="side"><span>Bank-detail change → blocked by a code rule on the raw email; goes to vendor verification, never to payment</span><span>Instructions inside a document → flagged and ignored</span><span class="n">Not an invoice → filed outside the payment flow</span><span class="n">Read fails a check → Elena reviews by hand</span></div></div>`;
}
function render(){ renderInbox(); renderMail(); renderPanel(); renderEvals(); }
async function call(prompt){ let raw=null; try{ raw=await S.sample.json(prompt,{cache:false}); }catch(e){ raw=null; } return RG.parseRead(raw); }
async function readLive(id){ const it=RG.itemById(id); const t0=Date.now(); const read=await call(RG.prompt(it)); S.live[id]=read; let draft=null;
  try{ const r=RG.decide(it,read); if(r.draft&&r.disposition!=="HUMAN_REVIEW"){ const d=await call(RG.draftPrompt(it,r)); if(d&&typeof d.body==="string") draft={subject:String(d.subject||""),body:d.body}; } }catch(e){ draft=null; }
  S.liveDraft[id]=draft; S.liveMeta[id]={ms:Date.now()-t0}; }
async function runAllLive(set){ if(!S.sample||S.busy) return; S.busy=true; S.mode="live"; setMode(); const reads={}, drafts={}, ms={};
  for(const it of RG.SETS[set]){ $("status").textContent=`Live AI reading ${it.id}…`; renderEvals(); await readLive(it.id); reads[it.id]=S.live[it.id]===undefined?null:S.live[it.id]; drafts[it.id]=S.liveDraft[it.id]||null; ms[it.id]=S.liveMeta[it.id].ms; }
  S.busy=false; const at=new Date().toISOString(); let stored="";
  try{ if(S.db){ const id=`${set}_${at.replace(/[^0-9]/g,"").slice(0,14)}`; await S.db.collection("live_runs").doc(id).set({set,at,outcomes:JSON.stringify(outcomesOf(set,reads,drafts,ms))}); await S.db.collection("live_reads").doc(id).set({set,at,reads:JSON.stringify(reads),drafts:JSON.stringify(drafts)}); stored=` · stored as ${id}`; } }catch(e){ stored=" · not stored"; }
  $("status").textContent="Live AI run complete"+stored; render(); }
function setMode(){ $("mRec").classList.toggle("on",S.mode==="rec"); $("mLive").classList.toggle("on",S.mode==="live"); $("mRef").classList.toggle("on",S.mode==="ref"); $("mRec").classList.toggle("hide",!hasRec("dev")); }
$("mRec").onclick=()=>{ S.mode="rec"; setMode(); render(); };
$("mRef").onclick=()=>{ S.mode="ref"; setMode(); render(); };
$("mLive").onclick=async()=>{ if(!S.sample){ $("status").textContent="Live AI is not available in this view"; return; } S.mode="live"; setMode(); await pick(S.sel); render(); };
$("demoBtn").onclick=()=>goDemo(0);
window.__rg={S,readLive,runAllLive};
setMode(); renderArch(); renderReal(); renderSpec(); render();
(async()=>{ try{ S.sample=window.claude?await window.claude.use("sample"):null; }catch(e){ S.sample=null; } try{ S.db=window.claude?await window.claude.use("db"):null; }catch(e){ S.db=null; } renderEvals(); })();
