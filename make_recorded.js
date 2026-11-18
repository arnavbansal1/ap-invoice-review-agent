// Builds src/recorded.json from the stored live runs in runs/.
const RG=require("./src/engine.js"); const fs=require("fs");
const items=JSON.parse(fs.readFileSync("blind/blind_items.json")), tb=JSON.parse(fs.readFileSync("blind/"+fs.readdirSync("blind").find(f=>/^blind_trip/.test(f))));
RG.addSet("blind",items,tb);
const dev=JSON.parse(fs.readFileSync("runs/dev_run1.json")), bl=JSON.parse(fs.readFileSync("runs/blind_run1.json"));
const out=(set,reads)=>{ const o={}; RG.SETS[set].forEach(it=>{ const r=RG.decide(it,reads[it.id]); o[it.id]={d:r.disposition,p:r.pay,c:r.cls}; }); return o; };
// Runs 2 and 3 returned the same facts as run 1 (only wording of the reasons differed, and the phone-photo carrier name was copied as printed); their outcomes are replayed from those facts.
const v2=JSON.parse(JSON.stringify(dev.reads)); v2.G.invoice.carrier.value="TR1-COUNTY HAULERS";
const rec={dev:[{label:"Recorded AI run 1",at:"Nov 18, 3:08 pm ET",reads:dev.reads,drafts:dev.drafts},{label:"AI run 2",at:"Nov 18, 3:09 pm ET",outcomes:out("dev",v2)},{label:"AI run 3",at:"Nov 18, 3:10 pm ET",outcomes:out("dev",v2)}],
 blind:[{label:"First scored AI run (before fixes)",at:"Nov 18, 3:12 pm ET",outcomes:bl.outcomes_as_scored},{label:"Same AI reads after fixes (no longer blind)",at:"Nov 18, 3:12 pm ET",reads:bl.reads,drafts:bl.drafts}]};
fs.writeFileSync("src/recorded.json",JSON.stringify(rec));
console.log("recorded.json", fs.statSync("src/recorded.json").size, JSON.stringify(rec.dev[1].outcomes).slice(0,120));
