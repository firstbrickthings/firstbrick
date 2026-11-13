/* Published catalogue artwork and owner-only, server-counted new-order badges. */
(function(){
 'use strict';
 let frame=0,activity=null,owner=null,epoch=0,checking=false,acknowledging=false;
 const api=(path,options={})=>BOserver.request(path,options);
 function categoryBanner(){
  const listing=document.getElementById('plp-view');if(!listing)return;
  const specific=typeof navState!=='undefined'&&navState.subcategory&&navState.subcategory!=='All';listing.classList.toggle('bo-subcategory-view',!!specific);
  let banner=document.getElementById('bo-plp-banner');
  if(!banner){banner=document.createElement('figure');banner.id='bo-plp-banner';banner.className='bo-plp-banner';banner.innerHTML='<img alt="" loading="eager" decoding="async">';listing.querySelector('.bo-plp-heading').after(banner)}
  const published=window.BOpublicContent?.banners?.value.items||[];
  const custom=published.find(b=>b.id.startsWith('catalogue-')&&b.published!==false);
  const category=typeof navState!=='undefined'?navState.category:'';
  const categoryImage=categoriesData.find(c=>c.name===category)?.img;
  const origin=custom?.image||published.find(b=>b.published!==false&&b.image)?.image||categoryImage||heroSlidesData.find(s=>s.img)?.img||'';
  const image=banner.querySelector('img');banner.hidden=!origin;
  if(origin&&image.getAttribute('src')!==origin){
   image.onload=()=>{banner.hidden=false;banner.classList.toggle('bo-banner-contained',image.naturalWidth/image.naturalHeight<1.6)};
   image.onerror=()=>{banner.hidden=true};image.src=origin;
   if(image.complete&&image.naturalWidth)image.onload();
  }
  const check=productsData.find(p=>p.id==='babyone-hospital-bag-payment-check');
  const newborn=categoriesData.find(c=>c.name==='New Born');
  if(check&&!check.catalogHidden&&check.category==='New Born'&&!window.BOsharedCategories&&newborn&&!(newborn.subcategories||[]).includes('Hospital Bags')){newborn.subcategories=[...(newborn.subcategories||[]),'Hospital Bags'];renderCategories()}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;categoryBanner()})}
 function drawBadge(){
  const count=Math.max(0,Number(activity?.new_count)||0),text=count>99?'99+':String(count);
  for(const button of document.querySelectorAll('#bo-server-manage,.bo-admin-nav [data-panel=orders]')){
   let badge=button.querySelector('.bo-order-count');
   if(!owner?.is_admin||!count){badge?.remove();button.removeAttribute('aria-label');continue}
   if(!badge){badge=document.createElement('span');badge.className='bo-order-count';badge.setAttribute('aria-hidden','true');button.appendChild(badge)}
   badge.textContent=text;button.setAttribute('aria-label',(button.id==='bo-server-manage'?'Dashboard':'Orders & dispatch')+', '+count+' new order'+(count===1?'':'s'));
  }
 }
 async function refresh(){
  if(!owner?.is_admin||document.hidden||checking)return;
  const stamp=epoch;checking=true;
  try{const result=await api('/admin/order-activity');if(stamp!==epoch)return;activity=result;drawBadge();}
  catch(_){}finally{checking=false}
 }
 async function seen(rows){
  if(!owner?.is_admin||acknowledging||!activity?.new_count||!document.getElementById('bo-admin-panel-orders')?.classList.contains('active')||document.getElementById('bo-admin-layer')?.classList.contains('hidden'))return;
  if(!rows.some(o=>o.id===activity.latest_order_id))return;
  const stamp=epoch,cursor=activity.latest_event_id;acknowledging=true;
  try{const result=await api('/admin/order-activity',{method:'PUT',body:JSON.stringify({last_event_id:cursor})});if(stamp===epoch){activity=result;drawBadge()}}
  catch(_){}finally{acknowledging=false}
 }
 window.addEventListener('babyone-server-identity',e=>{owner=e.detail;epoch++;activity=null;drawBadge();refresh()});
 window.addEventListener('babyone-orders-loaded',e=>seen(e.detail));
 window.addEventListener('babyone-catalog-ready',schedule);window.addEventListener('babyone-content-ready',schedule);
 window.addEventListener('focus',refresh);
 setInterval(()=>{refresh();drawBadge()},30000);
 function start(){
  const title=document.getElementById('plp-title');if(title)new MutationObserver(schedule).observe(title,{childList:true,characterData:true,subtree:true});
  const tab=boAdmin.tab;boAdmin.tab=function(name){const result=tab.apply(this,arguments);if(name==='orders')refresh().then(()=>BOordersCloud.load());return result};
  schedule();owner=window.BOverifiedIdentity;refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
