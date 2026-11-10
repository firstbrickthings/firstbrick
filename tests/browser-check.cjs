const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // All remote services are blocked: these tests never send SMS, orders or analytics.
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(baseURL).origin?r.continue():r.abort());
 await page.goto(baseURL,{waitUntil:'networkidle'});
 await page.waitForTimeout(6000);
 assert(await page.locator('#bo-u-modal').evaluate(x=>x.classList.contains('hidden')),'No automatic login popup');
 assert.equal(await page.locator('h1').count(),1,'One meaningful homepage heading');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'No horizontal overflow');
  assert(await page.locator('#hero h1').isVisible(),'Hero heading visible');
  assert(await page.locator('#hero .hero-cta').isVisible(),'Hero shopping link visible');

 }
 await page.evaluate(()=>handleSearch('<img src=x onerror="window.injected=true">'));
 assert.equal(await page.locator('#search-results-mobile img').count(),0,'No injected search element');
 assert.equal(await page.evaluate(()=>window.injected),undefined,'No injected event handler');
 await page.evaluate(()=>openAllProducts());
 const initial=await page.locator('#plp-grid .product').count();assert.equal(initial,24);
 const firstIds=await page.locator('#plp-grid .product').evaluateAll(es=>es.map(e=>e.getAttribute('onclick')));
 await page.locator('#plp-grid-more').click();assert.equal(await page.locator('#plp-grid .product').count(),48);
 assert.deepEqual(await page.locator('#plp-grid .product').evaluateAll(es=>es.slice(0,24).map(e=>e.getAttribute('onclick'))),firstIds);
 await page.evaluate(()=>sortPLP('price-low'));assert.equal(await page.locator('#plp-grid .product').count(),24);
 await page.evaluate(()=>boU.login(true));
 assert.equal(await page.locator('#bo-login input[name=phone]').count(),1);
 assert.equal(await page.locator('#bo-login select').count(),0,'Minimal login fields');
 const unlabeled=await page.locator('#bo-login input').evaluateAll(es=>es.filter(e=>!e.labels.length).map(e=>e.name));assert.deepEqual(unlabeled,[]);
 const focusables=page.locator('#bo-u-modal button,#bo-u-modal input');
 await focusables.last().focus();await page.keyboard.press('Tab');
 assert(await page.locator('#bo-u-modal').evaluate(x=>x.contains(document.activeElement)),'Modal traps Tab');
 await page.keyboard.press('Escape');assert(await page.locator('#bo-u-modal').evaluate(x=>x.classList.contains('hidden')));
 // Stub authentication and delivery acknowledgement; verify both failure and success branches.
 await page.evaluate(()=>{
  window.BOphoneOTP={isVerified:()=>true};
  localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Test Parent',phone:'9999999999',state:'Kerala',city:'Kochi',address:'Test address',pin:'682001'}));
  const p=productsData.find(p=>!p.catalogHidden&&Number(p.price)>0);
  cart=[{...p,price:100,currency:'INR',qty:1,cartKey:p.id+'::default'}];updateCart();
  window.testIds=[];window.BOordersCloud={submit:async order=>{window.testIds.push(order.id);throw Error('Test connection unavailable');}};
  boU.checkout();
 });
 await page.locator('#bo-checkout-form button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('bo-order-status').textContent.includes('Receipt has not been confirmed'));
 assert.equal(await page.evaluate(()=>cart.length),1,'Failed receipt keeps cart');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-orders-v1')||'[]').length),0,'Failed receipt never creates confirmed order');
 await page.evaluate(()=>{window.BOordersCloud.submit=async order=>{window.testIds.push(order.id);return order.id;}});
 await page.locator('#bo-checkout-form button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#bo-u-content h2').textContent==='Order received');
 assert.equal(await page.evaluate(()=>cart.length),0,'Acknowledged order clears cart');
 assert.equal(await page.evaluate(()=>new Set(window.testIds).size),1,'Retries reuse the order ID');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-orders-v1'))[0].status),'Awaiting store confirmation');
 assert.deepEqual(errors,[],'No uncaught browser errors');
 console.log(JSON.stringify({result:'PASS',checks:18,initialGridCards:initial,totalCards:await page.locator('.product').count(),errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
