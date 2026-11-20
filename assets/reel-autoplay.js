/* Visible reels play silently; sound is always an explicit customer choice. */
(()=>{
 'use strict';
 const players=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function command(p,func){
  if(p.media.tagName==='IFRAME')p.media.contentWindow?.postMessage(JSON.stringify({event:'command',func,args:[]}),'https://www.youtube-nocookie.com');
 }
 function mute(p){p.audible=false;if(p.media.tagName==='VIDEO')p.media.muted=true;else command(p,'mute');p.button.textContent='Unmute';p.button.setAttribute('aria-label','Unmute '+p.title);p.button.setAttribute('aria-pressed','false')}
 function sync(p){
  const visible=p.visible&&!document.hidden&&!p.box.closest('[inert]')&&p.box.getClientRects().length>0;
  if(!visible){mute(p);if(p.media.tagName==='VIDEO')p.media.pause();else command(p,'pauseVideo');return}
  if(reduced.matches&&!p.started)return;
  if(p.media.tagName==='VIDEO')p.media.play().catch(()=>{p.button.textContent='Play video'});
  else{if(!p.media.src)p.media.src=p.source;else command(p,'playVideo')}
 }
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const p=players.get(e.target);if(p){p.visible=e.isIntersecting&&e.intersectionRatio>=.2;sync(p)}}},{threshold:[0,.2]});
 function mount(){
  for(const [box,p] of players)if(!box.isConnected){observer.unobserve(box);p.media.tagName==='VIDEO'?p.media.pause():command(p,'pauseVideo');players.delete(box)}
  document.querySelectorAll('#reels-track .reel-video,#bo-product-video-rail .pv-video').forEach(box=>{
   if(players.has(box))return;
   const card=box.closest('[data-reel-index]'),reel=typeof reelsData!=='undefined'?reelsData[Number(card?.dataset.reelIndex)]:null;
   if(!reel)return;
   const youtube=reel.youtubeId||(!reel.videoUrl&&/^[\w-]{11}$/.test(reel.id)?reel.id:'');
   if(!reel.videoUrl&&!youtube)return;
   box.onclick=null;box.removeAttribute('onclick');
   if(card?.classList.contains('pv-card')){card.removeAttribute('onclick');card.removeAttribute('onkeydown');card.removeAttribute('role');card.removeAttribute('tabindex')}
   box.querySelectorAll('.reel-play,.reel-tag,.pv-play').forEach(el=>el.remove());
   const media=document.createElement(reel.videoUrl?'video':'iframe');media.className='bo-reel-media';
   const button=document.createElement('button');button.type='button';button.className='bo-reel-sound';
   const p={box,media,button,title:reel.title||'video',visible:false,started:false,audible:false};
   if(reel.videoUrl){media.src=reel.videoUrl;media.muted=true;media.defaultMuted=true;media.playsInline=true;media.loop=true;media.preload='metadata';if(reel.cover)media.poster=reel.cover;media.addEventListener('error',()=>{media.hidden=true;button.textContent='Video unavailable';button.disabled=true})}
   else{media.title=p.title;media.allow='autoplay; encrypted-media; picture-in-picture';p.source='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(youtube)+'?autoplay=1&mute=1&controls=0&playsinline=1&enablejsapi=1&loop=1&playlist='+encodeURIComponent(youtube)+'&origin='+encodeURIComponent(location.origin);media.addEventListener('load',()=>sync(p))}
   button.onclick=e=>{e.stopPropagation();const audible=!p.audible;for(const other of players.values())mute(other);p.started=true;p.audible=audible;if(media.tagName==='VIDEO')media.muted=!audible;else command(p,audible?'unMute':'mute');button.textContent=audible?'Mute':'Unmute';button.setAttribute('aria-label',(audible?'Mute ':'Unmute ')+p.title);button.setAttribute('aria-pressed',String(audible));sync(p)};
   box.append(media,button);players.set(box,p);mute(p);observer.observe(box);
  });
  document.querySelectorAll('.bo-product-photo-frame').forEach(frame=>{
   const photo=frame.querySelector(':scope>img');if(!photo||frame.querySelector('.bo-photo-fit'))return;
   const button=document.createElement('button');button.type='button';button.className='bo-photo-fit';button.textContent='Full photo';button.setAttribute('aria-pressed','false');button.onclick=()=>{const full=photo.classList.toggle('bo-full-photo');button.textContent=full?'Fill frame':'Full photo';button.setAttribute('aria-pressed',String(full))};frame.appendChild(button);
  });
 }
 let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;mount()})}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>players.forEach(sync));reduced.addEventListener('change',()=>players.forEach(sync));mount();
})();
