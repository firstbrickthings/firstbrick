// Browser presentation fixtures only. No real SMS, email, orders or payments.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,390,1440]){
 const context=await browser.newContext({viewport:{width,height:900},isMobile:width<761,hasTouch:width<761,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let orderRequests=0,paymentRequests=0;
 const products=[{id:'swaddle',name:'Cotton Swaddle',category_id:'new-born',category:'New Born',description:'Fixture',image:'assets/favicon.svg',active:true,sale_enabled:true,version:1,metadata:{subcategory:'Swaddles & Sleepsuits'},variants:[{id:'swaddle-v',label:'Standard',price:'10',stock:5,enabled:true}]}];
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
 if(path==='/api/catalog/products')return r.fulfill({json:{items:products,total:products.length}});
 if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'new-born',name:'New Born',delivery_fee:'0'}]});
 if(path==='/api/store/content')return r.fulfill({json:{}});if(path==='/api/store/reviews')return r.fulfill({json:[]});
 if(path==='/api/payments/config')return r.fulfill({json:{razorpay_enabled:true,razorpay_live_enabled:true,payment_mode:'live',test_mode:false,upi_enabled:true}});
 if(path==='/api/checkout/quote'){const body=r.request().postDataJSON(),subtotal=body.items.reduce((n,i)=>n+10*i.quantity,0);return r.fulfill({json:{items:body.items.map(i=>({id:'swaddle',name:'Cotton Swaddle',qty:i.quantity,price:'10',image:'assets/favicon.svg'})),subtotal:String(subtotal),delivery:'60.00',total:String(subtotal+60),deliveryBreakdown:[{category:'Standard delivery',mode:'policy',rate:'60.00',bulky:false,free_threshold:'599.00'}],cod_allowed:false,delivery_pending:false,payment_mode:'live',quote_hash:'a'.repeat(64)}})}
 if(path==='/api/orders'){orderRequests++;return r.fulfill({json:{id:'BO-SAVED-FIXTURE',payment:'RAZORPAY',payment_status:'pending',items:[{name:'Cotton Swaddle',qty:1,price:'10',image:'assets/favicon.svg'}],subtotal:'10.00',delivery:'99.00',deliveryBreakdown:[],total:'109.00'}})}if(path.includes('/payments/razorpay/')){paymentRequests++;return r.fulfill({status:503,json:{detail:'A payment must not open before the saved total is reviewed.'}})}
 return r.fulfill({status:401,json:{detail:'Fixture login required'}});
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-decline]').click();await page.waitForFunction(()=>productsData.some(p=>p.id==='swaddle'));
 await page.evaluate(()=>selectSubcategoryTile('New Born','Swaddles & Sleepsuits'));await page.waitForSelector('#plp-grid .product');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'Store fits viewport');
 const geometry=await page.evaluate(()=>{const top=document.querySelector('#plp-view').getBoundingClientRect().top,grid=document.querySelector('#plp-grid').getBoundingClientRect().top;const banner=document.querySelector('#bo-plp-banner'),artwork=banner&&!banner.hidden?banner.getBoundingClientRect().height+parseFloat(getComputedStyle(banner).marginBottom):0;return {header:grid-top-artwork,top,grid,artwork}});
 if(width<761){assert(geometry.header<=145,'Mobile category header stays compact: '+JSON.stringify(geometry));assert(await page.locator('#plp-eyebrow').isHidden());assert(await page.locator('#plp-sort').isVisible());assert.equal(await page.locator('#plp-title').textContent(),'Swaddles & Sleepsuits');await page.screenshot({path:'/workspace/work/review/compact-category-'+width+'.png'})}
 await page.evaluate(()=>{BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'fixture'};localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Parent',phone:'9999999999',email:'parent@example.com',address:'12 Test Road',city:'Kochi',state:'Kerala',pin:'673661'}));buyProductNow('swaddle')});
 await page.waitForSelector('#bo-checkout-form');assert(await page.locator('.bo-checkout-summary').isVisible());assert(await page.locator('.bo-checkout-delivery').isVisible());assert((await page.locator('#bo-checkout-bill').textContent()).includes('70.00'));assert((await page.locator('#bo-checkout-bill').textContent()).includes('Free from'));
 assert.equal(await page.locator('#bo-payment-COD').count(),0,'Unavailable COD is omitted');assert.equal(await page.locator('.bo-upi-app').count(),6);assert.equal(await page.locator('#bo-checkout-form [name=gender]').count(),0);
 const unlabeled=await page.locator('.bo-address-grid input,.bo-address-grid select,.bo-address-grid textarea').evaluateAll(fields=>fields.filter(f=>!f.labels.length).map(f=>f.name));assert.deepEqual(unlabeled,[]);
 assert(await page.locator('#bo-u-modal>div').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Checkout has no horizontal overflow');
 await page.locator('.bo-upi-app').filter({has:page.locator('#bo-upi-phonepe')}).click();assert((await page.locator('#bo-checkout-form button[type=submit]').textContent()).includes('PhonePe'));
 await page.locator('.bo-payments').scrollIntoViewIfNeeded();await page.screenshot({path:'/workspace/work/review/glass-checkout-'+width+'.png'});
 await page.locator('#bo-checkout-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#bo-order-status')?.textContent.includes('keeps its original prices'));assert.equal(paymentRequests,0,'Saved total must be reviewed before opening payment');assert.equal(orderRequests,1);assert((await page.locator('#bo-checkout-form button[type=submit]').textContent()).includes('109.00'));assert((await page.locator('#bo-checkout-bill').textContent()).includes('109.00'));
 assert.deepEqual(errors,[]);await context.close();
 }await browser.close();console.log('PASS: compact mobile category header, responsive glass layout, accessible delivery fields, ₹70 policy checkout, UPI app selection and hidden unavailable COD at 320/390/1440 widths.');
})().catch(e=>{console.error(e);process.exit(1)});
