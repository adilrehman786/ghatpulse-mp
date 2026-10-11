import json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
css=(R/'styles.css').read_text()
react=(R/'public/vendor/react.production.min.js').read_text()
dom=(R/'public/vendor/react-dom.production.min.js').read_text()
app=(R/'dist/app.js').read_text()
csv=(R/'public/data/verified_excerpt.csv').read_text()
pre=f'''<script>
Object.defineProperty(window,'localStorage',{{configurable:true,value:{{getItem(){{return null}},setItem(){{}},removeItem(){{}}}}}});
window.__printCalls=0;
window.print=()=>window.__printCalls++;
const __csv={json.dumps(csv,ensure_ascii=False)};
window.fetch=async (u)=>String(u).includes('verified_excerpt.csv')?{{ok:true,text:async()=>__csv}}:{{ok:false,text:async()=>''}};
</script>'''
html='<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root">Booting</div>'+pre+'<script>'+react+'</script><script>'+dom+'</script><script>'+app+'</script></body></html>'
errors=[];logs=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--no-proxy-server','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:logs.append(f'{m.type} {m.text}') if m.type=='error' else None)
 page.set_content(html,wait_until='domcontentloaded',timeout=20000)
 page.wait_for_timeout(450)
 print('INITIAL_BODY:',page.locator('body').inner_text()[:340].replace('\n',' | '))
 print('BODY_HAS_72:', '72' in page.locator('body').inner_text())
 print('FOUND_RANKS:',page.locator('.rank-row').count())
 page.screenshot(path=str(R/'preview-overview.png'),full_page=True,animations='disabled')
 print('OVERVIEW_SCREENSHOT_SAVED')
 assert page.locator('.rank-row').count()==7
 page.get_by_role('button',name='Evidence Explorer').first.click()
 page.wait_for_timeout(100)
 print('EVIDENCE_ROWS:',page.locator('.data-table tbody tr').count())
 assert page.locator('.data-table tbody tr').count()==15
 # Verify sort, pagination and record-type filters on actual browser controls.
 page.get_by_role('button',name='Next').click()
 assert 'Page 2 / 5' in page.locator('.table-footer').inner_text()
 page.get_by_role('button',name='Previous').click()
 page.get_by_role('button',name='Sort by Ghat').click()
 page.get_by_label('Record type').select_option('BDL')
 assert page.locator('.data-table tbody tr').count()==2
 page.locator('.data-table tbody tr').first.click()
 assert 'BDL' in page.locator('[role=dialog]').inner_text()
 page.get_by_role('button',name='Close observation details').click()
 page.get_by_label('Record type').select_option('not sampled')
 assert page.locator('.data-table tbody tr').count()>0
 page.get_by_role('button',name='Reset filters').click()
 page.get_by_label('Site confidence').select_option('medium')
 assert page.locator('.data-table tbody tr').count()>0
 page.get_by_role('button',name='Reset filters').click()
 page.locator('.explorer-filter-grid label').filter(has_text='Festival').locator('select').select_option('Durga')
 assert 'No matching observations' in page.locator('main').inner_text()
 page.get_by_role('button',name='Clear filters').click()
 # Download the exact filtered source data, rather than a generated summary.
 with page.expect_download(timeout=10000) as csv_download:
  page.get_by_role('button',name='Export filtered CSV').click()
 csv_name=csv_download.value.suggested_filename
 assert csv_name.endswith('.csv')
 csv_download.value.save_as(str(R/'qa-filtered-evidence.csv'))
 assert (R/'qa-filtered-evidence.csv').read_text(encoding='utf-8-sig').count('2025')>0
 print('CSV_EXPORT:',csv_name)
 page.get_by_role('searchbox',name='Search all source fields').fill('unfindable_999')
 assert 'No matching observations' in page.locator('main').inner_text()
 page.get_by_role('button',name='Clear filters').click()
 assert page.locator('.data-table tbody tr').count()==15
 page.locator('.data-table tbody tr').first.click()
 assert page.locator('[role="dialog"]').count()==1
 print('DRAWER_TITLE:',page.locator('#record-title').inner_text())
 page.get_by_role('button',name='View ghat summary').click()
 assert 'Ghat Intelligence' in page.locator('main').inner_text()
 # All seven selectable ghats must produce an evidence context.
 for site in ['Bairagarh (Sant Hirdaram) kund','Khatlapura ghat','Prempura ghat','Rani Kamlapati ghat / Kamla Park kund','Hathaikheda dam / kund','Malikhedi kund','Shahpura lake ghat']:
  page.get_by_label('Selected ghat').select_option(site)
  assert site in page.get_by_label('Selected ghat').input_value()
 page.get_by_label('Selected ghat').select_option('Khatlapura ghat')
 page.get_by_role('tab',name='Historical Trends').click()
 print('CHARTS:',page.locator('.trend-svg').count())
 assert page.locator('.trend-svg').count()==3
 page.get_by_label('Show comparison lines').uncheck()
 assert page.get_by_label('Show comparison lines').is_checked()==False
 page.get_by_role('tab',name='Source Evidence').click()
 assert page.locator('.evidence-row').count()>=1
 page.get_by_role('button',name='Decision Brief').first.click()
 print('BRIEF_ENGLISH:',page.locator('.brief-text').inner_text()[:95].replace('\n',' | '))
 page.get_by_role('button',name='हिन्दी').click()
 assert 'ऐतिहासिक निर्णय संक्षेप' in page.locator('.brief-text').inner_text()
 page.get_by_role('button',name='Save Hindi as PDF').click()
 page.wait_for_timeout(250)
 assert page.evaluate('window.__printCalls')>=1
 page.get_by_role('button',name='English').click()
 page.get_by_role('button',name='Copy brief').click()
 page.wait_for_timeout(100)
 print('CLIPBOARD_FEEDBACK:',page.locator('.toast').inner_text() if page.locator('.toast').count() else '(none)')

 with page.expect_download(timeout=10000) as download:
  page.get_by_role('button',name='Download PDF').click()
 downloaded=download.value
 print('DOWNLOAD_NAME:',downloaded.suggested_filename)
 downloaded.save_as(str(R/'qa-evidence-brief.pdf'))
 pdf_bytes=(R/'qa-evidence-brief.pdf').read_bytes()
 assert pdf_bytes.startswith(b'%PDF-1.4')
 print('PDF_BYTES:',len(pdf_bytes))
 page.get_by_role('button',name='Methodology & Data').first.click()
 print('METHOD_CONTAINS_VALIDATION:', '1,524' in page.locator('main').inner_text())
 context2=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
 mobile=context2.new_page()
 mobile.on('pageerror',lambda e:errors.append('MOBILE:'+str(e)))
 mobile.set_content(html,wait_until='domcontentloaded',timeout=20000)
 mobile.wait_for_timeout(450)
 width=mobile.evaluate('({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth})')
 print('MOBILE_OVERFLOW:',width)
 mobile.screenshot(path=str(R/'preview-mobile.png'),full_page=True,animations='disabled')
 assert width['scrollWidth']<=width['innerWidth']
 mobile.get_by_role('button',name='Open navigation').click()
 assert 'open' in mobile.locator('.sidebar').get_attribute('class')
 mobile.get_by_role('button',name='Evidence Explorer').first.click()
 assert 'Evidence Explorer' in mobile.locator('main').inner_text()
 print('BROWSER_ERRORS:',errors)
 print('CONSOLE_ERRORS:',logs)
 assert not errors and not logs
 browser.close()
