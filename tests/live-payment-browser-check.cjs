// Live mode contract only: all gateway calls are browser fixtures, no real charge.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const scenario of ['paid','verification-failed','wrong-mode-key']){
  const context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage();let verified=0,created=0,opened=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const product={id:'bottle',name:'Live checkout bottle',category_id:'feeding',category:'Feeding',description:'Fixture',image:'assets/favicon.svg',active:true,sale_enabled:true,version:1,metadata:{},variants:[{id:'sku-fixture',label:'',price:'100.00',stock:5,enabled:true}]};
  const order={id:'BO-LIVE-FIXTURE',name:'Fixture parent',phone:'9999999999',address:'12 Test Street',city:'Kochi',state:'Kerala',pin:'682001',payment:'RAZORPAY',payment_mode:'live',payment_status:'pending',status:'Awaiting Payment',items:[{id:'bottle',name:'Live checkout bottle',price:'100.00',qty:1,image:'assets/favicon.svg'}],subtotal:'100.00',delivery:'30.00',total:'130.00',deliveryBreakdown:[]};
  await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
   if(path==='/api/catalog/products')return r.fulfill({json:{items:[product],total:1}});
   if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'feeding',name:'Feeding',delivery_fee:'30'}]});
   if(path==='/api/store/content')return r.fulfill({json:{}});if(path==='/api/store/reviews')return r.fulfill({json:[]});
   if(path==='/api/payments/config')return r.fulfill({json:{razorpay_enabled:true,razorpay_test_enabled:false,razorpay_live_enabled:true,test_mode:false,payment_mode:'live',upi_enabled:true}});
   if(path==='/api/checkout/quote')return r.fulfill({json:{...order,quote_hash:'a'.repeat(64)}});
   if(path==='/api/orders'){created++;assert.equal(r.request().postDataJSON().payment,'RAZORPAY');return r.fulfill({json:order})}
   if(path.endsWith('/status'))return r.fulfill({json:{order,payment_status:'pending',payment_mode:'live',test_mode:false}});
   if(path.endsWith('/checkout'))return r.fulfill({json:{order,payment_mode:'live',test_mode:false,payment_status:'pending',checkout:{key:scenario==='wrong-mode-key'?'rzp_test_wrong':'rzp_live_fixture',order_id:'order_livefixture',amount:13000,currency:'INR'}}});
   if(path.endsWith('/verify')){verified++;return scenario==='verification-failed'?r.fulfill({status:400,json:{detail:'Signature failed'}}):r.fulfill({json:{payment_status:'paid',order:{...order,status:'Order Confirmed',payment_status:'paid'}}})}
   return r.fulfill({status:401,json:{detail:'Fixture sign-in required'}});
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>productsData.some(p=>p.serverProduct));await page.locator('[data-decline]').click();
  await page.evaluate(()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'fixture'};localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Fixture Parent',phone:'9999999999',address:'12 Test Street',city:'Kochi',state:'Kerala',pin:'682001'}));window.Razorpay=function(opts){window.fixtureCheckout=opts;this.on=()=>{};this.open=()=>{window.fixtureOpened=true;opts.handler({razorpay_order_id:'order_livefixture',razorpay_payment_id:'pay_livefixture',razorpay_signature:'a'.repeat(64)})}};cart=[{...productsData[0],qty:1,size:'',cartKey:'bottle'}];updateCart();boU.checkout()});
  await page.waitForSelector('#bo-checkout-form');assert.equal(await page.locator('.bo-pay-test-badge').count(),0);assert.equal(await page.locator('.bo-upi-app').count(),6);assert.equal(await page.locator('#bo-upi-help,.bo-upi-steps,.bo-upi-lite').count(),0);
  await page.locator('label:has(#bo-upi-google_pay)').click();assert((await page.locator('#bo-checkout-form button[type=submit]').textContent()).includes('Google Pay'));
  await page.locator('#bo-checkout-form button[type=submit]').click();
  if(scenario==='paid'){await page.waitForFunction(()=>document.querySelector('#bo-u-content h2').textContent==='Order received');assert.equal(await page.evaluate(()=>cart.length),0);assert.equal(verified,1);assert.equal(await page.evaluate(()=>fixtureCheckout.config.display.blocks.payments.instruments[0].apps[0]),'google_pay');}
  else{await page.waitForFunction(()=>document.querySelector('#bo-order-status').textContent.includes('Receipt has not been confirmed'));assert.equal(await page.evaluate(()=>cart.length),1);if(scenario==='wrong-mode-key'){assert.equal(await page.evaluate(()=>!!window.fixtureOpened),false);assert.equal(verified,0)}}
  assert.equal(created,1);assert.deepEqual(errors,[]);await context.close();
 }
 await browser.close();console.log('PASS: live checkout labels, mobile UPI app selection, verified success, unverified failure keeps cart, test key rejected in live checkout; no real payments.');
})().catch(e=>{console.error(e);process.exit(1)});
