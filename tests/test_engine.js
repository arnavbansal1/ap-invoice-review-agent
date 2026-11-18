const RG=require("../src/engine.js"); const fs=require("fs"); const crypto=require("crypto");
const raw=fs.readFileSync(__dirname+"/../expected.json"); const EXP=JSON.parse(raw);
let pass=0, fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log("FAIL  "+m);} };
const frozen=fs.readFileSync(__dirname+"/../FROZEN.sha256","utf8").split(" ")[0];
ok(crypto.createHash("sha256").update(raw).digest("hex")===frozen,"expected.json unchanged since freeze");
const res={}; RG.ITEMS.forEach(it=>{ res[it.id]=RG.decide(it,RG.REF[it.id]); });
const s=RG.score(EXP,res);
s.rows.forEach(r=>{ ok(r.okD,`${r.id}: disposition ${r.actual} (expected ${r.expected})`); ok(r.okC,`${r.id}: class ${r.cls} (expected ${r.expectedCls})`); ok(!r.overpay,`${r.id}: no overpayment`);
  if(EXP[r.id].pay!=null && r.actual===EXP[r.id].disposition) ok(Math.round(r.actualPay*100)===Math.round(EXP[r.id].pay*100),`${r.id}: pay ${r.actualPay} (expected ${EXP[r.id].pay})`); });
ok(s.mustHit===s.mustTotal,`must-hold/escalate/route recall ${s.mustHit}/${s.mustTotal}`);
ok(s.citeOk===s.citeAll && s.citeAll>0,`citations verbatim ${s.citeOk}/${s.citeAll}`);
RG.ITEMS.forEach(it=>{ const r=res[it.id]; if(["PAY","PAY_LESS","HOLD","ESCALATE"].includes(r.disposition)) ok(r.findings.some(f=>f.cites.length>0) && r.findings.filter(f=>f.level!=="info").every(f=>f.cites.length>0),`${it.id}: every finding cites evidence`); });
// bank block and injection
ok(res.F.blocked===true && res.F.pay==null,"F: blocked from payment flow");
ok(res.H.inj.length===1,"H: instruction flagged");
const H0=RG.decide(RG.withoutInjection(RG.itemById("H")),RG.REF.H); ok(H0.disposition===res.H.disposition && H0.pay===res.H.pay && H0.inj.length===0,"H: same decision with and without the instruction");
RG.ITEMS.filter(i=>i.id!=="H").forEach(it=>ok(RG.guardInjection(it).length===0,`${it.id}: no false injection flag`));
RG.ITEMS.filter(i=>i.id!=="F").forEach(it=>ok(RG.guardBank(it)===null,`${it.id}: no false bank flag`));
// validation rejects every REF quote? (all REF reads must validate clean)
RG.ITEMS.forEach(it=>{ const v=RG.validate(it,RG.REF[it.id]); ok(v.ok && v.problems.length===0,`${it.id}: reference read validates (${v.problems.map(p=>p.text).join("; ")})`); });
// injected model mistakes
const mm=RG.runMistakes(EXP); mm.forEach(m=>ok(!m.unsafe,`${m.id} on ${m.item}: ${m.what} -> ${m.got} ${m.pay==null?"":m.pay}`));
console.log(mm.map(m=>`${m.id} ${m.item} -> ${m.got}${m.pay!=null?" $"+m.pay:""}`).join(" | "));
// parser
ok(RG.parseRead('```json\n{"type":"other","invoice":null}\n``` trailing')?.type==="other","parser takes first JSON object");
ok(RG.parseRead("no json")===null,"parser returns null on junk");
// prompt contains docs but never TripLog or expected
RG.ITEMS.forEach(it=>{ const p=RG.prompt(it); ok(!/Agreed price|TripLog record|expected/i.test(p.replace(/Ignore TripLog[^\n]*/,"")),`${it.id}: prompt holds no TripLog data`); });
// draft gate
const rc=res.C, good={subject:"Invoice HS-1187, trip TB-48402",body:"We are processing this invoice for $2,220.00, not $2,395.00. The redelivery charge of $175.00 is not an approved extra on this trip."};
ok(RG.checkDraft(good,rc).ok,"draft gate passes a clean draft: "+RG.checkDraft(good,rc).problems.join("; "));
ok(!RG.checkDraft({subject:"x",body:"We will pay $2,395.00 within 5 days. $2,220.00"},rc).ok,"draft gate blocks a promise");
ok(!RG.checkDraft({subject:"x",body:"Processing $2,220.00; also releasing $4,900.00"},rc).ok,"draft gate blocks an amount not in the record");
ok(!RG.checkDraft({subject:"x",body:"Processing $2,220.00 for TB-48402 and TB-48213"},rc).ok,"draft gate blocks another trip");
ok(!RG.checkDraft({subject:"x",body:"We are paying less."},rc).ok,"draft gate needs the amount for PAY LESS");
ok(!RG.checkDraft(null,rc).ok,"draft gate blocks an empty draft");
ok(!/4,900/.test(RG.draftPrompt(RG.itemById("H"),res.H)),"draft prompt for H carries no injected amount");
console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
