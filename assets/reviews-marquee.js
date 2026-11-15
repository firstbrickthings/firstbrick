/* Published feedback stays authoritative. Preview cards are explicitly labelled. */
(function(){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const samples=[
  {name:'Sample parent A',rating:5,message:'Thoughtful little essentials for our everyday routine.'},
  {name:'Sample parent B',rating:5,message:'A lovely selection for our growing family.'},
  {name:'Sample parent C',rating:5,message:'Easy to browse and find what our baby needs.'},
  {name:'Sample parent D',rating:5,message:'Lovely little finds for a new chapter of family life.'},
  {name:'Sample parent E',rating:5,message:'A thoughtful selection for feeding, changing and cuddle time.'},
  {name:'Sample parent F',rating:4,message:'Simple browsing and useful details for choosing everyday essentials.'},
  {name:'Sample parent G',rating:5,message:'From tiny outfits to nursery essentials, everything feels easy to explore.'},
  {name:'Sample parent H',rating:5,message:'A welcoming place to discover something special for a little one.'}
 ];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=false,resizeFrame=0;
 function render(rows){
  const section=document.getElementById('reviews-section'),track=document.getElementById('reviews-track'),rail=track?.parentElement;if(!section||!rail)return;
  const published=(Array.isArray(rows)?rows:[]).filter(r=>r&&r.published!==false&&typeof r.name==='string'&&typeof r.message==='string');
  const preview=!published.length,items=preview?samples:published;
  section.querySelector('.section-head p').textContent=preview?'A preview of our review experience':'Words from our community';
  let tools=section.querySelector('.bo-review-tools');
  if(!tools){tools=document.createElement('div');tools.className='bo-review-tools';rail.before(tools)}
  tools.innerHTML=(preview?'<p class="bo-review-sample-notice">Sample reviews · design preview, not customer feedback.</p>':'<span></span>')+'<button type="button" class="bo-review-motion" aria-pressed="'+paused+'">'+(paused?'Resume reviews':'Pause reviews')+'</button>';
  const control=tools.querySelector('button');control.hidden=reduced.matches;
  control.onclick=()=>{paused=!paused;rail.classList.toggle('bo-review-paused',paused);control.setAttribute('aria-pressed',String(paused));control.textContent=paused?'Resume reviews':'Pause reviews'};
  rail.classList.toggle('bo-review-paused',paused);rail.classList.add('bo-review-marquee');rail.setAttribute('aria-label',preview?'Sample review design preview':'Customer reviews');rail.tabIndex=0;
  const width=rail.clientWidth||innerWidth,cardWidth=Math.min(340,Math.max(260,innerWidth*.78)),copies=Math.max(1,Math.ceil(width/((cardWidth+20)*items.length)));
  function card(review,duplicate){
   const rating=Math.max(1,Math.min(5,Math.round(Number(review.rating)||5)));
   return '<article class="review-card '+(preview?'bo-review-sample':'bo-review-genuine')+'" role="listitem"'+(duplicate?' aria-hidden="true"':'')+'>'+(preview?'<span class="bo-review-preview-label">Sample review</span>':'')+'<div class="review-stars" aria-label="'+(preview?'Sample rating: ':'')+rating+' out of 5 stars">'+'★'.repeat(rating)+'☆'.repeat(5-rating)+'</div><p class="review-text">“'+esc(review.message)+'”</p><div class="review-name">— '+esc(review.name)+'</div>'+(preview?'<small class="bo-review-example">Example only</small>':review.verified_purchase?'<span class="bo-review-verified">Verified purchase</span>':'')+'</article>';
  }
  const group=Array.from({length:copies},(_,i)=>items.map(r=>card(r,i>0)).join('')).join('');
  rail.scrollLeft=0;
  track.innerHTML='<div class="bo-review-group" role="list">'+group+'</div><div class="bo-review-group bo-review-copy" aria-hidden="true" inert>'+group+'</div>';
  const distance=track.firstElementChild.getBoundingClientRect().width||copies*items.length*(cardWidth+20);
  track.style.setProperty('--bo-review-duration',Math.max(28,distance/28)+'s');
 }
 window.BOreviewsMarquee={render};
 window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>render(window.BOpublishedReviews||[]))});
 reduced.addEventListener('change',()=>render(window.BOpublishedReviews||[]));
})();
