// Browser fixtures only. Never create a real payment, request OTP, or change hosted data.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<761,hasTouch:width<761,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let owner=false,lastQuote=null;
  const products=[{id:'bottle',name:'Purchase fixture bottle',category_id:'feeding',category:'Feeding',image:'assets/favicon.svg',description:'Fixture',active:true,sale_enabled:true,version:1,metadata:{},variants:[{id:'bottle-small',label:'Small',price:'100.00',stock:0,enabled:true},{id:'bottle-medium',label:'Medium',price:'250.00',stock:2,enabled:true},{id:'bottle-large',label:"Large (parent's pack)",price:'500.00',stock:4,enabled:true}]},{id:'draft',name:'Unapproved fixture',category_id:'feeding',category:'Feeding',image:'assets/favicon.svg',description:'Fixture',active:true,sale_enabled:false,version:1,metadata:{},variants:[{id:'draft-size',label:'One size',price:'300.00',stock:10,enabled:true}]},{id:'diaper',name:'Fixture diaper pants',category_id:'feeding',category:'Feeding',image:'assets/favicon.svg',description:'Fixture',active:true,sale_enabled:true,version:1,metadata:{subcategory:'Diapers'},variants:[{id:'diaper-m',label:'M',price:'100.00',stock:0,enabled:true},{id:'diaper-l',label:'L',price:'200.00',stock:2,enabled:true}]}];
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
   if(['/api/catalog/products','/api/admin/products'].includes(path))return r.fulfill({json:{items:products,total:products.length}});
   if(path==='/api/admin/products/bottle'&&r.request().method()==='PUT'){const data=r.request().postDataJSON();Object.assign(products[0],data,{version:products[0].version+1});return r.fulfill({json:products[0]})}
   if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'feeding',name:'Feeding',delivery_fee:'0.00'}]});
   if(path==='/api/store/content')return r.fulfill({json:{}});if(path==='/api/store/reviews')return r.fulfill({json:[]});
   if(path==='/api/payments/config')return r.fulfill({json:{razorpay_enabled:true,payment_mode:'live',test_mode:false,upi_enabled:true}});
   if(path==='/api/checkout/quote'){lastQuote=r.request().postDataJSON();const lines=lastQuote.items.map(line=>{const p=products.find(p=>p.variants.some(v=>v.id===line.variant_id)),v=p.variants.find(v=>v.id===line.variant_id);return {name:p.name,size:v.label,qty:line.quantity,price:v.price,image:p.image}});const subtotal=lines.reduce((s,l)=>s+Number(l.price)*l.qty,0);return r.fulfill({json:{items:lines,subtotal:String(subtotal),delivery:'99',total:String(subtotal+99),deliveryBreakdown:[{category:'Flat delivery per order',mode:'flat',rate:'99.00'}],quote_hash:'a'.repeat(64),payment_mode:'live'}})}
   if(path==='/api/me'&&owner)return r.fulfill({json:{uid:'owner-fixture',phone:'+919999999999',is_admin:true}});
   if(path==='/api/me/register'&&owner)return r.fulfill({json:{registered:true}});
   if(path==='/api/me/cart'&&owner)return r.fulfill({json:{items:[],version:0,subtotal:'0',ordered:false}});
   if(path==='/api/admin/orders')return r.fulfill({json:{items:[],total:0}});
   if(path==='/api/admin/overview')return r.fulfill({json:{total_customers:1,new_signups_today:0,total_traffic:0,active_users:0,traffic:[],growth:[],sources:[],recent_customers:[]}});
   if(path==='/api/orders')throw Error('This test must not submit an order');
   return r.fulfill({status:401,json:{detail:'Fixture sign-in required'}});
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-decline]')[width<761?'tap':'click']();await page.waitForFunction(()=>productsData.some(p=>p.id==='bottle'&&p.serverProduct));assert.equal(await page.locator('.bo-product-share').count(),0,'No card sharing buttons');
  await page.locator('#best-sellers .product').first()[width<761?'tap':'click']();await page.evaluate(()=>{closeProductModal();openProductModal('bottle')});assert.equal(await page.locator('#product-modal').evaluate(e=>e.classList.contains('hidden')),false,'A quick close and reopen still works');assert.equal(await page.evaluate(()=>productsData.find(p=>p.id==='bottle').selectedVariant),1,'First in-stock option selected');assert.equal(await page.locator('.bo-variant-choice').first().isDisabled(),true);
  await page.locator('.bo-variant-choice').nth(2)[width<761?'tap':'click']();assert.equal(await page.evaluate(()=>productsData.find(p=>p.id==='bottle').selectedVariant),2);assert((await page.locator('#bo-detail-bar-price').textContent()).includes('500'),'Quick size change refreshes the displayed price');
  if(width<761){
   // Touch scrolling must not carry fixed purchasing controls with the glass content panel.
   for(const height of [950,700]){
    await page.setViewportSize({width,height});
    for(const position of [0,180,500,100000]){
     await page.locator('#product-modal-shell').evaluate((shell,top)=>shell.scrollTop=top,position);
     const geometry=await page.locator('#bo-detail-sticky-bar').evaluate(bar=>{const rect=bar.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,height:rect.height,viewportHeight:innerHeight,viewportWidth:innerWidth,scroll:document.getElementById('product-modal-shell').scrollTop}});
     assert(Math.abs(geometry.bottom-geometry.viewportHeight)<=1,'Purchase controls stay at viewport bottom while content scrolls: '+JSON.stringify(geometry));
     assert(geometry.top>=0&&geometry.left>=-1&&geometry.right<=geometry.viewportWidth+1,'Entire purchase bar stays visible');
     assert(await page.locator('.bo-detail-sticky-cart').evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'Add to Cart remains tappable while scrolling');
    }
   }
   await page.setViewportSize({width,height:950});
   await page.locator('#product-modal-shell').evaluate(shell=>shell.scrollTop=500);
  }
  const add=page.locator(width<761?'.bo-detail-sticky-cart':'.product-detail-add');await add[width<761?'tap':'click']();assert.equal(await page.evaluate(()=>cart[0].serverVariantId),'bottle-large');assert.equal(await page.evaluate(()=>cart[0].price),500);assert.equal(await page.evaluate(()=>cart[0].qty),1);
  assert(await page.locator('#toast.show').isVisible());assert(Number(await page.locator('#toast').evaluate(e=>getComputedStyle(e).zIndex))>Number(await page.locator('#product-modal').evaluate(e=>getComputedStyle(e).zIndex)),'Feedback above product page');
  for(let i=0;i<4;i++)await add[width<761?'tap':'click']();assert.equal(await page.evaluate(()=>cart[0].qty),4,'Adding respects the chosen option stock');
  await page.locator('#product-modal-shell>button[onclick="closeProductModal()"]')[width<761?'tap':'click']();
  await page.locator(width<761?'#babyone-bottom-nav [data-app-tab=cart]':'button[aria-label=Cart]')[width<761?'tap':'click']();assert(await page.locator('#cart-drawer .drawer').isVisible());
  await page.locator('.cart-qty-control button').last()[width<761?'tap':'click']();assert.equal(await page.evaluate(()=>cart[0].qty),4);await page.locator('.cart-qty-control button').first()[width<761?'tap':'click']();assert.equal(await page.evaluate(()=>cart[0].qty),3);await page.locator('#cart-drawer button[aria-label=Close]')[width<761?'tap':'click']();
  await page.evaluate(()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'fixture'};localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Parent',phone:'9999999999',address:'12 Example Street',city:'Kochi',state:'Kerala',pin:'682001'}));openProductModal('bottle');babyoneChooseVariant('bottle',2)});
  await page.locator(width<761?'.bo-detail-sticky-buy':'.product-detail-buy')[width<761?'tap':'click']();await page.waitForSelector('#bo-checkout-form');assert((await page.locator('#bo-checkout-bill').textContent()).includes('One fixed delivery charge applies'));assert(await page.locator('#cart-drawer').isHidden());assert(await page.locator('#product-modal').isHidden());assert.equal(lastQuote.items[0].variant_id,'bottle-large');assert.equal(lastQuote.items[0].quantity,3,'Buy uses the bag quantity without adding another unit');
  await page.evaluate(()=>{boU.close();openProductModal('draft')});assert((await page.locator('.bo-purchase-availability').textContent()).includes('currently unavailable'));assert(!((await page.locator('#modal-product-content').textContent()).includes('Try test payment')));assert.equal(await page.locator(width<761?'.bo-detail-sticky-buy':'.product-detail-buy').isDisabled(),true);
  await page.evaluate(()=>{closeProductModal();openProductModal('diaper')});assert.equal(await page.locator('.bo-variant-choice').count(),2,'Use actual server diaper options only');assert.equal(await page.evaluate(()=>productsData.find(p=>p.id==='diaper').selectedVariant),1);await page.locator(width<761?'.bo-detail-sticky-cart':'.product-detail-add')[width<761?'tap':'click']();assert.equal(await page.evaluate(()=>cart.find(p=>p.id==='diaper').serverVariantId),'diaper-l');
  await page.evaluate(()=>{closeProductModal();cart=[];updateCart()});owner=true;await page.evaluate(()=>BOserver.checkIdentity());await page.locator('#bo-server-manage')[width<761?'tap':'click']();await page.waitForSelector('#bo-shared-overview .bo-kpi');if(width<761)await page.locator('#bo-dashboard-menu').tap();await page.locator('#bo-admin-layer [data-panel=catalogue]')[width<761?'tap':'click']();await page.waitForSelector('[data-edit]');await page.locator('[data-edit]').first()[width<761?'tap':'click']();await page.locator('#bo-shared-product [name=option_price]').nth(1).fill('275');await page.locator('#bo-shared-product button[type=submit]')[width<761?'tap':'click']();await page.waitForFunction(()=>document.querySelector('#bo-product-save-status')?.textContent.includes('Saved for all customers'));await page.evaluate(()=>{boAdmin.close();openProductModal('bottle')});assert((await page.locator('#bo-detail-bar-price').textContent()).includes('275'),'Mobile dashboard save updates customer pricing');
  await page.evaluate(()=>{closeProductModal();localStorage.removeItem('babyone-profile-v1');BOphoneOTP.isVerified=()=>false;buyProductNow('bottle')});await page.waitForFunction(()=>document.querySelector('#bo-u-content h2')?.textContent==='Before Checkout');assert.equal(await page.evaluate(()=>cart.length),1,'Guest buy preserves the bag and asks for sign-in');
  assert.deepEqual(errors,[]);await page.screenshot({path:'/workspace/work/review/purchase-buttons-'+width+'.png'});await context.close();
 }
 await browser.close();console.log('PASS: desktop/mobile buy-to-checkout, add-to-cart, correct size/price, stock caps, visible feedback, bag controls, genuine diaper options, draft availability, card share removal and dashboard price editing.');
})().catch(e=>{console.error(e);process.exit(1)});
