/* Shared image banner navigation: three-second images, manual dots and swipe. */
(function(){
 'use strict';
 const instances=new WeakMap(),active=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(root,items,options={}){
  if(!root)return;
  items=items.filter(s=>s.image);root.hidden=!items.length;
  const signature=JSON.stringify(items),previous=instances.get(root);
  if(previous?.signature===signature)return previous;
  previous?.destroy();
  let track=root.querySelector('#'+options.trackId),dots=root.querySelector('#'+options.dotsId);
  if(!track){track=document.createElement('div');track.id=options.trackId;root.appendChild(track)}
  if(!dots){dots=document.createElement('div');dots.id=options.dotsId;root.appendChild(dots)}
  if(!items.length){track.replaceChildren();dots.replaceChildren();dots.hidden=true;instances.delete(root);return}
  root.classList.add('bo-banner-carousel');root.setAttribute('role','region');root.setAttribute('aria-roledescription','carousel');root.setAttribute('aria-label',options.label||'BabyOne collections');root.tabIndex=0;
  track.classList.add('bo-banner-track');dots.classList.add('bo-banner-dots');dots.setAttribute('role','group');dots.setAttribute('aria-label','Choose a banner slide');dots.hidden=items.length<2;
  track.innerHTML=items.map((s,i)=>{
   const photo=`<img src="${escape(s.image)}" alt="${escape(s.title||s.category||'BabyOne collection')}" loading="lazy" decoding="async" draggable="false">`;
   const media=s.editorial?`<picture>${s.imageMobile?`<source media="(max-width:760px)" srcset="${escape(s.imageMobile)}">`:''}${photo}</picture>`:photo;
   return `<div class="bo-banner-slide ${s.reference?'bo-banner-reference':''} ${s.editorial?'bo-banner-editorial':''}" role="group" aria-roledescription="slide" aria-label="${i+1} of ${items.length}" aria-hidden="${i!==0}" ${i?'inert':''}>${media}${s.reference||s.editorial?`<div class="bo-banner-caption"><span>THE BABYONE COLLECTION</span><h3>${escape(s.title||s.category)}</h3>${s.category?`<button type="button" aria-label="Explore ${escape(s.category)} collection" data-banner-category="${escape(s.category)}">Explore collection <span aria-hidden="true">→</span></button>`:''}</div>`:''}</div>`;
  }).join('');
  dots.innerHTML=items.map((_,i)=>`<button type="button" class="bo-banner-dot" aria-label="Show banner slide ${i+1} of ${items.length}" data-banner-dot="${i}"${i===0?' aria-current="true"':''}></button>`).join('');
  const slides=[...track.children],buttons=[...dots.children];let index=0,timer=0,visible=false,gesture=null;
  const events=new AbortController(),listen=(node,type,fn,extra={})=>node.addEventListener(type,fn,{...extra,signal:events.signal});
  const stop=()=>{clearTimeout(timer);timer=0};
  function resume(){stop();if(items.length>1&&visible&&!document.hidden&&!reduced.matches&&!gesture)timer=setTimeout(()=>go(index+1),3000)}
  function go(next,manual=false){
   index=(next+items.length)%items.length;
   slides.forEach((s,i)=>{s.classList.toggle('is-active',i===index);s.inert=i!==index;s.setAttribute('aria-hidden',String(i!==index))});
   buttons.forEach((b,i)=>{b.classList.toggle('active',i===index);if(i===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
   options.onChange?.(index);resume();
   if(manual){const b=buttons[index],r=dots.getBoundingClientRect(),d=b.getBoundingClientRect();if(d.left<r.left)dots.scrollLeft-=r.left-d.left;else if(d.right>r.right)dots.scrollLeft+=d.right-r.right}
  }
  listen(root,'click',e=>{const button=e.target.closest('[data-banner-dot]'),category=e.target.closest('[data-banner-category]');if(button)go(Number(button.dataset.bannerDot),true);if(category)filterByCategory(category.dataset.bannerCategory)});
  listen(root,'dragstart',e=>e.preventDefault());
  listen(track,'pointerdown',e=>{if(items.length<2||e.isPrimary===false||(e.pointerType!=='touch'&&e.button!==0)||e.target.closest('button,a'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY};stop()});
  listen(track,'pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.35){try{track.setPointerCapture(e.pointerId)}catch(_){}if(e.cancelable)e.preventDefault()}},{passive:false});
  function finish(e,cancel){if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;try{if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId)}catch(_){}if(!cancel&&Math.abs(dx)>=Math.max(40,Math.min(72,root.clientWidth*.1))&&Math.abs(dx)>Math.abs(dy)*1.35)go(index+(dx<0?1:-1),true);else resume()}
  listen(track,'pointerup',e=>finish(e,false));listen(track,'pointercancel',e=>finish(e,true));listen(track,'lostpointercapture',e=>{if(e.target===track)finish(e,true)});
  listen(root,'keydown',e=>{if(items.length<2||e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();go(({ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:items.length-1})[e.key],true);if(e.target.closest('[data-banner-dot]'))buttons[index].focus({preventScroll:true})});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume()},{threshold:.1});observer.observe(root);
  const instance={signature,go,step:delta=>go(index+delta,true),resume,destroy(){stop();observer.disconnect();events.abort();active.delete(instance)}};
  active.add(instance);instances.set(root,instance);go(0);return instance;
 }
 document.addEventListener('visibilitychange',()=>active.forEach(c=>c.resume()));reduced.addEventListener('change',()=>active.forEach(c=>c.resume()));
 window.BObanners={render,get:root=>instances.get(root)};
})();
