// Replays the recorded live AI reads of the separately generated blind cases through the current engine.
const RG=require("../src/engine.js"); const fs=require("fs"); const crypto=require("crypto"); const D=__dirname+"/../";
const items=JSON.parse(fs.readFileSync(D+"blind/blind_items.json")), tb=JSON.parse(fs.readFileSync(D+"blind/"+fs.readdirSync(D+"blind").find(f=>/^blind_trip/.test(f)))), key=JSON.parse(fs.readFileSync(D+"blind/blind_key.json"));
RG.addSet("blind",items,tb); const run=JSON.parse(fs.readFileSync(D+"runs/blind_run1.json"));
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log("FAIL  "+m); } };
fs.readFileSync(D+"blind/FROZEN.sha256","utf8").trim().split("\n").forEach(l=>{ const [h,f]=l.trim().split(/\s+/); ok(crypto.createHash("sha256").update(fs.readFileSync(D+"blind/"+f)).digest("hex")===h,f+" unchanged since freeze"); });
const res={}; items.forEach(it=>{ res[it.id]=RG.decide(it,run.reads[it.id]); });
const s=RG.score(key,res,items);
s.rows.forEach(r=>{ ok(r.okD,`${r.id}: ${r.actual} (expected ${r.expected})`); ok(r.okC,`${r.id}: class ${r.cls}`); ok(!r.overpay,`${r.id}: no overpayment`); });
ok(s.citeOk===s.citeAll&&s.citeAll>0,`citations verbatim ${s.citeOk}/${s.citeAll}`);
items.forEach(it=>{ const k=key[it.id], r=res[it.id]; ok(!!RG.guardBank(it)===(k.class==="bank_change"),`${it.id}: bank rule ${RG.guardBank(it)?"fires":"quiet"}`); ok((r.inj.length>0)===!!k.injection_flag,`${it.id}: instruction flag ${r.inj.length}`);
  if(k.pay!=null&&r.disposition===k.disposition) ok(Math.round(r.pay*100)===Math.round(k.pay*100),`${it.id}: pay ${r.pay}`);
  if(r.draft&&r.disposition!=="HUMAN_REVIEW"&&run.drafts[it.id]&&r.disposition===run.outcomes_as_scored[it.id].d){ const c=RG.checkDraft(run.drafts[it.id],r); ok(c.ok,`${it.id}: recorded AI draft passes the code checks (${c.problems.join("; ")})`); } });
// a wrong read cannot carry a bank-change item into payment: feed each one a carrier-invoice read
items.filter(it=>key[it.id].class==="bank_change").forEach(it=>{ const fake=JSON.parse(JSON.stringify(RG.REF.B)); const r=RG.decide(it,fake); ok(r.disposition==="NOT_INVOICE_BANK_CHANGE"&&r.pay==null,`${it.id}: still blocked when the read calls it an invoice`); });
// the first scored run is kept as it was scored
const o=run.outcomes_as_scored; let first=0; items.forEach(it=>{ const k=key[it.id]; if(o[it.id].d===k.disposition||(k.also_acceptable||[]).includes(o[it.id].d)) first++; });
ok(first===11,"first scored run stays recorded as 11 of 12, got "+first);
console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
