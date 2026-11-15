// Real publishing against the isolated *_test MySQL browser server; never a hosted URL.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8082',video='assets/browser-fixture-hero.mp4',portrait='assets/browser-fixture-hero-mobile.mp4';
async function prepare(context){
 await context.addInitScript(()=>localStorage.setItem('babyone-analytics-consent','no'));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 for(const [url,file] of [[video,'desktop'],[portrait,'mobile']])await context.route('**/'+url,r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync('/workspace/work/hero-'+file+'-fixture.mp4')}));
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),owner=await browser.newContext({reducedMotion:'reduce'}),page=await owner.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(owner);
 await page.route('**/api/admin/media',r=>{const b=r.request().postDataBuffer();return r.fulfill({status:201,json:{url:b.includes(Buffer.from('portrait.mp4'))?portrait:b.includes(Buffer.from('hero.mp4'))?video:'assets/favicon.svg'}})});
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(async()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'browser-only-test-token'};await BOserver.checkIdentity();await boAdmin.openDashboard();boAdmin.tab('hero')});await page.waitForSelector('#bo-media-new');
 const existing=await page.evaluate(()=>heroSlidesData.map(s=>s.img));
 await page.locator('#bo-media-new').click();await page.locator('#bo-media-form [name=media_type]').selectOption('video');
 await page.locator('#bo-media-form [name=file]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('fixture cover')});
 await page.locator('#bo-media-form [name=video]').setInputFiles({name:'hero.mp4',mimeType:'video/mp4',buffer:fs.readFileSync('/workspace/work/hero-desktop-fixture.mp4')});
 await page.locator('#bo-media-form [name=video_mobile]').setInputFiles({name:'portrait.mp4',mimeType:'video/mp4',buffer:fs.readFileSync('/workspace/work/hero-mobile-fixture.mp4')});
 const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/content/hero')&&r.request().method()==='PUT');await page.locator('#bo-media-form button[type=submit]').click();const saved=await response;assert.equal(saved.status(),200,await saved.text());const document=await saved.json();assert.deepEqual(document.value.items.slice(0,existing.length).map(i=>i.image),existing);assert.equal(document.value.items.at(-1).videoUrl,video);
 await page.waitForFunction(()=>document.querySelector('#bo-admin-panel-hero .bo-work-status').textContent.includes('Published for all customers'));
 await page.evaluate(async()=>{boAdmin.close();await boAdmin.openDashboard();boAdmin.tab('hero')});await page.waitForSelector('#bo-media-new');
 const customer=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await prepare(customer);const second=await customer.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(base,{waitUntil:'networkidle'});
 await second.waitForFunction(()=>heroSlidesData.some(s=>s.mediaType==='video'&&s.videoUrl==='assets/browser-fixture-hero.mp4'));
 await second.evaluate(()=>goHero(heroSlidesData.findIndex(s=>s.mediaType==='video')));assert.equal(await second.locator('#hero .hero-slide.active video').getAttribute('src'),portrait);assert.equal(await second.evaluate(async()=>(await fetch('/api/admin/content/hero')).status),401);assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: dashboard video/poster upload saves through real MySQL validation, previous images remain, another browser loads the portrait hero, dashboard reopens safely, and anonymous users cannot edit content. Local test data only.');
})().catch(e=>{console.error(e);process.exit(1)});
