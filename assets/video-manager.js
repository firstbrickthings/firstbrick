/* Owner video library. Media stays in shared storage; edits use MySQL version checks. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
let previousCleanup=()=>{};
async function mount(root,options){
 previousCleanup();
 const api=window.BOserver.request,stamp=crypto.randomUUID();root.dataset.videoMount=stamp;
 const doc=await api('/admin/content/videos');if(root.dataset.videoMount!==stamp)return;
 let items=structuredClone(doc.version?doc.value.items:options.defaults||[]),version=doc.version,editing=null,saving=false,dispose=()=>{};previousCleanup=()=>dispose();
 const productNames=new Map((typeof productsData!=='undefined'?productsData:[]).map(p=>[String(p.id),p.name]));
 root.innerHTML=`<div class="bo-admin-card bo-work-card bo-video-library"><div class="bo-video-library-head"><div><h3>Videos</h3><p class="bo-muted">Upload a video, choose its cover and link a product.</p></div><button type="button" class="bo-admin-btn" id="bo-video-new">Add new video</button></div><p class="bo-work-status" id="bo-video-library-status" role="status" aria-live="polite"></p><div id="bo-video-editor" hidden></div><h4>Your videos <span id="bo-video-count"></span></h4><div id="bo-video-library-list" class="bo-video-library-list"></div></div>`;
 const status=root.querySelector('#bo-video-library-status'),editor=root.querySelector('#bo-video-editor'),list=root.querySelector('#bo-video-library-list');
 function notice(text,error=false){status.textContent=text;status.dataset.error=String(error)}
 function controls(disabled){saving=disabled;root.querySelectorAll('[data-library-action],#bo-video-new,#bo-video-save,#bo-video-cancel').forEach(b=>b.disabled=disabled)}
 async function persist(next){const saved=await api('/admin/content/videos',{method:'PUT',body:JSON.stringify({value:{items:next},expected_version:version})});items=structuredClone(saved.value.items);version=saved.version;await options.refresh();draw();}
 function draw(){
  root.querySelector('#bo-video-count').textContent='('+items.length+')';
  list.innerHTML=items.map((item,i)=>`<article class="bo-video-library-row"><img class="bo-video-library-cover" src="${esc(item.cover||(item.youtubeId?'https://i.ytimg.com/vi/'+item.youtubeId+'/hqdefault.jpg':'assets/favicon.svg'))}" alt="Cover for ${esc(item.title)}" loading="lazy"><div class="bo-video-library-info"><h5>${esc(item.title)}</h5><p>${item.productId?esc(productNames.get(String(item.productId))||'Linked product'):'No linked product'}</p><span class="bo-video-published ${item.published===false?'hidden-video':''}">${item.published===false?'Hidden':'Published'}</span></div><div class="bo-video-library-actions"><button type="button" class="bo-admin-btn secondary" data-library-action="edit" data-index="${i}">Edit</button><button type="button" class="bo-admin-btn secondary" data-library-action="visibility" data-index="${i}">${item.published===false?'Publish':'Hide'}</button><button type="button" class="bo-video-small-action" data-library-action="up" data-index="${i}" ${i===0?'disabled':''} aria-label="Move ${esc(item.title)} up">↑</button><button type="button" class="bo-video-small-action" data-library-action="down" data-index="${i}" ${i===items.length-1?'disabled':''} aria-label="Move ${esc(item.title)} down">↓</button><button type="button" class="bo-video-small-action" data-library-action="remove" data-index="${i}" aria-label="Remove ${esc(item.title)}">Remove</button></div></article>`).join('')||'<p class="bo-muted bo-video-empty">No videos yet. Add your first video above.</p>';
  list.querySelectorAll('[data-library-action]').forEach(button=>button.onclick=async()=>{
   if(saving)return;const i=Number(button.dataset.index),kind=button.dataset.libraryAction;
   if(kind==='edit'){open(items[i]);return;}
   if(!editor.hidden){notice('Save or close the video editor first.',true);return;}
   if(kind==='remove'&&!confirm('Remove “'+items[i].title+'” from the website? Its stored file will be kept.'))return;
   const next=structuredClone(items);if(kind==='visibility')next[i].published=next[i].published===false;else if(kind==='remove')next.splice(i,1);else{const other=kind==='up'?i-1:i+1;[next[i],next[other]]=[next[other],next[i]];}
   controls(true);notice('Saving…');try{await persist(next);notice('Saved for all customers.')}catch(e){notice(e.message,true)}finally{controls(false);draw()}
  });
  drawRecovery();
 }
 function drawRecovery(){
  root.querySelector('.bo-video-device-recovery')?.remove();let rows=[];try{rows=JSON.parse(localStorage.getItem('babyone-owner-reels-v1')||'[]')}catch(_){}if(!Array.isArray(rows))return;
  const missing=rows.filter(r=>r&&typeof r==='object').map((r,i)=>({...r,recoveryId:'recovered-'+String(r.cloudId||r.localKey||r.id||'video-'+i).slice(0,80)})).filter(r=>!items.some(i=>i.id===r.recoveryId||r.videoUrl&&i.videoUrl===r.videoUrl||r.id&&i.youtubeId===r.id));if(!missing.length)return;
  const box=document.createElement('details');box.className='bo-work-variant bo-video-device-recovery';box.innerHTML='<summary>Videos saved on this device ('+missing.length+')</summary><p class="bo-muted">Recover a saved video, review its details, then save it for your customers. Your original device files are kept.</p>'+missing.map((r,i)=>`<p>${esc(r.title||'Untitled video')} <button type="button" class="bo-admin-btn secondary" data-library-action="recover" data-recovery="${i}">Recover video</button></p>`).join('');root.querySelector('.bo-video-library').appendChild(box);
  box.querySelectorAll('[data-recovery]').forEach(button=>button.onclick=async()=>{
   if(saving)return;if(!editor.hidden){notice('Save or close the current editor first.',true);return;}const r=missing[Number(button.dataset.recovery)];controls(true);notice('Opening your saved video…');
   try{
    let file=null,coverFile=null;const recovered={id:r.recoveryId,title:r.title||'BabyOne video',author:r.author||'@babyone',productId:r.productId||'',videoUrl:r.videoUrl||'',cover:r.cover||'',published:true};
    if(r.localKey){const blob=await boVideoLoad(r.localKey);if(!blob)throw Error('The original video file is unavailable on this device. Choose the original file with Add new video.');file=new File([blob],r.fileName||'recovered.mp4',{type:blob.type||'video/mp4'});recovered.videoUrl='';}
    if(!file&&!recovered.videoUrl&&/^[A-Za-z0-9_-]{11}$/.test(r.id))recovered.youtubeId=r.id;
    if(!file&&!recovered.videoUrl&&!recovered.youtubeId)throw Error('Choose the original file with Add new video.');
    if(recovered.cover.startsWith('data:image/')){const blob=await(await fetch(recovered.cover)).blob();coverFile=new File([blob],'recovered-cover.jpg',{type:blob.type});recovered.cover='';}
    controls(false);const form=open(recovered);if(!form)return;
    for(const [name,source] of [['video',file],['cover',coverFile]])if(source){const transfer=new DataTransfer();transfer.items.add(source);form.elements[name].files=transfer.files;form.elements[name].dispatchEvent(new Event('change'));}
    notice('Review the recovered video, then save it.');
   }catch(e){notice(e.message,true)}finally{controls(false);draw()}
  });
 }
 function close(){dispose();editing=null;editor.hidden=true;editor.replaceChildren();}
 function open(existing){
  if(saving)return;
  if(!editor.hidden&&!confirm('Discard the unsaved video edit?'))return;
  dispose();editing=existing?structuredClone(existing):{id:crypto.randomUUID(),title:'',author:'@babyone',productId:'',videoUrl:'',cover:'',published:true};
  const item=editing;editor.hidden=false;notice('');
  editor.innerHTML=`<form id="bo-video-upload-form" class="bo-video-upload-form"><h4>${existing?'Edit video':'Add new video'}</h4><div class="bo-work-two"><div><label class="bo-work-field">${existing?'Replace video (optional)':'Upload video'}<input type="file" name="video" accept="video/mp4,video/quicktime,video/webm" ${existing?'':'required'}></label><p class="bo-muted">MP4, MOV or WebM · up to 100 MB</p><div class="bo-video-file-preview" ${item.videoUrl?'':'hidden'}><video controls playsinline preload="none" ${item.videoUrl?`src="${esc(item.videoUrl)}"`:''} ${item.cover?`poster="${esc(item.cover)}"`:''}></video></div></div><div><label class="bo-work-field">${item.cover?'Replace cover image (optional)':'Upload cover image'}<input type="file" name="cover" accept="image/jpeg,image/png,image/webp" ${item.cover?'':'required'}></label><p class="bo-muted">JPG, PNG or WebP · up to 12 MB</p><img class="bo-video-cover-preview" ${item.cover?`src="${esc(item.cover)}"`:'hidden'} alt="Video cover preview"></div></div><label class="bo-work-field">Video title<input type="text" name="title" required maxlength="120" value="${esc(item.title)}" placeholder="Give your video a title"></label><div class="bo-video-product-picker"><label class="bo-work-field" for="bo-video-product-search">Related product (optional)</label><input id="bo-video-product-search" class="bo-admin-field" type="search" placeholder="Click to browse or type a product name" role="combobox" aria-autocomplete="list" aria-controls="bo-video-product-results" aria-expanded="false" autocomplete="off"><div class="bo-video-product-results" id="bo-video-product-results" hidden><p class="bo-muted" id="bo-video-search-status" role="status"></p><div role="listbox" id="bo-video-product-options" aria-label="Matching products"></div><button type="button" class="bo-admin-btn secondary" id="bo-video-product-more" hidden>Show more products</button></div><div class="bo-video-selected-product" ${item.productId?'':'hidden'}><span>${esc(productNames.get(String(item.productId))||'Linked product')}</span><button type="button" class="bo-video-small-action" id="bo-video-product-clear">Remove product</button></div></div><label class="bo-work-check"><input type="checkbox" name="published" ${item.published===false?'':'checked'}> Publish to customers</label><p class="bo-work-status" id="bo-video-save-status" role="status" aria-live="polite"></p><div class="bo-work-toolbar"><button class="bo-admin-btn" id="bo-video-save" type="submit">${existing?'Save changes':'Save video'}</button><button class="bo-admin-btn secondary" id="bo-video-cancel" type="button">Cancel</button></div></form>`;
  const form=editor.querySelector('form'),search=form.querySelector('#bo-video-product-search'),results=form.querySelector('#bo-video-product-results'),choices=form.querySelector('#bo-video-product-options'),more=form.querySelector('#bo-video-product-more'),searchStatus=form.querySelector('#bo-video-search-status'),selected=form.querySelector('.bo-video-selected-product'),saveStatus=form.querySelector('#bo-video-save-status'),preview=form.querySelector('video'),coverPreview=form.querySelector('.bo-video-cover-preview');
  let suppressFocus=false,timer,sequence=0,offset=0,total=0,found=[],active=-1,selectedId=String(item.productId||''),alive=true,videoObject='',coverObject='',preparedVideo=null,preparedCover=null;
  dispose=()=>{alive=false;clearTimeout(timer);sequence++;preview.pause();if(videoObject)URL.revokeObjectURL(videoObject);if(coverObject)URL.revokeObjectURL(coverObject);document.removeEventListener('pointerdown',outsidePicker)};
  const hideResults=()=>{results.hidden=true;search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');active=-1};
  const select=product=>{selectedId=product.id;productNames.set(String(product.id),product.name);selected.hidden=false;selected.querySelector('span').textContent=product.name;search.value='';suppressFocus=true;search.focus();suppressFocus=false;hideResults()};
  function drawChoices(){choices.innerHTML=found.map((p,i)=>`<button type="button" role="option" aria-selected="false" id="bo-video-product-option-${i}" data-product-index="${i}"><img src="${esc(p.image||'assets/favicon.svg')}" alt="" loading="lazy"><span><strong>${esc(p.name)}</strong><small>${esc(p.category||'')}${p.active===false?' · Hidden':''}</small></span><b>${p.variants?.length?esc(money(p.variants.find(v=>v.enabled)?.price??p.variants[0].price)):''}</b></button>`).join('');choices.querySelectorAll('[data-product-index]').forEach(button=>button.onclick=()=>select(found[Number(button.dataset.productIndex)]));searchStatus.textContent=total?(found.length+' of '+total+' products'):'No matching products. Try another name.';more.hidden=offset>=total;}
  async function find(append=false){
   const request=++sequence,query=search.value.trim();if(!append){found=[];offset=0;active=-1;choices.replaceChildren();}
   results.hidden=false;search.setAttribute('aria-expanded','true');searchStatus.textContent='Loading products…';more.disabled=true;
   try{const data=await api('/admin/products?limit=100&offset='+offset+'&q='+encodeURIComponent(query));if(!alive||request!==sequence)return;found.push(...data.items);offset+=data.items.length;total=data.total;drawChoices()}
   catch(e){if(alive&&request===sequence){searchStatus.textContent=e.message;more.hidden=true}}
   finally{if(alive&&request===sequence)more.disabled=false;}
  }
  search.addEventListener('focus',()=>{if(!suppressFocus)find()});search.addEventListener('click',()=>{if(results.hidden)find()});
  search.addEventListener('input',()=>{clearTimeout(timer);sequence++;found=[];active=-1;choices.replaceChildren();more.hidden=true;results.hidden=false;search.setAttribute('aria-expanded','true');searchStatus.textContent='Searching products…';timer=setTimeout(()=>find(),180)});more.onclick=()=>find(true);
  search.addEventListener('keydown',e=>{if(e.key==='Escape'&&!results.hidden){e.preventDefault();e.stopPropagation();hideResults();return;}if(['ArrowDown','ArrowUp'].includes(e.key)&&found.length&&!results.hidden){e.preventDefault();active=Math.max(0,Math.min(found.length-1,active+(e.key==='ArrowDown'?1:-1)));choices.querySelectorAll('[role=option]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));const option=choices.children[active];search.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&!results.hidden){e.preventDefault();if(found[active>=0?active:0])select(found[active>=0?active:0]);}});
  const picker=form.querySelector('.bo-video-product-picker'),outsidePicker=e=>{if(!picker.contains(e.target))hideResults()};document.addEventListener('pointerdown',outsidePicker);
  form.addEventListener('focusout',event=>{if(event.relatedTarget&&!picker.contains(event.relatedTarget))hideResults()});
  form.querySelector('#bo-video-product-clear').onclick=()=>{selectedId='';selected.hidden=true;search.focus()};
  form.elements.video.onchange=()=>{preparedVideo=null;if(videoObject)URL.revokeObjectURL(videoObject);const file=form.elements.video.files[0];preview.pause();if(file){videoObject=URL.createObjectURL(file);preview.src=videoObject;}else if(item.videoUrl)preview.src=item.videoUrl;else preview.removeAttribute('src');form.querySelector('.bo-video-file-preview').hidden=!file&&!item.videoUrl;};
  form.elements.cover.onchange=()=>{preparedCover=null;if(coverObject)URL.revokeObjectURL(coverObject);const file=form.elements.cover.files[0];if(file){coverObject=URL.createObjectURL(file);coverPreview.src=coverObject;preview.poster=coverObject}else if(item.cover){coverPreview.src=item.cover;preview.poster=item.cover}else coverPreview.removeAttribute('src');coverPreview.hidden=!file&&!item.cover;};
  form.querySelector('#bo-video-cancel').onclick=close;
  form.onsubmit=async event=>{
   event.preventDefault();if(saving)return;
   if(search.value.trim()){saveStatus.textContent='Select a product from the matching list, or clear your search to leave the current selection unchanged.';return;}
   const video=form.elements.video.files[0],cover=form.elements.cover.files[0];
   if(!existing&&!video){saveStatus.textContent='Choose a video file.';return;}
   if(video&&video.size>100*1024*1024){saveStatus.textContent='Choose a video up to 100 MB.';return;}
   if(cover&&cover.size>12*1024*1024){saveStatus.textContent='Choose a cover up to 12 MB.';return;}
   const next={...item,title:form.elements.title.value.trim(),productId:selectedId,published:form.elements.published.checked};
   controls(true);form.querySelectorAll('input').forEach(input=>input.disabled=true);hideResults();
   try{
    if(video){saveStatus.textContent='Uploading video…';if(!preparedVideo)preparedVideo=await options.upload(video);next.videoUrl=preparedVideo;delete next.youtubeId;}
    if(cover){saveStatus.textContent='Uploading cover image…';if(!preparedCover)preparedCover=await options.upload(cover);next.cover=preparedCover;}
    saveStatus.textContent='Saving video…';const all=structuredClone(items),index=all.findIndex(i=>i.id===item.id);if(index>=0)all[index]=next;else all.push(next);
    await persist(all);close();notice(next.published?'Video saved and published for all customers.':'Video saved. It is hidden from customers.');
   }catch(e){saveStatus.textContent=e.message;saveStatus.dataset.error='true';form.querySelectorAll('input').forEach(input=>input.disabled=false);}
   finally{controls(false);draw();}
  };
  editor.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});form.elements.title.focus({preventScroll:true});return form;
 }
 root.querySelector('#bo-video-new').onclick=()=>open(null);draw();
}
window.BOvideoManager={mount,pause:()=>document.querySelector('#bo-video-upload-form video')?.pause()};
})();
