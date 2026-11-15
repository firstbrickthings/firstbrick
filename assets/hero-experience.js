/* Fit the hero to the available screen without changing the store navigation. */
(function(){
 'use strict';
 function start(){
  const hero=document.getElementById('hero'),home=document.getElementById('home-page'),slides=document.getElementById('hero-slides');if(!hero||!home||!slides)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:760px)');let frame=0,gesture=null;
  hero.setAttribute('role','region');hero.setAttribute('aria-roledescription','carousel');hero.setAttribute('aria-label','BabyOne featured collection');hero.tabIndex=0;
  const dots=document.getElementById('hero-dots'),controls=document.createElement('div');controls.className='bo-hero-controls';hero.appendChild(controls);controls.appendChild(dots);
  const control=document.createElement('button');control.type='button';control.id='bo-hero-playback';control.className='bo-hero-playback';control.hidden=true;controls.appendChild(control);
  const status=document.createElement('span');status.className='bo-hero-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');hero.appendChild(status);
  function playback(){
   const video=slides.querySelector('.hero-slide.active video'),playing=video?!video.paused:!window.boHeroPaused;
   control.hidden=mobile.matches||reduced.matches||(!video&&slides.children.length<2)||!!video?.error;
   const label=playing?'Pause hero animation':'Play hero animation';control.setAttribute('aria-label',label);control.title=label;control.setAttribute('aria-pressed',String(!playing));
   control.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+(playing?'<path d="M8 5v14M16 5v14"/>':'<path d="m9 5 10 7-10 7V5Z"/>')+'</svg>';
   controls.hidden=control.hidden&&dots.hidden;
   const dot=dots.querySelector('[aria-current=true]');if(dot&&dots.clientWidth){const d=dot.getBoundingClientRect(),r=dots.getBoundingClientRect();if(d.left<r.left)dots.scrollLeft-=r.left-d.left;else if(d.right>r.right)dots.scrollLeft+=d.right-r.right}
  }
  control.onclick=()=>{const video=slides.querySelector('.hero-slide.active video');window.boHeroPaused=video?!video.paused:!window.boHeroPaused;startHeroTimer();playback()};
  hero.addEventListener('pointerdown',event=>{
   if(slides.children.length<2||event.isPrimary===false||(event.pointerType!=='touch'&&event.button!==0)||event.target.closest('.bo-hero-controls,button,a,input,select,textarea'))return;
   gesture={id:event.pointerId,x:event.clientX,y:event.clientY};window.boHeroGesture=true;clearTimeout(heroTimer);
  });
  hero.addEventListener('pointermove',event=>{
   if(!gesture||event.pointerId!==gesture.id)return;
   const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
   if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.35){try{hero.setPointerCapture(event.pointerId)}catch(_){}if(event.cancelable)event.preventDefault()}
  },{passive:false});
  function endGesture(event,cancelled){
   if(!gesture||event.pointerId!==gesture.id)return;
   const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;window.boHeroGesture=false;
   try{if(hero.hasPointerCapture(event.pointerId))hero.releasePointerCapture(event.pointerId)}catch(_){}
   if(!cancelled&&Math.abs(dx)>=Math.max(40,Math.min(72,hero.clientWidth*.1))&&Math.abs(dx)>Math.abs(dy)*1.35)goHero(activeHero+(dx<0?1:-1),{manual:true});else startHeroTimer();
   playback();
  }
  hero.addEventListener('pointerup',e=>endGesture(e,false));hero.addEventListener('pointercancel',e=>endGesture(e,true));hero.addEventListener('lostpointercapture',e=>{if(e.target===hero)endGesture(e,true)});
  hero.addEventListener('keydown',event=>{
   if(slides.children.length<2||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const target={ArrowLeft:activeHero-1,ArrowRight:activeHero+1,Home:0,End:slides.children.length-1}[event.key];if(target===undefined)return;
   event.preventDefault();goHero(target,{manual:true});if(event.target.closest('.hero-dot'))dots.querySelector('[aria-current=true]')?.focus({preventScroll:true});
  });
  function measure(){
   frame=0;if(home.offsetParent===null)return;
   const top=Math.max(0,hero.getBoundingClientRect().top+scrollY),nav=document.getElementById('babyone-bottom-nav');let bottom=0;
   if(nav&&getComputedStyle(nav).display!=='none')bottom=Math.max(0,nav.getBoundingClientRect().height+(parseFloat(getComputedStyle(nav).bottom)||0));
   hero.style.setProperty('--bo-hero-top',top+'px');hero.style.setProperty('--bo-hero-bottom',bottom+'px');playback();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(measure)}
  const resize=new ResizeObserver(schedule);for(const node of document.querySelectorAll('.topbar,.site-header,.mobile-search,#babyone-bottom-nav'))resize.observe(node);
  new MutationObserver(()=>{for(const video of slides.querySelectorAll('video'))if(!video.dataset.boPlaybackBound){video.dataset.boPlaybackBound='true';for(const event of ['play','pause','error'])video.addEventListener(event,playback)}schedule()}).observe(slides,{childList:true,subtree:true});
  new MutationObserver(()=>{window.boHeroOffscreen=home.offsetParent===null;startHeroTimer();schedule()}).observe(home,{attributes:true,attributeFilter:['class','hidden','style']});
  new IntersectionObserver(entries=>{window.boHeroOffscreen=!entries[0].isIntersecting;startHeroTimer();playback()},{threshold:.05}).observe(hero);
  document.addEventListener('visibilitychange',()=>{startHeroTimer();playback()});reduced.addEventListener('change',()=>{startHeroTimer();playback()});window.addEventListener('resize',schedule);
  window.addEventListener('babyone-hero-playback',playback);
  window.addEventListener('babyone-hero-change',event=>{playback();if(event.detail.manual)status.textContent='Slide '+(event.detail.index+1)+' of '+event.detail.count});
  document.fonts?.ready.then(schedule);schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
