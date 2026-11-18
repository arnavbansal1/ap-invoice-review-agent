import json,hashlib,sys
from pathlib import Path
R=Path(__file__).parent
exp=(R/'expected.json').read_bytes(); sha=hashlib.sha256(exp).hexdigest()
assert (R/'FROZEN.sha256').read_text().split()[0]==sha,'expected.json changed since freeze'
page=(R/'src/page.html').read_text(encoding='utf-8')
page=page.replace('/*EXPECTED*/','const EXPECTED='+json.dumps(json.loads(exp))+';const FROZEN_SHA="'+sha+'";')
data=[]
B=R/'blind'
if (B/'blind_items.json').exists():
    fz=dict(l.split()[::-1] for l in (B/'FROZEN.sha256').read_text().splitlines() if l.strip())
    for f in ('blind_items.json','blind_triplog.json','blind_key.json'):
        assert hashlib.sha256((B/f).read_bytes()).hexdigest()==fz[f], f+' changed since freeze'
    data.append('const BLIND_ITEMS='+json.dumps(json.loads((B/'blind_items.json').read_text(encoding='utf-8')),ensure_ascii=False)+';')
    data.append('const BLIND_TRIPLOG='+json.dumps(json.loads((B/'blind_triplog.json').read_text(encoding='utf-8')),ensure_ascii=False)+';')
    data.append('const BLIND_KEY='+json.dumps(json.loads((B/'blind_key.json').read_text(encoding='utf-8')),ensure_ascii=False)+';')
    if (B/'NOTE.txt').exists(): data.append('const BLIND_NOTE='+json.dumps((B/'NOTE.txt').read_text(encoding='utf-8').strip())+';')
rec=R/'src/recorded.json'
if rec.exists(): data.append('const RECORDED='+json.dumps(json.loads(rec.read_text(encoding='utf-8')),ensure_ascii=False)+';')
page=page.replace('/*DATA*/','\n'.join(data).replace('</script>','<\\/script>'))
page=page.replace('/*ENGINE*/',(R/'src/engine.js').read_text(encoding='utf-8'))
page=page.replace('/*UI*/',(R/'src/ui.js').read_text(encoding='utf-8'))
for ph in ('/*EXPECTED*/','/*DATA*/','/*ENGINE*/','/*UI*/'): assert ph not in page, ph
out=R/'index.html'
if '--check' in sys.argv:
    assert out.read_text(encoding='utf-8')==page,'index.html is out of date'; print('index.html is up to date'); sys.exit(0)
out.write_text(page,encoding='utf-8'); print('built',len(page))
