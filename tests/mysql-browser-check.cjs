/* Run only against backend/tests/browser_server.py and a throwaway *_test database. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:8001';
if(!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname)||process.env.MYSQL_BROWSER_TEST!=='1')throw Error('Set MYSQL_BROWSER_TEST=1 and use the local, isolated test server.');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(baseURL).origin?r.continue():r.abort());
 await page.goto(baseURL,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>productsData.some(p=>p.serverProduct&&p.id==='bottle'));
 await page.evaluate(()=>{window.BOphoneOTP={ready:true,isVerified:()=>true,getIdToken:async()=>'browser-only-test-token'};localStorage.setItem('babyone-profile-v1',JSON.stringify({name:'Test Parent',phone:'9999999999',state:'Kerala',city:'Kochi',address:'12 Test Street',pin:'682001'}));});
 await page.evaluate(()=>BOserver.openAdmin());
 await page.waitForSelector('#bo-server-query');
 await page.locator('#bo-server-query').fill('Baby bottle');await page.locator('#bo-server-search button').click();
 await page.getByRole('button',{name:/Baby bottle ·/}).click();
 await page.locator('#bo-server-edit input[name=price]').fill('600.00');
 await page.locator('#bo-server-edit input[name=stock]').fill('8');
 await page.locator('#bo-server-edit input[name=sale_enabled]').check();
 await page.locator('#bo-server-edit button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('bo-server-status').textContent==='Saved to MySQL.');
 assert.equal(await page.evaluate(()=>productsData.find(p=>p.id==='bottle').price),600,'Admin save refreshes the SQL-backed catalog');
 await page.locator('#bo-server-close').click();
 await page.evaluate(()=>{const p=productsData.find(p=>p.id==='bottle');cart=[{...p,price:1,size:'250 ml',qty:2,cartKey:'bottle::250%20ml'}];updateCart();boU.checkout();});
 await page.waitForSelector('#bo-checkout-form');
 assert((await page.locator('#bo-checkout-form button[type=submit]').textContent()).includes('1,260'),'Server total replaces tampered browser price');
 let first=true;
 await page.route('**/api/orders',async route=>{
  if(first&&route.request().method()==='POST'){first=false;const response=await route.fetch();assert.equal(response.status(),200);await route.abort();}
  else await route.continue();
 });
 await page.locator('#bo-checkout-form button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('bo-order-status').textContent.includes('Receipt has not been confirmed'));
 assert.equal(await page.evaluate(()=>cart.length),1,'Lost network response retains the bag');
 await page.locator('#bo-checkout-form button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#bo-u-content h2').textContent==='Order received');
 assert.equal(await page.evaluate(()=>cart.length),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-orders-v1'))[0].total),'1260.00');
 const saved=await page.evaluate(()=>BOserver.request('/me/orders'));
 assert.equal(saved.total,1,'Lost-response retry creates one order');
 const product=await page.evaluate(()=>BOserver.request('/catalog/products/bottle',{},false));
 assert.equal(product.variants[0].stock,6,'Stock deducted exactly once');
 await page.evaluate(()=>boU.home());await page.waitForFunction(()=>document.querySelector('#bo-u-content h3')?.textContent.includes('My Orders (1)'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',server:'Python + MySQL',checks:['admin product save','authoritative pricing','lost-response retry','one order','stock deduction','cross-device order history']}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
