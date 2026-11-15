// Banner controls against local fixtures: no live writes, messages or payments.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081',images=['assets/photo-efad07a3afa7298b.webp','assets/photo-9fdd69d0f677103a.webp','assets/photo-189406759232e71b.webp'];
const products=images.map((image,i)=>({id:'toy-'+i,name:'Toy '+i,category:'Toys & Learning',image,active:true,sale_enabled:true,currency:'INR',version:1,metadata:{subcategory:'Soft Toys'},variants:[{id:'toy-option-'+i,label:'',price:'10.00',stock:5,enabled:true}]}));
const banners=['promo1','promo2','fashion'].flatMap(section=>images.map((image,i)=>({id:section+'-'+i,image,title:'Little discoveries '+i,category:'Toys & Learning',reference:true,published:true})));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<761,hasTouch:width<761,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('babyone-analytics-consent','no'));
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(r.request().method()!=='GET')throw Error('Unexpected write');const values={'/api/catalog/products':{items:products,total:3},'/api/catalog/categories':[], '/api/store/content':{banners:{version:1,value:{items:banners.filter(b=>!b.id.startsWith('fashion-'))}},fashion:{version:1,value:{items:banners.filter(b=>b.id.startsWith('fashion-'))}}},'/api/store/reviews':[], '/api/store/contact':{},'/api/auth/config':{},'/api/payments/config':{}};return r.fulfill(path in values?{json:values[path]}:{status:401,json:{detail:'Fixture'}})});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('#promo-dots-1 button').length===3);
  for(const selector of ['#promo-1','#promo-2','#bo-fashion-hero','#bo-plp-banner']){
   if(selector==='#bo-plp-banner'){await page.evaluate(()=>filterByCategory('Toys & Learning','Soft Toys'));await page.waitForSelector('#bo-plp-banner .bo-banner-dot')}
   const root=page.locator(selector);await root.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
   const dots=root.locator('.bo-banner-dot'),selected=()=>root.locator('.bo-banner-slide[aria-hidden=false]');assert.equal(await dots.count(),3);assert.equal(await root.locator('.bo-banner-dots').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await root.evaluate(e=>getComputedStyle(e).borderRadius),'0px');
   await dots.nth(2).click();assert((await selected().getAttribute('aria-label')).startsWith('3 of'));await dots.nth(2).press('ArrowRight');assert((await selected().getAttribute('aria-label')).startsWith('1 of'));
   const box=await root.boundingBox(),x=box.x+box.width*.7,y=box.y+box.height*.3,end=Math.max(box.x+20,x-150);
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(end,y+2,{steps:7});await page.mouse.up();assert((await selected().getAttribute('aria-label')).startsWith('2 of'));
   if(width<761){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end,y:y+3,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await selected().getAttribute('aria-label')).startsWith('3 of'));}
   await root.press('Home');await page.clock.fastForward(6000);assert((await selected().getAttribute('aria-label')).startsWith('1 of'),'Reduced motion disables auto sliding');
   await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.runFor(50);await page.clock.runFor(2900);assert((await selected().getAttribute('aria-label')).startsWith('1 of'));await page.clock.runFor(200);assert((await selected().getAttribute('aria-label')).startsWith('2 of'),'Image advances after three seconds: '+selector+' at '+width);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  }
  await page.evaluate(()=>{showSection('home-page');BObanners.render(document.getElementById('promo-1'),[{image:'assets/favicon.svg'}],{trackId:'promo-slides-1',dotsId:'promo-dots-1'})});assert(await page.locator('#promo-dots-1').isHidden());
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: all four banner placements, transparent dots, manual selection, keyboard wrap, desktop drag, native mobile swipes, exact three-second image timing, reduced motion and single-image behavior.');
})().catch(e=>{console.error(e);process.exit(1)});
