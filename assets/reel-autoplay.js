/* Visible reels play silently; sound is always an explicit customer choice. */
(()=>{
 'use strict';
 const players=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function command(p,func){
  if(p.media.tagName==='IFRAME')p.media.contentWindow?.postMessage(JSON.stringify({event:'command',func,args:[]}),'https://www.youtube-nocookie.com');
 }
 function soundLabel(p,label){
  p.button.title=label;p.button.setAttribute('aria-label',label+' '+p.title);
  const mark=label==='Mute'?'<path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>':label==='Unmute'?'<path d="m16 9 5 6m0-6-5 6"/>':label==='Play video'?'<path d="m9 5 10 7-10 7V5Z"/>':'<path d="M12 7v6m0 4h.01"/>';
  p.button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(['Mute','Unmute'].includes(label)?'<path d="M11 5 6 9H3v6h3l5 4V5Z"/>':'')+mark+'</svg>';
 }
 function mute(p){p.audible=false;if(p.media.tagName==='VIDEO')p.media.muted=true;else command(p,'mute');soundLabel(p,'Unmute');p.button.setAttribute('aria-label','Unmute '+p.title);p.button.setAttribute('aria-pressed','false')}
 function sync(p){
  const visible=p.visible&&!document.hidden&&!p.box.closest('[inert]')&&p.box.getClientRects().length>0;
  if(!visible){mute(p);if(p.media.tagName==='VIDEO')p.media.pause();else command(p,'pauseVideo');return}
  if(reduced.matches&&!p.started)return;
  if(p.media.tagName==='VIDEO')p.media.play().catch(()=>{soundLabel(p,'Play video')});
  else{if(!p.media.src)p.media.src=p.source;else{command(p,p.audible?'unMute':'mute');command(p,'playVideo')}}
 }
 window.addEventListener('message',event=>{
  if(!['https://www.youtube-nocookie.com','https://www.youtube.com'].includes(event.origin))return;
  let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return}
  if(data?.event!=='onReady')return;
  for(const p of players.values())if(p.media.tagName==='IFRAME'&&p.media.contentWindow===event.source)sync(p);
 });
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
   if(reel.videoUrl){media.src=reel.videoUrl;media.muted=true;media.defaultMuted=true;media.playsInline=true;media.loop=true;media.preload='metadata';if(reel.cover)media.poster=reel.cover;media.addEventListener('error',()=>{media.hidden=true;soundLabel(p,'Video unavailable');button.disabled=true})}
   else{media.title=p.title;media.allow='autoplay; encrypted-media; picture-in-picture';p.source='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(youtube)+'?autoplay=1&mute=1&controls=0&playsinline=1&enablejsapi=1&loop=1&playlist='+encodeURIComponent(youtube)+'&origin='+encodeURIComponent(location.origin);media.addEventListener('load',()=>{media.contentWindow?.postMessage(JSON.stringify({event:'listening',id:reel.id,channel:'widget'}),'https://www.youtube-nocookie.com');sync(p)})}
   button.onclick=e=>{e.stopPropagation();const audible=!p.audible;for(const other of players.values())mute(other);p.started=true;p.audible=audible;if(media.tagName==='VIDEO')media.muted=!audible;else command(p,audible?'unMute':'mute');soundLabel(p,audible?'Mute':'Unmute');button.setAttribute('aria-label',(audible?'Mute ':'Unmute ')+p.title);button.setAttribute('aria-pressed',String(audible));sync(p)};
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
