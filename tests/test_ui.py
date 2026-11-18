import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
from playwright.sync_api import sync_playwright
fails=[]; n=0
def ok(c,m):
    global n; n+=1
    if not c: fails.append(m); print('FAIL',m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1500,'height':1000}); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(ROOT.joinpath('index.html').as_uri()); pg.wait_for_timeout(300)
    ok(pg.locator('.inbox .it').count()==8,'8 inbox items')
    exp={'A':'PAY','B':'HOLD + request','C':'PAY LESS','D':'ESCALATE to manager','E':'NOT AN INVOICE: payment question','F':'NOT AN INVOICE: bank-detail change (high risk)','G':'PAY','H':'PAY LESS'}
    for k,v in exp.items():
        pg.click(f'.it[data-id="{k}"]'); pg.wait_for_timeout(60)
        t=pg.locator('.banner').inner_text(); ok(t.startswith(v),f'{k} banner {t[:40]!r}')
    pg.click('.it[data-id="A"]'); ok('$2,000.00' in pg.locator('.banner').inner_text(),'A amount'); ok('PAY' in pg.locator('.sum').inner_text(),'summary strip')
    pg.locator('.cite[data-doc]').first.click(); pg.wait_for_timeout(60); ok(pg.locator('mark').count()==1,'cite highlights the quote')
    pg.click('#approve'); ok(pg.locator('.chip.done').count()>=1,'approve records'); ok('PayQueue entries' in pg.locator('#panel').inner_text(),'PayQueue log shown')
    pg.click('.it[data-id="C"]'); ok('$2,220.00' in pg.locator('.banner').inner_text(),'C pays 2220'); ok('not sent' in pg.locator('#panel').inner_text(),'draft marked not sent')
    pg.click('#ovBtn'); ok(pg.locator('.it[data-id="C"] .chip.done').count()==0,'override needs decision+reason')
    pg.select_option('#ovSel','HOLD'); pg.fill('#ovWhy','carrier sent approval by phone'); pg.click('#ovBtn'); ok('override' in pg.locator('.it[data-id="C"]').inner_text(),'override recorded')
    pg.click('.it[data-id="F"]'); ok(pg.locator('#approve').count()==0 and pg.locator('#ovBtn').count()==0,'F has no payment controls'); ok('Bank-change rule fired' in pg.locator('#panel').inner_text(),'F bank rule chip')
    pg.click('.it[data-id="H"]'); ok('ignored' in pg.locator('#panel').inner_text(),'H instruction ignored chip'); ok('$1,675.00' in pg.locator('.banner').inner_text(),'H pays 1675')
    tx=pg.locator('#evals').text_content()
    ok('8/8' in tx and '12/12' in tx and 'Unchanged' in tx,'eval tiles'); ok('UNSAFE' not in tx,'no unsafe'); ok(pg.locator('[data-run="dev"]').is_disabled(),'live disabled offline')
    ok('Mocked' in pg.locator('#real').text_content(),'real vs mocked'); ok('Path to production' in pg.locator('#spec').text_content(),'spec and path')
    ok(pg.locator('#arch .fbox').count()==8,'architecture picture has 8 boxes'); ok(pg.locator('.tabs button').count()==0,'no tab bar')
    pg.click('#demoBtn'); ok('step 1 of 6' in pg.locator('#demoBox').inner_text().lower(),'demo opens')
    for i in range(5): pg.click('#dmN')
    ok('step 6 of 6' in pg.locator('#demoBox').inner_text().lower(),'demo reaches evidence')
    pg.click('#dmN'); ok('hide' in pg.locator('#demoBox').get_attribute('class'),'demo closes')
    pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(400)
    pg.click('.it[data-id="A"]'); pg.screenshot(path=str(ROOT/'docs'/'img'/'review_clean_invoice.png'))
    pg.click('.it[data-id="C"]'); pg.click('#undo'); pg.evaluate('window.scrollTo(0,0)'); pg.screenshot(path=str(ROOT/'docs'/'img'/'review_pay_less.png'),full_page=True)
    ok(not errs,'console errors: '+'; '.join(errs)[:300]); b.close()
print(f'{n-len(fails)}/{n} UI checks pass'); sys.exit(1 if fails else 0)
