// Real API/MySQL email login with an explicitly enabled isolated mail fixture. Never use a hosted URL.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8082';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],firebase=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('gstatic.com/firebasejs'))firebase.push(r.url())});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-decline]').click();await page.waitForFunction(()=>BOauth.initialized()&&productsData.some(p=>p.id==='bottle'));
 await page.evaluate(()=>{addToCart('bottle');boU.login()});
 async function verify(email,name='Parent',link=false){
  await page.waitForSelector('#bo-email-start');await page.locator('#bo-email-start [name=name]').fill(name);await page.locator('#bo-email-start [name=email]').fill(email);await page.locator('#bo-email-start [name=phone]').fill('9645762324');await page.locator('#bo-email-start input[type=checkbox]').check();await page.locator('#bo-email-start button[type=submit]').click();await page.waitForSelector('#bo-email-confirm');
  const code=await page.evaluate(async email=>(await (await fetch('/__test__/mail-code?email='+encodeURIComponent(email))).json()).code,email);
  const wrong=code==='000000'?'111111':'000000';await page.locator('#bo-email-confirm [name=code]').fill(wrong);await page.locator('#bo-email-confirm button').click();await page.waitForFunction(()=>document.querySelector('#bo-email-status')?.textContent.includes('incorrect'));
  await page.locator('#bo-email-confirm [name=code]').fill(code);await page.locator('#bo-email-confirm button').click();await page.waitForFunction(()=>BOauth.isEmailSession()&&document.querySelector('#bo-u-modal').classList.contains('hidden'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-profile-v1')).email),email);
  assert(!(await page.evaluate(()=>document.cookie)).includes('babyone_session'),'Session cookie is HttpOnly');
 }
 await verify('parent@example.com');await page.waitForFunction(()=>cart.length===1);assert.equal(await page.evaluate(()=>BOverifiedIdentity.is_admin),false);
 const customerUid=await page.evaluate(()=>BOverifiedIdentity.uid);
 await page.evaluate(()=>boU.edit());await page.waitForSelector('#bo-edit');const edit=page.locator('#bo-edit');for(const [key,value] of Object.entries({name:'Email Parent',phone:'7034476592',address:'12 Test Street',city:'Kochi',pin:'673661'}))await edit.locator('[name='+key+']').fill(value);await edit.locator('[name=state]').selectOption('Kerala');await edit.locator('button[type=submit]').click();await page.waitForSelector('#bo-my-orders-list');
 await page.evaluate(()=>{boU.close();openProductModal('bottle')});await page.locator('.bo-detail-sticky-buy').click();await page.waitForSelector('#bo-checkout-form');assert((await page.locator('#bo-checkout-bill').textContent()).includes('109.00'));assert((await page.locator('#bo-checkout-bill').textContent()).includes('One fixed delivery charge'));
 await page.screenshot({path:'/workspace/work/review/email-login-checkout-mobile.png'});
 await page.evaluate(()=>BOauth.logout());await page.waitForFunction(()=>!BOauth.isEmailSession());await page.evaluate(()=>boU.login());await verify('other@example.com','Another Parent');assert.equal(await page.evaluate(()=>cart.length),0,'Different email does not receive the previous customer’s bag');assert.notEqual(await page.evaluate(()=>BOverifiedIdentity.uid),customerUid);
 await page.evaluate(()=>BOauth.logout());await page.waitForFunction(()=>!BOauth.isEmailSession());
 // Link a signed-in legacy owner, prove a delivered email code, and perform the authorised cutover.
 await page.evaluate(async()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'browser-only-test-token',signOut:async()=>{}};await BOserver.checkIdentity();BOauth.login(true)});
 await verify('babyonestores@gmail.com','Store Owner',true);assert.equal(await page.evaluate(()=>BOverifiedIdentity.uid),'owner-test-uid');assert.equal(await page.evaluate(()=>BOserver.isAdmin()),true);
 assert.equal(await page.evaluate(async()=>(await (await fetch('/api/auth/config')).json()).phone_available),false);
 await page.locator('#bo-server-manage').click();await page.waitForSelector('#bo-shared-overview .bo-kpi');await page.evaluate(()=>boAdmin.tab('email-login'));await page.waitForSelector('#bo-admin-panel-email-login #bo-connect-gmail');assert((await page.locator('#bo-admin-panel-email-login').textContent()).includes('Email login active'));
 await page.evaluate(()=>boAdmin.tab('catalogue'));await page.waitForSelector('[data-edit]');await page.locator('[data-edit]').first().click();await page.waitForSelector('#bo-shared-product');await page.locator('#bo-shared-product details').evaluateAll(items=>items.forEach(item=>item.open=true));await page.locator('#bo-shared-product [name=detail_material]').fill('Owner-entered fixture material');await page.locator('#bo-product-draft').click();await page.waitForFunction(()=>document.querySelector('#bo-product-save-status')?.textContent.includes('Saved for all customers'));await page.evaluate(()=>{boAdmin.close();openProductModal('bottle')});assert((await page.locator('.bo-product-specifications').textContent()).includes('Owner-entered fixture material'));await page.evaluate(()=>closeProductModal());
 firebase.length=0;await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>BOauth.isEmailSession()&&BOverifiedIdentity?.is_admin);assert.deepEqual(firebase,[],'Retired Firebase SDKs are not requested after reload');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.evaluate(()=>boU.home());await page.waitForSelector('#bo-my-orders-list');assert(await page.locator('button[onclick="BOauth.logout()"]').isVisible());
 assert.deepEqual(errors,[]);await context.close();await browser.close();console.log('PASS: real MySQL email codes and cookie sessions, wrong-code handling, mobile profile save and ₹109 checkout, per-account bag isolation, linked owner dashboard access, cookie restoration and Firebase cutover without SDK requests. No actual mail or payment sent.');
})().catch(e=>{console.error(e);process.exit(1)});
