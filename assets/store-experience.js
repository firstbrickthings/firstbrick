/* Published catalogue artwork and owner-only, server-counted new-order badges. */
(function(){
 'use strict';
 let frame=0,activity=null,owner=null,epoch=0,checking=false,acknowledging=false;
 const api=(path,options={})=>BOserver.request(path,options);
 function categoryBanner(){
  const listing=document.getElementById('plp-view');if(!listing)return;
  const specific=typeof navState!=='undefined'&&navState.subcategory&&navState.subcategory!=='All';listing.classList.toggle('bo-subcategory-view',!!specific);
  const isListing=typeof navState!=='undefined'&&navState.view==='plp';
  const host=isListing?listing:document.getElementById('subcat-landing');
  const id=isListing?'bo-plp-banner':'bo-subcat-banner';
  let banner=document.getElementById(id);
  if(!banner){
   banner=document.createElement('figure');banner.id=id;banner.className='bo-plp-banner bo-collection-banner';host.prepend(banner);
   const heading=document.createElement('figcaption');heading.className='bo-collection-heading';
   if(isListing)heading.appendChild(listing.querySelector('.bo-plp-heading'));
   else{heading.appendChild(host.querySelector('#subcat-breadcrumb'));heading.appendChild(host.querySelector('.section-head'))}
   banner.appendChild(heading);
  }
  // Reach the screen edges while the catalogue keeps its normal reading gutters.
  banner.style.width=document.documentElement.clientWidth+'px';banner.style.marginLeft=-host.getBoundingClientRect().left+'px';
  const published=window.BOpublicContent?.banners?.value.items||[];
  const category=typeof navState!=='undefined'?navState.category:'';
  const subcategory=typeof navState!=='undefined'?navState.subcategory:'';
  const custom=published.filter(b=>b.id.startsWith('catalogue-')&&b.published!==false&&b.image&&(!b.category||b.category===category)&&(!specific||b.reference!==true));
  let items=custom.map(b=>({image:b.image,title:b.title||category,category,reference:b.reference===true}));
  if(!items.length){
   const pool=productsData.filter(p=>!p.catalogHidden&&p.image&&!p.image.startsWith('data:')&&(!category||category==='All'||p.category===category));
   const matches=pool.filter(p=>!subcategory||subcategory==='All'||p.subcategory===subcategory).sort((a,b)=>Number(!!b.owner_photo_import)-Number(!!a.owner_photo_import));
   const seen=new Set();
   for(const p of [...matches,...pool]){if(seen.has(p.image))continue;seen.add(p.image);items.push({image:p.image,title:category&&category!=='All'?category:'For every little moment',category:category==='All'?'':category,reference:true});if(items.length===3)break}
  }
  if(!items.length){const image=categoriesData.find(c=>c.name===category)?.img||heroSlidesData.find(s=>s.img)?.img;if(image)items=[{image,title:category}]}
  banner.classList.toggle('bo-collection-artwork',items.some(item=>item.reference));
  BObanners.render(banner,items,{trackId:id+'-slides',dotsId:id+'-dots',label:(category||'BabyOne')+' collection banners'});
  const check=productsData.find(p=>p.id==='babyone-hospital-bag-payment-check');
  const newborn=categoriesData.find(c=>c.name==='New Born');
  if(check&&!check.catalogHidden&&check.category==='New Born'&&!window.BOsharedCategories&&newborn&&!(newborn.subcategories||[]).includes('Hospital Bags')){newborn.subcategories=[...(newborn.subcategories||[]),'Hospital Bags'];renderCategories()}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;categoryBanner()})}
 function drawBadge(){
  const count=Math.max(0,Number(activity?.new_count)||0),text=count>99?'99+':String(count);
  for(const button of document.querySelectorAll('#bo-server-manage,#bo-admin-notifications,.bo-admin-nav [data-panel=orders]')){
   let badge=button.querySelector('.bo-order-count');
   if(!owner?.is_admin||!count){badge?.remove();if(button.id==='bo-admin-notifications')button.setAttribute('aria-label','New order notifications');else button.removeAttribute('aria-label');continue}
   if(!badge){badge=document.createElement('span');badge.className='bo-order-count';badge.setAttribute('aria-hidden','true');button.appendChild(badge)}
   badge.textContent=text;button.setAttribute('aria-label',(button.id==='bo-server-manage'?'Dashboard':button.id==='bo-admin-notifications'?'Order notifications':'Orders & dispatch')+', '+count+' new order'+(count===1?'':'s'));
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
 window.addEventListener('resize',schedule);
 window.addEventListener('focus',refresh);
 setInterval(()=>{refresh();drawBadge()},30000);
 function start(){
  for(const id of ['plp-title','subcat-title']){const title=document.getElementById(id);if(title)new MutationObserver(schedule).observe(title,{childList:true,characterData:true,subtree:true})}
  const tab=boAdmin.tab;boAdmin.tab=function(name){const result=tab.apply(this,arguments);if(name==='orders')refresh().then(()=>BOordersCloud.load());return result};
  schedule();owner=window.BOverifiedIdentity;refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
