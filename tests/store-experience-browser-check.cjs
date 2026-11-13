// Presentation and account behavior use local fixtures. No real orders, messages or payments.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let preferences={phone:'+919999999999',order_updates:false,cart_reminders:false,consent_at:null},writes=0,reads=0,acknowledged=0,reviewWrites=0,owner=true;
  const product={id:'babyone-hospital-bag-payment-check',name:'Hospital Bag · ₹1 Payment Check',category_id:'new-born',category:'New Born',description:'A live payment check. No physical product supplied.',image:'assets/hospital-bag-payment-check.svg',active:true,sale_enabled:true,version:1,metadata:{subcategory:'Hospital Bags',live_gateway_check:true},variants:[{id:'check-option',label:'Payment check only',price:'1.00',stock:5,enabled:true}]};
  const orders=[{id:'BO-NEW-ORDER',dateISO:new Date().toISOString(),items:[{id:product.id,name:product.name,image:product.image,price:'1.00',qty:1}],name:'Parent',phone:'9999999999',payment:'RAZORPAY',payment_status:'paid',status:'Order Confirmed',total:'1.00',delivery:'0.00',subtotal:'1.00',kind:'purchase',allowed_next_statuses:['Packed']}];
  let activity={new_count:1,latest_event_id:9,latest_order_id:'BO-NEW-ORDER',seen_event_id:0};
  await context.addInitScript(()=>localStorage.setItem('babyone-analytics-consent','no'));
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await page.route('**/api/**',r=>{
   const path=new URL(r.request().url()).pathname,method=r.request().method();
   if(path==='/api/auth/config')return r.fulfill({json:{phone_available:true,email_available:false,login_method:'phone'}});
   if(path==='/api/catalog/products'||path==='/api/admin/products')return r.fulfill({json:{items:[product],total:1}});
   if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'new-born',name:'New Born',delivery_fee:'60'}]});
   if(path==='/api/store/content')return r.fulfill({json:{banners:{version:1,value:{items:[{id:'catalogue-store',image:'assets/hospital-bag-payment-check.svg',published:true}]}}}});
   if(path==='/api/store/reviews'||path==='/api/admin/reviews')return r.fulfill({json:[]});
   if(path==='/api/me/reviews'){assert.equal(method,'POST');reviewWrites++;return r.fulfill({status:201,json:{id:'fixture-review',published:false,message:'Thank you. Your review is saved for the store to review before publishing.'}})}
   if(path==='/api/me')return r.fulfill({json:{uid:'fixture-owner',phone:'+919999999999',is_admin:owner}});
   if(path==='/api/me/register')return r.fulfill({json:{registered:true}});
   if(path==='/api/me/cart/activity')return r.fulfill({json:{tracked:preferences.cart_reminders}});
   if(path==='/api/me/cart')return r.fulfill({json:{items:[],version:0,subtotal:'0',ordered:false}});
   if(path==='/api/me/whatsapp'){
    if(method==='PUT'){writes++;preferences={...preferences,...r.request().postDataJSON(),consent_at:new Date().toISOString()}}else reads++;
    return r.fulfill({json:preferences});
   }
   if(path==='/api/store/contact')return r.fulfill({json:{whatsapp_automation_active:false}});
   if(path==='/api/payments/config')return r.fulfill({json:{razorpay_enabled:true,razorpay_live_enabled:true,payment_mode:'live',test_mode:false,upi_enabled:true}});
   if(path==='/api/checkout/quote')return r.fulfill({json:{items:orders[0].items,subtotal:'1.00',delivery:'0.00',total:'1.00',deliveryBreakdown:[{category:'Payment check · no delivery',rate:'0.00'}],cod_allowed:false,payment_mode:'live',quote_hash:'a'.repeat(64)}});
   if(path==='/api/admin/order-activity'){
    if(method==='PUT'){acknowledged++;assert.equal(r.request().postDataJSON().last_event_id,9);activity={...activity,new_count:0,seen_event_id:9}}
    return r.fulfill({json:activity});
   }
   if(path==='/api/admin/orders')return r.fulfill({json:{items:orders,total:orders.length}});
   if(path==='/api/admin/overview')return r.fulfill({json:{total_customers:1,new_signups_today:0,total_traffic:0,active_users:0,traffic:[],growth:[],sources:[],recent_customers:[],note:''}});
   if(path==='/api/admin/whatsapp')return r.fulfill({json:{enabled:false,configured:false,missing:['WHATSAPP_ACCESS_TOKEN'],counts:{},connection:{ready:false,message:'Automatic sending is disabled.'},templates:{cart:'cart',order:'order',language:'en_US'},messages:[]}});
   if(path==='/api/admin/notifications/email')return r.fulfill({json:{enabled:true,connected:false,missing:['GMAIL_OAUTH_CLIENT_ID'],recipient:'babyonestores@gmail.com',counts:{pending:1},messages:[]}});
   if(path==='/api/admin/notifications/email/check')return r.fulfill({json:{ready:false,message:'Connect the store Gmail account in Login & email first.'}});
   if(path==='/api/orders'||path.includes('/payments/razorpay/'))throw Error('This UI test cannot place orders or open payments');
   return r.fulfill({status:401,json:{detail:'Fixture sign-in required'}});
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>productsData.some(p=>p.id==='babyone-hospital-bag-payment-check'&&p.serverProduct));
  const hero=await page.locator('#hero').boundingBox();assert(Math.abs(hero.width/hero.height-(width<761?1.48:2.15))<.05,'Hero uses its responsive frame');await page.screenshot({path:'/workspace/work/review/refined-home-'+width+'.png'});
  await page.evaluate(async()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'fixture-only'};localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Parent',phone:'9999999999',address:'12 Test Street',city:'Mukkam',state:'Kerala',pin:'673661'}));await BOserver.checkIdentity()});
  await page.waitForSelector('#bo-server-manage .bo-order-count');assert.equal(await page.locator('#bo-server-manage .bo-order-count').textContent(),'1');
  await page.evaluate(()=>selectSubcategoryTile('New Born','Hospital Bags'));await page.waitForSelector('#bo-plp-banner img');assert((await page.locator('#bo-plp-banner img').getAttribute('src')).includes('hospital-bag-payment-check'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  await page.screenshot({path:'/workspace/work/review/premium-catalogue-'+width+'.png'});
  await page.evaluate(()=>openProductModal('babyone-hospital-bag-payment-check'));
  await page.waitForFunction(min=>document.querySelector('.bo-product-photo-frame')?.getBoundingClientRect().height>=min,width<761?285:390);const frame=await page.locator('.bo-product-photo-frame').boundingBox();assert(frame.width>0&&frame.height>=(width<761?285:390),'Product photo has a larger responsive frame');
  assert(await page.locator('#product-modal-shell').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Product page fits its viewport');
  await page.screenshot({path:'/workspace/work/review/refined-product-'+width+'.png'});await page.evaluate(()=>closeProductModal());
  await page.evaluate(()=>{cart=[{id:'regular-bag-fixture',name:'Saved regular product',qty:2,price:10}];window.keptBag=JSON.stringify(cart);buyProductNow('babyone-hospital-bag-payment-check')});await page.waitForSelector('#bo-checkout-form');assert.equal(await page.evaluate(()=>JSON.stringify(cart)===keptBag),true,'Buying the isolated payment check keeps the regular bag');
  async function checkout(){await page.evaluate(()=>{boU.close();const p=productsData[0];cart=[{...p,qty:1,size:p.variants[0].size,selectedVariant:0,cartKey:p.id}];boU.checkout()});await page.waitForSelector('#bo-checkout-form')}
  await checkout();await page.waitForSelector('.bo-whatsapp-choices');
  await page.locator('[name=bo_wa_orders]').check();assert.equal(await page.locator('[name=bo_wa_cart]').isChecked(),false);
  await page.evaluate(()=>BOcartSync.saveCheckoutChoices());assert.equal(writes,1);
  await checkout();await page.waitForTimeout(200);assert.equal(await page.locator('#bo-checkout-form .bo-whatsapp-choices').count(),0,'Saved consent is not repeated in checkout');
  const readsAfter=reads;await page.waitForTimeout(80);assert.equal(reads,readsAfter,'Hidden saved consent does not cause repeated reads');
  assert.equal(await page.locator('.bo-pay-method,.bo-upi-app,.bo-upi-help,.bo-upi-steps,.bo-upi-lite,.bo-upi-selection').count(),0,'Payment is selected only inside Razorpay');
  assert.equal(await page.locator('.bo-pay-action-bar button[type=submit]').count(),1);
  assert((await page.locator('.bo-pay-action-bar .bo-pay-amount strong').textContent()).includes('1.00'));
  assert(await page.locator('#plp-sort').isHidden(),'No filters on a subcategory page');
  assert((await page.locator('#bo-plp-banner img').boundingBox()).height>=180);
  await page.locator('.bo-pay-action-bar').scrollIntoViewIfNeeded();
  assert(await page.locator('#bo-u-modal>div').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:'/workspace/work/review/direct-checkout-'+width+'.png'});
  await page.evaluate(o=>BOconfirmation.show({...o,items:[{name:'Cotton Swaddle',qty:1,price:'10.00',image:'assets/favicon.svg'}],name:'Parent',address:'12 Test Road',city:'Mukkam',state:'Kerala',pin:'673661',subtotal:'10.00',delivery:'60.00',total:'70.00'}),orders[0]);
  assert((await page.locator('.bo-receipt-delivery').textContent()).includes('5–6 days'));
  assert((await page.locator('.bo-receipt-bill').textContent()).includes('70.00'));
  assert(await page.locator('#bo-confirmation-page').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:'/workspace/work/review/full-receipt-'+width+'.png'});
  await page.evaluate(()=>BOconfirmation.close());
  await page.evaluate(()=>{boU.close();showSection('home-page')});await page.locator('.bo-review-invitation button').click();await page.locator('#review-name').fill('A parent');await page.locator('#review-message').fill('Our real purchase feedback.');await page.locator('#site-review-form-wrap button[type=submit]').click();await page.waitForSelector('button:has-text("Review saved")');assert.equal(reviewWrites,1);assert.equal(await page.locator('#reviews-track .review-card').count(),0,'Moderated feedback is not published immediately');
  await page.evaluate(()=>boAdmin.openDashboard());await page.waitForSelector('#bo-admin-panel-overview.active');assert.equal(acknowledged,0,'Opening the overview leaves new orders unread');assert(await page.locator('.bo-admin-top').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Dashboard toolbar fits');
  assert.equal(await page.locator('.bo-overview-metrics .bo-kpi').count(),4);assert.equal(await page.locator('.bo-chart-empty').count(),2,'Empty charts describe missing activity honestly');
  await page.locator('[data-days="30"]').click();await page.waitForSelector('[data-days="30"][aria-pressed=true]');
  await page.screenshot({path:'/workspace/work/review/premium-dashboard-'+width+'.png'});
  async function tab(key){if(width<=900)await page.locator('#bo-dashboard-menu').click();await page.locator('.bo-admin-nav [data-panel='+key+']').click()}
  await page.locator('[data-workspace-go=orders]').click();await page.waitForFunction(()=>!document.querySelector('#bo-server-manage .bo-order-count'));assert(acknowledged>=1);
  await tab('reviews');await page.waitForSelector('.bo-review-layout-preview');assert((await page.locator('.bo-review-layout-preview').textContent()).includes('not customer reviews'));
  await tab('whatsapp');await page.waitForSelector('#bo-owner-email-status');assert((await page.locator('#bo-owner-email-status').textContent()).includes('Gmail connection required'));
  await page.locator('#bo-email-connection-check').click();await page.waitForFunction(()=>document.querySelector('#bo-owner-email-status [role=status]').textContent.includes('Connect the store Gmail'));
  owner=false;await page.evaluate(()=>BOserver.checkIdentity());assert.equal(await page.locator('#bo-server-manage').count(),0,'Customer accounts never see the owner badge');
  assert.deepEqual(errors,[]);await context.close();
 }
 await browser.close();console.log('PASS: direct Razorpay checkout, full-page receipt, premium dashboard, ₹1 action row, larger catalogue banner, persisted opt-in without repeats or request loops, private new-order badges, moderated reviews, labelled admin previews and honest notification readiness at 320/390/1440. No messages or payments sent.');
})().catch(e=>{console.error(e);process.exit(1)});
