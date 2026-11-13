// UI contract tests only; provider signatures/capture are exercised by the Python tests.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']});
 for(const scenario of ['paid','verification-failed','cancelled','upi-paid-google_pay','upi-paid-phonepe','upi-paid-paytm','upi-disabled']){
  const upiScenario=scenario.startsWith('upi-paid'), app=upiScenario?scenario.slice('upi-paid-'.length):null;
  const context=await browser.newContext(),page=await context.newPage();let verified=0,created=0;
  const product={id:'bottle',name:'Test bottle',category_id:'feeding',category:'Feeding',description:'Test fixture',image:'assets/favicon.svg',active:true,sale_enabled:true,version:1,metadata:{},variants:[{id:'sku-test',label:'',price:'100.00',stock:5,enabled:true}]};
  const order={id:'BO-testfixture',name:'Test Parent',phone:'9999999999',address:'12 Test Street',city:'Kochi',state:'Kerala',pin:'682001',payment:'RAZORPAY',payment_status:'pending',status:'Awaiting Payment',items:[{id:'bottle',name:'Test bottle',price:'100.00',qty:1,image:'assets/favicon.svg'}],subtotal:'100.00',delivery:'60.00',deliveryBreakdown:[{category:'Feeding',rate:'60.00'}],total:'160.00'};
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(baseURL).origin?r.continue():r.abort());
  await page.route('**/api/**',r=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/store/content')return r.fulfill({json:{}});
   if(path==='/api/store/reviews')return r.fulfill({json:[]});
   if(path==='/api/catalog/products')return r.fulfill({json:{items:[product],total:1}});
   if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'feeding',name:'Feeding',delivery_fee:'60.00'}]});
   if(path==='/api/payments/config')return r.fulfill({json:{razorpay_test_enabled:true,test_mode:true,upi_enabled:upiScenario,upi_availability:upiScenario?'available':'unavailable'}});
   if(path==='/api/checkout/quote')return r.fulfill({json:{...order,quote_hash:'a'.repeat(64)}});
   if(path==='/api/orders'){const body=r.request().postDataJSON();assert.equal(body.payment,'RAZORPAY');assert(!('total' in body));created++;return r.fulfill({json:order});}
   if(path.endsWith('/checkout'))return r.fulfill({json:{order,payment_status:'pending',razorpay_order_id:'order_fixture',checkout:{key:'rzp_test_fixture',order_id:'order_fixture',amount:16000,currency:'INR'}}});
   if(path.endsWith('/verify')){verified++;return scenario==='verification-failed'?r.fulfill({status:400,json:{detail:'Invalid signature'}}):r.fulfill({json:{payment_status:'paid',order:{...order,status:'Order Confirmed',payment_status:'paid'}}});}
   if(path.endsWith('/status'))return r.fulfill({json:{order,payment_status:'pending'}});
   return r.fulfill({status:401,json:{detail:'Test sign-in required'}});
  });
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>productsData.some(p=>p.serverProduct));await page.locator('[data-decline]').click();
  await page.evaluate(scenario=>{
   window.BOphoneOTP={ready:true,isVerified:()=>true,getIdToken:async()=>'fixture-token'};
   localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Test Parent',phone:'9999999999',address:'12 Test Street',city:'Kochi',state:'Kerala',pin:'682001'}));
   window.Razorpay=function(options){window.checkoutOptions=options;this.on=()=>{};this.open=()=>{if(scenario==='cancelled')options.modal.ondismiss();else options.handler({razorpay_order_id:'order_fixture',razorpay_payment_id:'pay_fixture',razorpay_signature:'0'.repeat(64)})}};
   const p=productsData[0];cart=[{...p,qty:1,size:'',cartKey:p.id}];updateCart();boU.checkout();
  },scenario);
  await page.waitForSelector('#bo-checkout-form');
  assert.equal(await page.locator('#bo-checkout-form input[type=password]').count(),0,'No PIN collection in checkout');
  assert.equal(await page.locator('.bo-upi-lite,.bo-upi-help,.bo-upi-steps,.bo-upi-selection').count(),0,'No repeated instructions below the app choices');
  if(upiScenario){
   await page.locator('label:has(#bo-payment-RAZORPAY_UPI)').click();
   assert(await page.locator('#bo-pay-panel-RAZORPAY_UPI').isVisible());
   assert.equal(await page.locator('.bo-upi-app').count(),6);
   await page.locator('label:has(#bo-upi-'+app+')').click();
  }else{
   assert.equal(await page.locator('#bo-payment-RAZORPAY_UPI').count(),0,'Unavailable UPI is not offered');
   assert(await page.locator('#bo-payment-RAZORPAY').isChecked(),'Cards remain available');
  }
  assert(!(await page.locator('#bo-checkout-form button[type=submit]').isDisabled()));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  }
  await page.locator('#bo-checkout-form button[type=submit]').click();
  if(['paid','upi-disabled'].includes(scenario)||upiScenario){
   await page.waitForFunction(()=>document.querySelector('#bo-u-content h2').textContent==='Order received');assert.equal(await page.evaluate(()=>cart.length),0);assert.equal(verified,1);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-orders-v1'))[0].payment_status),'paid');
  }else{await page.waitForFunction(()=>document.querySelector('#bo-order-status').textContent.includes('Receipt has not been confirmed'));assert.equal(await page.evaluate(()=>cart.length),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-orders-v1')||'[]').length),0);}
  if(upiScenario){
   const display=await page.evaluate(()=>checkoutOptions.config.display);
   assert.equal(display.blocks.payments.instruments[0].method,'upi');
   assert.deepEqual(display.blocks.payments.instruments[0].apps,[app]);
   assert.deepEqual(display.sequence,['block.payments']);
   assert.equal(display.preferences.show_default_blocks,false,'One block prevents duplicated UPI options');
   assert.deepEqual(display.blocks.payments.instruments.map(i=>i.method),['upi','card','netbanking','wallet'],'Fallback channels remain in the same block');
  }
  assert.equal(created,1);await context.close();
 }
 await browser.close();console.log('PASS: payment tiles, Google Pay/PhonePe/Paytm preferences, single payment panel, desktop/mobile, unavailable-UPI fallback, verified success, rejection and cancellation.');
})().catch(e=>{console.error(e);process.exit(1)});
