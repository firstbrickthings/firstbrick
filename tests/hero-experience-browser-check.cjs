// Presentation and API fixtures only. No hosted writes, messages, or payments.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8081';
// The test uses tiny local H.264 clips, never a customer upload or published video.
for(const [name,size,color] of [['desktop','640x360','0xb46386'],['mobile','360x640','0x5385a6']]){
 const file='/workspace/work/hero-'+name+'-fixture.mp4';if(!fs.existsSync(file))require('node:child_process').execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c='+color+':s='+size+':r=12','-t','2','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-y',file]);
}
const desktop='/api/media/11111111-1111-4111-8111-111111111111',mobile='/api/media/22222222-2222-4222-8222-222222222222';
const poster='assets/photo-189406759232e71b.webp',mobilePoster='assets/favicon.svg';
const initial=[{id:'existing-image',image:poster,published:true}];
let doc={key:'hero',version:4,value:{items:structuredClone(initial)}},uploads=0,failOnce=true,publishAttempts=0;
const product={id:'hero-fixture',name:'Hero fixture product',category_id:'feeding',category:'Feeding',image:poster,active:true,sale_enabled:true,metadata:{},variants:[{id:'hero-size',label:'Standard',price:'10.00',stock:5,enabled:true}]};
async function routes(context,solo=false){
 await context.addInitScript(()=>localStorage.setItem('babyone-analytics-consent','no'));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await context.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method();
  if([desktop,mobile].includes(path))return r.fulfill({contentType:'video/mp4',body:fs.readFileSync('/workspace/work/hero-'+(path===mobile?'mobile':'desktop')+'-fixture.mp4')});
  if(path==='/api/auth/config')return r.fulfill({json:{phone_available:true,email_available:false,login_method:'phone'}});
  if(path==='/api/catalog/products'||path==='/api/admin/products')return r.fulfill({json:{items:[product],total:1}});
  if(path==='/api/catalog/categories')return r.fulfill({json:[{id:'feeding',name:'Feeding',delivery_fee:'60'}]});
  if(path==='/api/store/content')return r.fulfill({json:{hero:solo?{...doc,value:{items:doc.value.items.filter(i=>i.mediaType==='video')}}:doc}});
  if(path==='/api/store/reviews')return r.fulfill({json:[]});
  if(path==='/api/store/contact')return r.fulfill({json:{whatsapp_automation_active:false}});
  if(path==='/api/payments/config')return r.fulfill({json:{razorpay_enabled:true,payment_mode:'live',test_mode:false,upi_enabled:true}});
  if(path==='/api/me')return r.fulfill({json:{uid:'hero-owner-fixture',phone:'+919999999999',is_admin:true}});
  if(path==='/api/me/register')return r.fulfill({json:{registered:true}});
  if(path==='/api/me/cart')return r.fulfill({json:{items:[],version:0,subtotal:'0',ordered:false}});
  if(path==='/api/me/whatsapp')return r.fulfill({json:{phone:'+919999999999',order_updates:false,cart_reminders:false}});
  if(path==='/api/admin/order-activity')return r.fulfill({json:{new_count:0,latest_event_id:0}});
  if(path==='/api/admin/orders')return r.fulfill({json:{items:[],total:0}});
  if(path==='/api/admin/overview')return r.fulfill({json:{total_customers:1,new_signups_today:0,total_traffic:0,active_users:0,traffic:[],growth:[],sources:[],recent_customers:[]}});
  if(path==='/api/admin/content/hero'){
   if(method==='GET')return r.fulfill({json:doc});
   assert.equal(method,'PUT');publishAttempts++;const data=r.request().postDataJSON();assert.equal(data.expected_version,doc.version);
   if(failOnce){failOnce=false;return r.fulfill({status:503,json:{detail:'Temporary save failure. Retry.'}})}
   doc={key:'hero',version:doc.version+1,value:data.value};return r.fulfill({json:doc});
  }
  if(path==='/api/admin/media'){
   uploads++;const body=r.request().postDataBuffer();let url;
   if(body.includes(Buffer.from('desktop.mp4')))url=desktop;
   else if(body.includes(Buffer.from('mobile.mp4')))url=mobile;
   else if(body.includes(Buffer.from('mobile.png')))url=mobilePoster;
   else url=poster;
   return r.fulfill({status:201,json:{url}});
  }
  if(method!=='GET')throw Error('Unexpected write in isolated hero test: '+path);
  return r.fulfill({status:401,json:{detail:'Fixture sign-in required'}});
 });
}
async function fit(page,width,height){
 await page.setViewportSize({width,height});await page.evaluate(()=>{boU.close();showSection('home-page');window.scrollTo(0,0)});
 await page.waitForFunction(()=>!!document.getElementById('hero').style.getPropertyValue('--bo-hero-top'));
 await page.waitForFunction(()=>{const h=document.getElementById('hero'),r=h.getBoundingClientRect(),bottom=parseFloat(h.style.getPropertyValue('--bo-hero-bottom'))||0;return Math.abs(r.bottom+bottom-innerHeight)<2});
 const rect=await page.locator('#hero').boundingBox();assert(Math.abs(rect.x)<1&&Math.abs(rect.width-width)<1,'Hero fills screen width');
 assert.equal(await page.locator('#hero').evaluate(e=>getComputedStyle(e).borderRadius),'0px');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'No horizontal scrolling');
 await page.screenshot({path:'/workspace/work/review/fullscreen-hero-'+width+'.png'});
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await routes(context);await page.goto(base,{waitUntil:'networkidle'});
 for(const size of [[320,800],[390,844],[768,950],[1440,950],[1920,1080],[390,700]])await fit(page,...size);
 await page.evaluate(()=>{window.promoImageBefore=document.querySelector('#promo-slides-1 img');nextAdSlide(1)});assert(await page.evaluate(()=>promoImageBefore.isConnected),'Promo transitions keep loaded images in place');
 await page.setViewportSize({width:1440,height:950});await page.evaluate(async()=>{window.BOphoneOTP={isVerified:()=>true,getIdToken:async()=>'fixture'};await BOserver.checkIdentity();await boAdmin.openDashboard();boAdmin.tab('hero')});
 await page.waitForSelector('#bo-hero-add-video');await page.locator('#bo-hero-add-video').click();assert.equal(await page.locator('[name=media_type]').inputValue(),'video');
 await page.locator('#bo-media-form [name=file]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('cover fixture')});
 await page.locator('#bo-media-form [name=image_mobile]').setInputFiles({name:'mobile.png',mimeType:'image/png',buffer:Buffer.from('mobile cover fixture')});
 // Assign stable upload names to keep this fixture independent of workstation paths.
 await page.locator('#bo-media-form [name=video]').setInputFiles({name:'desktop.mp4',mimeType:'video/mp4',buffer:fs.readFileSync('/workspace/work/hero-desktop-fixture.mp4')});
 await page.locator('#bo-media-form [name=video_mobile]').setInputFiles({name:'mobile.mp4',mimeType:'video/mp4',buffer:fs.readFileSync('/workspace/work/hero-mobile-fixture.mp4')});
 await page.locator('#bo-media-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#bo-admin-panel-hero .bo-work-status').textContent.includes('Temporary'));
 assert.equal(uploads,4);await page.locator('#bo-media-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#bo-admin-panel-hero .bo-work-status').textContent.includes('Published for all customers'));
 assert.equal(uploads,4,'Retry reuses completed uploads');assert.equal(publishAttempts,2);assert.deepEqual(doc.value.items[0],initial[0]);
 const video=doc.value.items[1];assert.equal(video.mediaType,'video');assert.equal(video.videoUrl,desktop);assert.equal(video.videoMobileUrl,mobile);assert.equal(video.image,poster);assert.equal(video.imageMobile,mobilePoster);
 assert((await page.locator('#bo-media-list').textContent()).includes('Video 2'));
 assert.deepEqual(errors,[]);await context.close();
 const playbackContext=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'no-preference'}),watch=await playbackContext.newPage();watch.on('pageerror',e=>errors.push(e.message));await routes(playbackContext,true);await watch.goto(base,{waitUntil:'networkidle'});
 await watch.waitForSelector('#hero video');await watch.waitForFunction(()=>{const v=document.querySelector('#hero video');return v.readyState>=2&&!v.paused});
 assert.equal(await watch.locator('#hero video').getAttribute('src'),desktop);assert(await watch.locator('#hero video').evaluate(v=>v.muted&&v.loop));
 await watch.locator('#bo-hero-playback').click();assert(await watch.locator('#hero video').evaluate(v=>v.paused));await watch.locator('#bo-hero-playback').click();await watch.waitForFunction(()=>!document.querySelector('#hero video').paused);
 await fit(watch,390,844);await watch.waitForFunction(url=>document.querySelector('#hero video').getAttribute('src')===url,mobile);assert.equal(await watch.locator('#hero video').getAttribute('poster'),mobilePoster);
 await watch.waitForFunction(()=>!document.querySelector('#hero video').paused);await watch.evaluate(()=>window.scrollTo(0,document.getElementById('hero').offsetTop+document.getElementById('hero').clientHeight+200));await watch.waitForFunction(()=>document.querySelector('#hero video').paused);
 await watch.evaluate(()=>window.scrollTo(0,0));await watch.waitForFunction(()=>!document.querySelector('#hero video').paused);await watch.emulateMedia({reducedMotion:'reduce'});await watch.waitForFunction(()=>document.querySelector('#hero video').paused);assert(await watch.locator('#bo-hero-playback').isHidden());
 assert.deepEqual(errors,[]);await playbackContext.close();
 // Long clips use the media ended event; clock jumps must never cut them at 60 seconds.
 const longFile='/workspace/work/hero-long-fixture.mp4',longUrl='/api/media/33333333-3333-4333-8333-333333333333';
 if(!fs.existsSync(longFile))require('node:child_process').execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x5385a6:s=640x360:r=12','-t','70','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-y',longFile]);
 const sequenceContext=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'no-preference'}),sequence=await sequenceContext.newPage();await routes(sequenceContext);await sequenceContext.route('**'+longUrl,r=>{const bytes=fs.readFileSync(longFile),range=r.request().headers().range,match=/bytes=(\d+)-(\d*)/.exec(range||'');if(!match)return r.fulfill({contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'},body:bytes});const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;return r.fulfill({status:206,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':'bytes '+start+'-'+end+'/'+bytes.length},body:bytes.subarray(start,end+1)})});sequence.on('pageerror',e=>errors.push(e.message));await sequence.clock.install();await sequence.goto(base,{waitUntil:'networkidle'});
 await sequence.evaluate(({longUrl,desktop,poster})=>{heroSlidesData.splice(0,heroSlidesData.length,{mediaType:'video',videoUrl:longUrl,img:poster},{img:poster},{mediaType:'video',videoUrl:desktop,img:poster});renderHero();window.scrollTo(0,0)},{longUrl,desktop,poster});
 await sequence.waitForFunction(()=>{const v=document.querySelector('#hero .active video');return v?.readyState>=2&&!v.paused&&v.duration>60});
 await sequence.clock.fastForward(65000);assert.equal(await sequence.evaluate(()=>activeHero),0,'Long video is not cut off by a slide timer');
 await sequence.evaluate(()=>{document.querySelector('#hero .active video').currentTime=18});await sequence.waitForFunction(()=>{const v=document.querySelector('#hero .active video');return !v.seeking&&v.currentTime>=18});await sequence.locator('#bo-hero-playback').click();await sequence.clock.fastForward(4000);await sequence.locator('#bo-hero-playback').click();await sequence.waitForFunction(()=>!document.querySelector('#hero .active video').paused);assert(await sequence.locator('#hero .active video').evaluate(v=>v.currentTime>=18),'Pause and resume retain playback position');
 await sequence.evaluate(()=>window.scrollTo(0,document.getElementById('hero').offsetTop+document.getElementById('hero').clientHeight+200));await sequence.waitForFunction(()=>document.querySelector('#hero .active video').paused);const position=await sequence.locator('#hero .active video').evaluate(v=>v.currentTime);await sequence.evaluate(()=>window.scrollTo(0,0));await sequence.waitForFunction(()=>!document.querySelector('#hero .active video').paused);assert(await sequence.locator('#hero .active video').evaluate((v,position)=>v.currentTime>=position,position),'Returning to the hero resumes the clip');
 await sequence.evaluate(()=>{const v=document.querySelector('#hero .active video');v.currentTime=v.duration-.25});await sequence.waitForFunction(()=>activeHero===1);assert.equal(await sequence.locator('#hero .active video').count(),0,'Image follows the completed video');await sequence.clock.fastForward(3100);await sequence.waitForFunction(()=>activeHero===2);await sequence.waitForFunction(()=>activeHero===0);assert.deepEqual(errors,[]);await sequenceContext.close();
 await browser.close();console.log('PASS: full-width/full-height hero at 320–1920px, mobile viewport resizing, existing images preserved, shared video/cover publishing and upload retry, correct portrait source, real muted looping playback, pause/resume, offscreen resume, full video/image sequencing beyond 60 seconds and reduced-motion poster fallback. No hosted writes or payments.');
})().catch(e=>{console.error(e);process.exit(1)});
