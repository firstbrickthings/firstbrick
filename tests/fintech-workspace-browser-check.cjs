// UI fixtures only. Refuse payments and any data mutation outside account bootstrap.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,390,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],reports=[],financialWrites=[];let owner=true;
  page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('babyone-analytics-consent','no'));
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await context.route('**/api/**',r=>{
   const u=new URL(r.request().url()),path=u.pathname,method=r.request().method();
   if(path==='/api/auth/config')return r.fulfill({json:{phone_available:true,email_available:false}});
   if(path==='/api/catalog/products'||path==='/api/admin/products')return r.fulfill({json:{items:[],total:0}});
   if(path==='/api/catalog/categories')return r.fulfill({json:[]});
   if(path==='/api/store/content')return r.fulfill({json:{}});if(path==='/api/store/reviews')return r.fulfill({json:[]});
   if(path==='/api/store/contact')return r.fulfill({json:{whatsapp_automation_active:false}});
   if(path==='/api/me')return r.fulfill({json:{uid:'fintech-owner-fixture',phone:'+919999999999',is_admin:owner}});
   if(path==='/api/me/register')return r.fulfill({json:{registered:true}});
   if(path==='/api/me/cart')return r.fulfill({json:{items:[],version:0,subtotal:'0',ordered:false}});
   if(path==='/api/me/whatsapp')return r.fulfill({json:{order_updates:false,cart_reminders:false}});
   if(path==='/api/admin/orders')return r.fulfill({json:{items:[],total:0}});
   if(path==='/api/admin/order-activity')return r.fulfill({json:{new_count:2,latest_event_id:3}});
   if(path==='/api/admin/overview')return r.fulfill({json:{total_customers:42,new_signups_today:3,total_traffic:157,active_users:2,traffic:[],growth:[],sources:[],recent_customers:[]}});
   if(path==='/api/payments/config')return r.fulfill({json:{razorpay_enabled:true,razorpay_live_enabled:true,test_mode:false,payment_mode:'live',upi_enabled:true,upi_availability:'available'}});
   if(path==='/api/ready')return r.fulfill({json:{ready:true}});
   if(path==='/api/admin/payments/overview'){
    assert.equal(method,'GET');const mode=u.searchParams.get('mode'),days=Number(u.searchParams.get('days'));reports.push({mode,days});
    return r.fulfill({json:{mode,days,source:'website_records',totals:{collected_paise:mode==='live'?100:999,successful:1,pending:2},timeline:Array.from({length:days===1?24:days},(_,i)=>({label:'Day '+(i+1),collected_paise:i===0?(mode==='live'?100:999):0,successful:i===0?1:0,pending:i===1?2:0})),recent:[{order_id:mode==='live'?'BO-LIVE-FIXTURE':'BO-TEST-FIXTURE',kind:'gateway_check',amount_paise:mode==='live'?100:999,status:'paid',created_at:'2026-01-02T12:00:00Z'}],note:'Website records only; settlements are managed in Razorpay.'}});
   }
   if(path==='/api/admin/payments/check/latest')return r.fulfill({json:{order:null,request_id:null}});
   if(method!=='GET'){financialWrites.push(path);throw Error('Unexpected mutation in UI test: '+path)}
   return r.fulfill({status:401,json:{detail:'Fixture sign-in required'}});
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(async()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'fixture'};await BOserver.checkIdentity();await boAdmin.openDashboard()});await page.waitForSelector('.bo-overview-metrics');
  assert.deepEqual(await page.locator('.bo-overview-metrics strong').allTextContents(),['42','3','157','2'],'Original overview values are preserved');
  assert.equal(await page.locator('.bo-admin-top').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(11, 16, 27)');assert(await page.locator('.bo-admin-top').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Header fits at '+width);
  await page.locator('.bo-fintech-top-tabs [data-area=payments]').click();await page.waitForSelector('.bo-fintech-metric-row');
  assert((await page.locator('.bo-fintech-metric-row button').first().textContent()).includes('₹1.00'));assert.equal(await page.locator('.bo-fintech-method-state.ready').count(),2);assert.equal(await page.locator('.bo-fintech-top-tabs [data-area=payments]').getAttribute('aria-current'),'page');
  assert(await page.locator('#bo-admin-layer').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Workspace fits at '+width);await page.screenshot({path:'/workspace/work/review/fintech-payments-'+width+'.png'});
  await page.locator('[data-payment-metric=pending]').click();await page.locator('[data-bar="1"]').click();assert((await page.locator('#bo-fintech-trend-value').textContent()).includes('Day 2 · 2'));
  const reportReads=reports.length;await page.locator('[data-update="1"]').click();await page.waitForFunction(()=>document.querySelector('.bo-fintech-update h3')?.textContent==='Collections and bank settlements');assert.equal(reports.length,reportReads,'Carousel changes immediately without fetching reports again');
  await page.locator('#bo-fintech-days').selectOption('30');await page.waitForFunction(()=>document.querySelectorAll('.bo-fintech-bars button').length===30);
  if(width<=900)await page.locator('#bo-dashboard-menu').click();await page.locator('#bo-fintech-test-mode').click();await page.waitForFunction(()=>document.querySelector('.bo-fintech-page-heading h2')?.textContent==='Test payment records');
  assert(reports.at(-1).mode==='test'&&reports.at(-1).days===30);assert.equal(await page.locator('#bo-fintech-test-mode').getAttribute('aria-checked'),'true');assert((await page.locator('.bo-fintech-status-chip').textContent()).includes('Live checkout'),'Report switch does not change checkout');assert((await page.locator('.bo-fintech-metric-row button').first().textContent()).includes('₹9.99'));assert((await page.locator('.bo-fintech-transactions').textContent()).includes('BO-TEST-FIXTURE'));
  if(width<=900)await page.locator('#bo-dashboard-menu').click();await page.locator('#bo-fintech-test-mode').click();await page.waitForFunction(()=>document.querySelector('.bo-fintech-page-heading h2')?.textContent==='Payments');
  if(width<=900)await page.locator('.bo-fintech-mobile-search').click();else await page.locator('#bo-fintech-search').focus();await page.locator('#bo-fintech-search').fill('overview');await page.locator('[data-result=overview]').click();await page.waitForSelector('.bo-overview-metrics');assert.deepEqual(await page.locator('.bo-overview-metrics strong').allTextContents(),['42','3','157','2']);
  if(width<=900)await page.locator('#bo-dashboard-menu').click();await page.locator('#bo-fintech-more summary').click();assert(await page.locator('#bo-fintech-more [data-panel=backup]').isVisible());if(width<=900)await page.locator('#bo-dashboard-menu').click();
  await page.locator('.bo-fintech-support').click();assert(await page.locator('#bo-fintech-dialog').isVisible());assert((await page.locator('#bo-fintech-dialog').textContent()).includes('WhatsApp connection guide'));await page.keyboard.press('Escape');
  if(width>900){await page.locator('#bo-fintech-health').click();await page.waitForFunction(()=>document.querySelector('#bo-fintech-dialog [role=status]')?.textContent==='Website service is ready.');await page.keyboard.press('Escape')}
  assert.equal(await page.locator('#bo-admin-notifications .bo-order-count').textContent(),'2');assert.deepEqual(financialWrites,[]);assert.deepEqual(errors,[]);
  owner=false;await page.evaluate(()=>BOserver.checkIdentity());assert.equal(await page.locator('#bo-admin-panel-payments').textContent(),'','Payment records are cleared when owner access ends');await context.close();
 }
 await browser.close();console.log('PASS: dark fintech header, responsive navigation/search, original store metrics, genuine live/test report filtering without checkout changes or financial writes, method readiness, carousel, trend selection, date ranges, More menu, support, system health and owner-data cleanup at 320/390/768/1024/1440.');
})().catch(e=>{console.error(e);process.exit(1)});
