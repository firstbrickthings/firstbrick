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
  const toggle=document.getElementById('bo-search-toggle'),panel=document.getElementById('bo-mobile-search'),input=panel?.querySelector('input');
  if(!toggle||!panel||!input)return;
  const mobile=matchMedia('(max-width:899px)');
  function close(restoreFocus=false){
   panel.hidden=true;toggle.setAttribute('aria-expanded','false');
   document.getElementById('search-results-mobile')?.classList.add('hidden');
   if(restoreFocus&&mobile.matches)toggle.focus({preventScroll:true});
  }
  function open(){
   if(!mobile.matches){document.getElementById('search-input')?.focus({preventScroll:true});return}
   panel.hidden=false;toggle.setAttribute('aria-expanded','true');input.focus({preventScroll:true});
   if(input.value.trim())handleSearch(input.value);
  }
  toggle.addEventListener('click',()=>panel.hidden?open():close(true));
  panel.querySelector('.bo-search-close').addEventListener('click',()=>close(true));
  panel.addEventListener('click',event=>{if(event.target.closest('.bo-search-result'))close()});
  document.addEventListener('click',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target)&&!event.target.closest('#babyone-bottom-nav [data-app-tab="search"]'))close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true)}});
  mobile.addEventListener('change',()=>close());
  const appTab=window.babyoneAppTab;
  if(appTab)window.babyoneAppTab=function(tab){if(tab==='search')open();else close();return appTab.apply(this,arguments)};
  window.BOstoreSearch={open,close};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
