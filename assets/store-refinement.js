/* Subtle desktop arrivals; catalogue content always remains visible. */
(function(){
 'use strict';
 const desktop=matchMedia('(min-width:1024px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)'),seen=new WeakSet();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
   if(desktop.matches&&!reduced.matches)entry.target.classList.add('bo-arrive');
   seen.add(entry.target);observer.unobserve(entry.target);
  }
 },{threshold:.12});
 function refresh(){
  if(!desktop.matches||reduced.matches)return;
  for(const element of document.querySelectorAll('#home-page .section-head,#home-page .category-grid,#home-page .prod-scroll,#home-page .promo,#home-page .bo-fashion-grid,#home-page .reels-wrap,#reviews-section .reviews-rail,#explorer-page .bo-collection-banner,#explorer-page #subcat-tile-grid'))if(!seen.has(element))observer.observe(element);
 }
 for(const event of ['babyone-catalog-ready','babyone-content-ready'])window.addEventListener(event,refresh);
 desktop.addEventListener('change',refresh);reduced.addEventListener('change',()=>{if(reduced.matches)document.querySelectorAll('.bo-arrive').forEach(el=>el.classList.remove('bo-arrive'));else refresh()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
