// Local UI fixtures only: no customer data, messages or real payments.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081',slides=[{id:'slide-a',image:'assets/photo-efad07a3afa7298b.webp'},{id:'slide-b',image:'assets/photo-9fdd69d0f677103a.webp'},{id:'slide-c',image:'assets/photo-189406759232e71b.webp'}];
async function prepare(context,count=3){
 await context.addInitScript(()=>localStorage.setItem('babyone-analytics-consent','no'));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await context.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;if(r.request().method()!=='GET')throw Error('Unexpected write: '+path);
  const values={'/api/auth/config':{phone_available:true,email_available:false},'/api/catalog/products':{items:[],total:0},'/api/catalog/categories':[],
   '/api/store/content':{hero:{version:9,value:{items:slides.slice(0,count)}}},'/api/store/reviews':[], '/api/store/contact':{whatsapp_automation_active:false},'/api/payments/config':{razorpay_enabled:true,payment_mode:'live',upi_enabled:true}};
  return r.fulfill(path in values?{json:values[path]}:{status:401,json:{detail:'UI fixture'}});
 });
}
async function ready(page,count=3){await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(count=>heroSlidesData.length===count&&document.querySelectorAll('#hero-dots button').length===count,count)}
async function selected(page,index){assert.equal(await page.evaluate(()=>activeHero),index);assert.equal(await page.locator('#hero-dots [aria-current=true]').getAttribute('data-hero-slide'),String(index));assert.equal(await page.locator('#hero-slides [aria-hidden=false]').count(),1)}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<761,hasTouch:width<761,reducedMotion:'reduce'});await prepare(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await ready(page);
  assert(await page.locator('#hero-dots').isVisible(),'Dots stay available when motion is reduced');assert(await page.locator('#bo-hero-playback').isHidden());
  assert.equal(await page.locator('.bo-hero-controls').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','No background behind the hero dots');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(80);if(width<761)assert(await page.locator('#bo-hero-playback').isHidden(),'Mobile hero has no pause button');else assert(await page.locator('#bo-hero-playback').isVisible());await page.emulateMedia({reducedMotion:'reduce'});
  const controls=await page.locator('.bo-hero-controls').boundingBox();assert(controls.x>=0&&controls.x+controls.width<=width+1,'Controls fit the hero');
  await page.locator('[data-hero-slide="2"]').click();await selected(page,2);assert((await page.locator('.bo-hero-status').textContent()).includes('Slide 3 of 3'));
  await page.locator('[data-hero-slide="2"]').press('ArrowRight');await selected(page,0);await page.locator('#hero').press('End');await selected(page,2);await page.locator('#hero').press('Home');await selected(page,0);await page.locator('#hero').press('a');await selected(page,0);
  const rect=await page.locator('#hero').boundingBox(),y=rect.y+Math.min(140,rect.height/3),start=Math.min(rect.x+rect.width-30,rect.x+rect.width*.7),end=Math.max(rect.x+20,start-145);
  await page.mouse.move(start,y);await page.mouse.down();await page.mouse.move(end,y+3,{steps:8});await page.mouse.up();await selected(page,1);
  await page.mouse.move(end,y);await page.mouse.down();await page.mouse.move(start,y,{steps:8});await page.mouse.up();await selected(page,0);
  if(width<761){
   const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end,y:y+4,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await selected(page,1);
   if(width===320){
    await page.evaluate(()=>{const image=heroSlidesData[0].img;heroSlidesData.splice(0,heroSlidesData.length,...Array.from({length:12},()=>({img:image})));renderHero()});await page.locator('#hero').press('End');await selected(page,11);assert(await page.locator('#hero-dots').evaluate(e=>e.scrollLeft>0),'Last dot scrolls into view without moving the page');await page.locator('#hero').press('Home');
    await selected(page,0);await page.locator('#hero').press('ArrowRight');
   }
   const before=await page.evaluate(()=>scrollY);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:y+100,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2+3,y:y-80,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(before=>scrollY>before,before);await selected(page,1);assert.equal(await page.evaluate(()=>!!window.boHeroGesture),false,'Native vertical scrolling cancels the hero gesture');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await context.close();
 }
 const timedContext=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'no-preference'});await prepare(timedContext);const timed=await timedContext.newPage();timed.on('pageerror',e=>errors.push(e.message));await timed.clock.install();await ready(timed);await timed.clock.fastForward(5100);await selected(timed,1);
 await timed.locator('#hero').dispatchEvent('pointerdown',{pointerId:3,pointerType:'touch',clientX:500,clientY:300,isPrimary:true,button:0});await timed.clock.fastForward(6000);await selected(timed,1);await timed.locator('#hero').dispatchEvent('pointercancel',{pointerId:3,pointerType:'touch',clientX:500,clientY:300});await timed.clock.fastForward(5100);await selected(timed,2);
 await timed.locator('#bo-hero-playback').click();await timed.clock.fastForward(8000);await selected(timed,2);await timedContext.close();
 const solo=await browser.newContext({viewport:{width:390,height:844}});await prepare(solo,1);const one=await solo.newPage();await ready(one,1);assert(await one.locator('.bo-hero-controls').isHidden(),'A single photo has no empty navigation bar');await solo.close();
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: dot selection, accessible current slide, keyboard wrap/Home/End, desktop drag, native mobile swipes with vertical scrolling preserved, gesture-safe autoplay, pause, reduced motion and single-slide controls. No hosted writes.');
})().catch(e=>{console.error(e);process.exit(1)});
