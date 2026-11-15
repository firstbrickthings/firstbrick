/* Fit the hero to the available screen without changing the store navigation. */
(function(){
 'use strict';
 function start(){
  const hero=document.getElementById('hero'),home=document.getElementById('home-page'),slides=document.getElementById('hero-slides');if(!hero||!home||!slides)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const control=document.createElement('button');control.type='button';control.id='bo-hero-playback';control.className='bo-hero-playback';control.hidden=true;hero.appendChild(control);
  function playback(){
   const video=slides.querySelector('.hero-slide.active video'),playing=video?!video.paused:!window.boHeroPaused;
   control.hidden=reduced.matches||(!video&&slides.children.length<2)||!!video?.error;
   const label=playing?'Pause hero animation':'Play hero animation';control.setAttribute('aria-label',label);control.title=label;control.setAttribute('aria-pressed',String(!playing));
   control.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+(playing?'<path d="M8 5v14M16 5v14"/>':'<path d="m9 5 10 7-10 7V5Z"/>')+'</svg>';
  }
  control.onclick=()=>{const video=slides.querySelector('.hero-slide.active video');window.boHeroPaused=video?!video.paused:!window.boHeroPaused;startHeroTimer();playback()};
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
  document.fonts?.ready.then(schedule);schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
