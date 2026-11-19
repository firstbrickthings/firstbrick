/* One compact search entry point in the header and mobile navigation. */
(function(){
 'use strict';
 function start(){
  // Mirror the published cover photos; later owner-selected URLs remain authoritative.
  const cachedCovers={
   "https://cdn.shopify.com/s/files/1/0068/6135/7171/files/muslin-swaddle-wrap-icy-sorbet-3993217.jpg?v=1792994418&width=900": "assets/category-photos/new-born-25bbf45d1145.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/81uW7CQf-5L.jpg?v=1785733857&width=900": "assets/category-photos/feeding-deea7e060ffc.jpg",
   "https://cdn.shopify.com/s/files/1/0557/7683/7717/files/lemon_romper_baby_2.jpg?v=1790948165&width=900": "assets/category-photos/clothing-dc8a441e5ac2.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/51zqAED3crL.jpg?v=1777134043&width=900": "assets/category-photos/toys-learning-11801b91dd25.jpg",
   "https://cdn.shopify.com/s/files/1/0068/6135/7171/files/26pcs-cream-maroon-teddy-love-new-born-baby-girlboy-gift-hamper-all-season-wear-clothes-gift-hamper-box-8271927.webp?v=1778299912&width=900": "assets/category-photos/hospital-kit-79c629651b39.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/71CeSALUUxL._SL1500_4aa062ee-b70e-4861-8977-b1daf4c382d8.jpg?v=1791610313&width=900": "assets/category-photos/cradles-rockers-9da6f90bf578.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/61emCf6U9cL.jpg?v=1777135878&width=900": "assets/category-photos/bath-skincare-162d9c5954d8.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/1_2af79a9e-1f58-4fa2-8abd-d66866c6697b.jpg?v=1793785452&width=900": "assets/category-photos/travel-gear-b9bff70a50b1.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/81slH2m3R_L.jpg?v=1785733855&width=900": "assets/category-photos/mom-care-76bcf4e60b53.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/01_fded5599-8d05-4b96-8569-731901748e02.jpg?v=1784102160&width=900": "assets/category-photos/travel-0533976ff9d6.jpg",
   "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/9_4c796619-f675-4aad-aaa4-c373f9113a4e.jpg?v=1793860804&width=900": "assets/category-photos/ride-on-a0df68321474.jpg"
};
  const categories=document.getElementById('cat-container');
  function cacheCovers(){
   for(const image of categories?.querySelectorAll('.cat-tile>img')||[]){const local=cachedCovers[image.getAttribute('src')];if(local)image.src=local}
  }
  if(categories){new MutationObserver(cacheCovers).observe(categories,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});cacheCovers()}
  const header=document.querySelector('.bo-store-header'),home=document.getElementById('home-page'),input=document.getElementById('search-input'),wrap=input?.closest('.search-wrap');
  if(!header||!home||!input||!wrap)return;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const hint=document.createElement('span');hint.className='bo-search-hint';hint.setAttribute('aria-hidden','true');
  hint.append('Search for ');const keyword=document.createElement('span');keyword.className='bo-search-keyword';hint.appendChild(keyword);
  input.after(hint);wrap.classList.add('bo-search-suggestions');
  const words=['rompers','bottle','skincare','toys','ride-on','diapers'];let index=0,timer=0,fade=0,frame=0,lastHeight=0;
  keyword.textContent=words[0];
  function cancelFade(){clearTimeout(fade);fade=0;keyword.classList.remove('is-fading')}
  function rotate(){
   if(document.hidden||input===document.activeElement||input.value||reduced.matches||getComputedStyle(wrap).visibility==='hidden')return;
   keyword.classList.add('is-fading');
   fade=setTimeout(()=>{keyword.textContent=words[index=(index+1)%words.length];keyword.classList.remove('is-fading');fade=0},220);
  }
  function motion(){clearInterval(timer);cancelFade();if(!reduced.matches&&!document.hidden)timer=setInterval(rotate,3200)}
  input.addEventListener('focus',cancelFade);input.addEventListener('input',cancelFade);
  reduced.addEventListener('change',motion);document.addEventListener('visibilitychange',motion);motion();
  function sync(){
   frame=0;document.body.classList.toggle('bo-home-hero',!home.classList.contains('hidden')&&!home.hidden);
   document.body.classList.toggle('bo-header-scrolled',scrollY>24);
   const height=header.getBoundingClientRect().height;
   if(height!==lastHeight){lastHeight=height;document.body.style.setProperty('--bo-store-header-height',height+'px')}
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(sync)}
  wrap.addEventListener('focusin',()=>{if(document.body.classList.contains('bo-home-hero')){document.body.classList.add('bo-search-open');schedule()}});
  wrap.addEventListener('focusout',()=>setTimeout(()=>{if(!wrap.contains(document.activeElement)){document.body.classList.remove('bo-search-open');schedule()}},0));
  new ResizeObserver(schedule).observe(header);
  new MutationObserver(schedule).observe(home,{attributes:true,attributeFilter:['class','hidden']});
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);sync();
  function close(){document.getElementById('search-results')?.classList.add('hidden');input.blur();document.body.classList.remove('bo-search-open');schedule()}
  function open(){if(document.body.classList.contains('bo-home-hero'))document.body.classList.add('bo-search-open');schedule();input.focus({preventScroll:true});if(input.value.trim())handleSearch(input.value)}
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
  const appTab=window.babyoneAppTab;
  if(appTab)window.babyoneAppTab=function(tab){if(tab==='search')open();else close();return appTab.apply(this,arguments)};
  window.BOstoreSearch={open,close};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
