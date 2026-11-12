// Browser contracts only. Every API call and upload is intercepted; no hosted writes or SMS.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const products=Array.from({length:205},(_,i)=>({id:'product-'+i,name:'Feeding bottle '+i,category_id:'feeding',category:'Feeding',description:'Browser test fixture',image:'assets/photo-0a9732be3078be31.webp',active:true,sale_enabled:true,version:1,metadata:{},variants:[{id:'sku-'+i,label:'',price:'100.00',stock:10,enabled:true}]}));
 let doc={key:'videos',version:1,value:{items:[{id:'existing-video',title:'Existing uploaded video',author:'@babyone',productId:'product-0',videoUrl:'https://example.com/existing.mp4',cover:'assets/photo-0a9732be3078be31.webp',published:true},{id:'old-youtube',title:'Preserved older video',youtubeId:'nl9W-C4bedo',author:'@babyone',productId:'',videoUrl:'',cover:'assets/photo-0a9732be3078be31.webp',published:false}]}};
 let uploads=0,saves=0,failUpload=false,conflict=false;const errors=[];
 const context=await browser.newContext();
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await context.route('**/api/**',async r=>{
  const url=new URL(r.request().url()),path=url.pathname,method=r.request().method();
  if(path==='/api/catalog/products'||path==='/api/admin/products'){let rows=products.filter(p=>p.name.toLowerCase().includes((url.searchParams.get('q')||'').toLowerCase()));const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);return r.fulfill({json:{items:rows.slice(offset,offset+limit),total:rows.length}})}
  if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'feeding',name:'Feeding',delivery_fee:'0.00'}]});
  if(path==='/api/me')return r.fulfill({json:{uid:'owner-fixture',phone:'+919999999999',is_admin:true}});
  if(path==='/api/me/register')return r.fulfill({json:{registered:true}});
  if(path==='/api/store/reviews')return r.fulfill({json:[]});
  if(path==='/api/store/content')return r.fulfill({json:{videos:{...doc,value:{items:doc.value.items.filter(i=>i.published)}},_catalog:{version:1}}});
  if(path==='/api/admin/overview')return r.fulfill({json:{total_customers:1,new_signups_today:1,total_traffic:0,active_users:0,traffic:[],growth:[],sources:[],recent_customers:[],note:'Fixture'}});
  if(path==='/api/admin/orders')return r.fulfill({json:{items:[],total:0}});
  if(path==='/api/admin/orders/BO-33478920')return r.fulfill({json:{id:'BO-33478920',status:'Order Confirmed',items:[{name:'Soft Cotton Feeding Scarf',image:'assets/photo-0a9732be3078be31.webp'},{name:'Item 2'},{name:'Item 3'},{name:'Item 4'}],total:'3196.00'}});
  if(path==='/api/admin/content/videos'){
   if(method==='GET')return r.fulfill({json:doc});
   const data=r.request().postDataJSON();if(conflict||data.expected_version!==doc.version)return r.fulfill({status:409,json:{detail:'Another session updated this section. Reload before saving.'}});
   saves++;doc={key:'videos',version:doc.version+1,value:data.value};return r.fulfill({json:doc});
  }
  if(path==='/api/admin/media'){
   if(failUpload)return r.fulfill({status:503,json:{detail:'Upload failed. Your published video was not changed.'}});
   uploads++;const cover=r.request().postDataBuffer().includes(Buffer.from('cover.png'));return r.fulfill({status:201,json:{url:cover?'assets/photo-0b02ae5543c03240.webp':'https://example.com/new.mp4'}});
  }
  return r.fulfill({status:401,json:{detail:'Sign in with your verified phone number.'}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-decline]').click();
 await page.evaluate(async()=>{window.BOphoneOTP={getIdToken:async()=>'browser-fixture'};localStorage.setItem('babyone-owner-reels-v1',JSON.stringify([{id:'4LI-KoJIIZQ',title:'Device saved video',productId:'product-1',cover:'assets/photo-0a9732be3078be31.webp'}]));await BOserver.checkIdentity();await boAdmin.openDashboard();boAdmin.tab('video-manager')});
 await page.waitForSelector('.bo-video-library-row');assert.equal(await page.locator('.bo-video-library-row').count(),2);
 await page.locator('#bo-video-new').click();const form=page.locator('#bo-video-upload-form');assert.equal(await form.locator('input[type=url],input[name=url],input[name=cover_url],input[name=productId]').count(),0);
 await page.locator('#bo-video-product-search').click();await page.waitForFunction(()=>document.querySelectorAll('#bo-video-product-options button').length===100);
 await page.locator('#bo-video-product-more').click();await page.waitForFunction(()=>document.querySelectorAll('#bo-video-product-options button').length===200);
 await page.locator('#bo-video-product-more').click();await page.waitForFunction(()=>document.querySelectorAll('#bo-video-product-options button').length===205);
 assert(await page.locator('#bo-video-product-more').isHidden());
 await page.locator('#bo-video-product-search').fill('bottle 204');await page.waitForFunction(()=>document.querySelectorAll('#bo-video-product-options button').length===1);
 await page.locator('#bo-video-product-search').press('ArrowDown');await page.locator('#bo-video-product-search').press('Enter');assert((await page.locator('.bo-video-selected-product').textContent()).includes('Feeding bottle 204'));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX7sAAAAASUVORK5CYII=','base64');
 await form.locator('[name=title]').fill('New upload linked to bottle 204');await form.locator('[name=video]').setInputFiles({name:'new.mp4',mimeType:'video/mp4',buffer:Buffer.from('00000020ftypisom-video-fixture')});await form.locator('[name=cover]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert(await page.locator('#bo-admin-layer').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'/workspace/work/review/video-upload-'+width+'.png'})}
 await page.locator('#bo-video-save').click();await page.waitForFunction(()=>document.querySelector('#bo-video-library-status').textContent.includes('saved and published'));
 assert.equal(uploads,2);assert.equal(doc.value.items.length,3);assert.equal(doc.value.items[2].productId,'product-204');assert.equal(doc.value.items[1].youtubeId,'nl9W-C4bedo');
 // Editing a title needs no replacement upload; failures keep the saved record and allow retry.
 let row=page.locator('.bo-video-library-row').filter({hasText:'New upload linked'});await row.getByRole('button',{name:'Edit',exact:true}).click();await form.locator('[name=title]').fill('Edited upload');await page.locator('#bo-video-save').click();await page.waitForFunction(()=>document.querySelector('#bo-video-editor').hidden);assert.equal(uploads,2);assert.equal(doc.value.items[2].title,'Edited upload');
 await page.locator('.bo-video-library-row').filter({hasText:'Edited upload'}).getByRole('button',{name:'Edit',exact:true}).click();await form.locator('[name=video]').setInputFiles({name:'replacement.mp4',mimeType:'video/mp4',buffer:Buffer.from('replacement-fixture')});failUpload=true;const beforeSaves=saves;await page.locator('#bo-video-save').click();await page.waitForFunction(()=>document.querySelector('#bo-video-save-status').textContent.includes('Upload failed'));assert.equal(saves,beforeSaves);assert.equal(doc.value.items[2].videoUrl,'https://example.com/new.mp4');failUpload=false;await page.locator('#bo-video-cancel').click();
 await page.locator('.bo-video-library-row').filter({hasText:'Edited upload'}).getByRole('button',{name:'Edit',exact:true}).click();conflict=true;await form.locator('[name=title]').fill('Must not overwrite');await page.locator('#bo-video-save').click();await page.waitForFunction(()=>document.querySelector('#bo-video-save-status').textContent.includes('Another session'));assert.equal(doc.value.items[2].title,'Edited upload');conflict=false;await page.locator('#bo-video-cancel').click();
 await page.locator('.bo-video-device-recovery summary').click();await page.getByRole('button',{name:'Recover video',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#bo-video-upload-form input[name=title]')?.value==='Device saved video');await page.locator('#bo-video-save').click();await page.waitForFunction(()=>document.querySelector('#bo-video-editor').hidden);assert.equal(doc.value.items.find(i=>i.title==='Device saved video').youtubeId,'4LI-KoJIIZQ');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('babyone-owner-reels-v1')).length),1);
 await page.evaluate(()=>boAdmin.close());
 // Card and detail sharing, native cancellation, clipboard fallback and a separate deep-link visit.
 await page.evaluate(()=>{window.sharedData=null;Object.defineProperty(navigator,'share',{configurable:true,value:async d=>window.sharedData=d})});
 await page.evaluate(()=>openAllProducts());const shareButton=page.locator('#plp-grid .bo-product-share').first();const sharedId=await shareButton.getAttribute('data-product-id');await shareButton.click();assert(await page.locator('#product-modal').evaluate(e=>e.classList.contains('hidden')),'Card sharing does not open product modal');const data=await page.evaluate(()=>window.sharedData);assert.equal(new URL(data.url).searchParams.get('product'),sharedId);
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}}));await shareButton.click();assert.equal(await page.locator('#bo-share-sheet').count(),0);
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copiedProductLink=text}})});await shareButton.click();await page.waitForFunction(()=>!!window.copiedProductLink);assert.equal(await page.evaluate(()=>window.copiedProductLink),data.url);
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}})});await shareButton.click();await page.waitForSelector('#bo-share-sheet');assert((await page.locator('#bo-share-url').inputValue()).includes('product='));await page.locator('.bo-share-close').click();
 const shared=await context.newPage();shared.on('pageerror',e=>errors.push(e.message));await shared.goto(data.url,{waitUntil:'networkidle'});await shared.waitForSelector('#product-modal:not(.hidden)');assert((await shared.locator('#modal-product-content').textContent()).includes(products.find(p=>p.id===sharedId).name));assert.equal(await shared.locator('.bo-detail-share').count(),1);await shared.close();
 await page.evaluate(()=>showSection('home-page'));await page.locator('#bo-track-id').fill('BO-33478920');await page.locator('#bo-track-form button').click();await page.waitForSelector('.bo-track-details');assert((await page.locator('.bo-track-details').textContent()).includes('₹3,196'));assert((await page.locator('.bo-track-details h3').textContent()).includes('+3 item(s)'));assert.equal(await page.locator('#bo-track-result img').count(),1);assert.equal(await page.locator('#bo-track-result .bo-track-pill').textContent(),'Order Confirmed');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('#home-track-order').screenshot({path:'/workspace/work/review/tracking-reference-'+width+'.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);const input=await page.locator('#bo-track-id').boundingBox(),button=await page.locator('#bo-track-form button').boundingBox();assert(button.y>input.y+input.height,'Tracking button is beneath the field')}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: upload-only video form, 205-product search/pagination, keyboard selection, preserved videos, edit without re-upload, upload/conflict failures, native sharing/copy fallback/deep link, reference tracking and mobile fit.');
})().catch(e=>{console.error(e);process.exit(1)});
