/* Fashion collections and real-photo choices. Existing SKU stock and prices stay authoritative. */
(()=>{
 'use strict';
 const collections=['Dresses & Outfits','Baby Girl','Baby Boy','Newborn Essentials','Accessories','New Arrivals'];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clothing=p=>p?.category==='Clothing';
 const accessories=p=>/bag|accessor|cap|hat|mitten|bootie|sock/i.test(p.subcategory||'')&&!/romper|dress|outfit/i.test(p.subcategory||'');
 function belongs(p,collection){
  if(!clothing(p))return false;
  if(!p.owner_photo_import&&!String(p.id).startsWith('bo-owner-')&&!String(p.image).startsWith('/api/media/'))return false;
  if(collection==='Accessories')return accessories(p);
  if(collection==='New Arrivals')return !!p.owner_photo_import||String(p.id).startsWith('bo-owner-');
  if(collection==='Newborn Essentials')return /newborn|new born|0\s*[-–]\s*3\s*months/i.test([p.name,p.clothing?.age_range,p.product_details?.age_range].filter(Boolean).join(' '));
  if(accessories(p))return false;
  if(collection==='Baby Boy')return !/dress|frock|lace|ruffle|floral|tulle|peter pan/i.test(p.name);
  return ['Dresses & Outfits','Baby Girl','All'].includes(collection);
 }
 function choices(p){
  const patterns=(p.patterns||[]).filter(v=>v.photo&&v.available!==false);
  if(patterns.length)return patterns.map(v=>({product:p,photo:v.photo,label:v.name||'Print',pattern:v.id}));
  if(p.option_type==='colour'&&p.variant_images){
   const options=p.variants.map((v,i)=>({product:p,photo:p.variant_images[v.size]?.[0],label:v.size,index:i})).filter(v=>v.photo);
   if(options.length)return options;
  }
  const base=p.name.split(/\s+—\s+/)[0];
  const family=p.name.includes(' — ')?productsData.filter(q=>clothing(q)&&!q.catalogHidden&&q.name.split(/\s+—\s+/)[0]===base):[p];
  return family.map(q=>({product:q,photo:q.image,label:q.name.includes(' — ')?q.name.split(' — ').slice(1).join(' — '):'Current print'}));
 }
 function swatches(p,all=false){
  const list=choices(p),limit=all?list.length:matchMedia('(max-width:760px)').matches?3:4;
  return list.slice(0,limit).map((v,i)=>`<button type="button" class="bo-fashion-swatch" data-choice="${i}" data-source="${esc(p.id)}" aria-label="${esc(v.label)}" aria-pressed="${v.product.id===p.id&&(!v.pattern||v.pattern===p.selectedPatternId)&&((v.index??p.selectedVariant)===(p.selectedVariant??0))}" title="${esc(v.label)}" onclick="BOFashion.choose(event,this)"><img src="${esc(v.photo)}" alt="" loading="lazy"></button>`).join('')+(list.length>limit?`<button type="button" class="bo-fashion-more" data-source="${esc(p.id)}" aria-label="View all ${list.length} prints and colours" onclick="event.stopPropagation();openProductModal(this.dataset.source)">+${list.length-limit}</button>`:'');
 }
 const oldCard=window.productCard;
 window.productCard=function(p){
  if(!clothing(p))return oldCard(p);if(p.catalogHidden)return '';
  return `<article class="product babyone-pro-card bo-fashion-card" data-card-source="${esc(p.id)}" data-card-product="${esc(p.id)}" role="button" tabindex="0" aria-label="View ${esc(p.name)}" onclick="openProductModal(this.dataset.cardProduct)" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openProductModal(this.dataset.cardProduct)}"><div class="product-media"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div><div class="product-info"><h4 class="bo-fashion-name">${esc(p.name)}</h4><div class="bo-fashion-price">${babyonePriceLabel(p)}${Number(p.originalPrice)>Number(p.price)?` <del>${esc('₹'+Number(p.originalPrice).toLocaleString('en-IN'))}</del>`:''}</div><div class="bo-fashion-swatches" aria-label="Available prints and colours">${swatches(p)}</div></div></article>`;
 };
 function choose(event,button){
  event.stopPropagation();const source=productsData.find(p=>String(p.id)===button.dataset.source),choice=source&&choices(source)[Number(button.dataset.choice)];if(!choice)return;
  const p=choice.product;if(choice.pattern)p.selectedPatternId=choice.pattern;if(choice.index!==undefined){p.selectedVariant=choice.index;p.price=p.variants[choice.index].price;p.image=choice.photo;}
  const card=button.closest('.bo-fashion-card');
  if(card){card.dataset.cardProduct=p.id;card.setAttribute('aria-label','View '+p.name);const image=card.querySelector('.product-media img');image.src=choice.photo;image.alt=p.name;card.querySelector('.bo-fashion-name').textContent=p.name;card.querySelector('.bo-fashion-price').textContent=babyonePriceLabel(p);card.querySelectorAll('.bo-fashion-swatch').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}
  else{openProductModal(p.id);if(choice.pattern)window.babyoneSelectPattern?.(p.id,(p.patterns||[]).findIndex(v=>v.id===choice.pattern),false);}
 }
 const oldConfig=window.getNavConfig;
 window.getNavConfig=function(name){return name==='Clothing'?{subcategoryTiles:collections,tileType:Object.fromEntries(collections.map(c=>[c,'product'])),filters:Object.fromEntries(collections.map(c=>[c,['All']]))}:oldConfig(name)};
 const oldCover=window.babyoneSubcategoryCover;
 window.babyoneSubcategoryCover=function(category,tile){
  if(category!=='Clothing'||!collections.includes(tile))return oldCover(category,tile);
  const products=productsData.filter(p=>belongs(p,tile)&&!p.catalogHidden);
  const coverIds={'Dresses & Outfits':'bo-fashion-9d70-001','Baby Girl':'bo-fashion-9d70-025','Baby Boy':'bo-fashion-9d70-006','Newborn Essentials':'bo-fashion-9d70-017','Accessories':'bo-toys-261117-007','New Arrivals':'bo-fashion-9d70-003'};
  const preferred=productsData.find(p=>p.id===coverIds[tile]&&!p.catalogHidden)||products.find(p=>p.owner_photo_import)||products[0];
  const fallback=productsData.find(p=>clothing(p)&&p.owner_photo_import);
  return `<img src="${esc(preferred?.image||fallback?.image||'assets/favicon.svg')}" alt="${esc(tile)}" data-cover-category="Clothing" data-cover-tile="${esc(tile)}" loading="lazy">`;
 };
 const oldLanding=window.showSubcatLanding;
 window.showSubcatLanding=function(name){oldLanding(name);document.getElementById('subcat-tile-grid')?.classList.toggle('bo-fashion-collection-grid',name==='Clothing')};
 const oldProducts=window.getPLPProducts;
 window.getPLPProducts=function(){if(navState.category==='Clothing'&&collections.includes(navState.subcategory)){const list=productsData.filter(p=>!p.catalogHidden&&belongs(p,navState.subcategory)),seen=new Set();return list.filter(p=>{const key=p.name.includes(' — ')?p.name.split(' — ')[0]:p.id;if(seen.has(key))return false;seen.add(key);return true})}return oldProducts()};
 const oldOpen=window.openProductModal;
 window.openProductModal=function(id){
  oldOpen(id);const p=productsData.find(p=>p.id===id);if(!clothing(p))return;
  const size=document.querySelector('#modal-product-content .babyone-size-options');if(!size)return;
  const panel=document.createElement('section');panel.className='bo-fashion-product-choices';panel.innerHTML=`<strong>Print / colour</strong><div class="bo-fashion-swatches">${swatches(p,true)}</div>`;size.before(panel);
  const age=p.clothing?.age_range||p.product_details?.age_range;
  if(age){const note=document.createElement('p');note.className='bo-fashion-age';note.textContent='Age guide: '+age;size.before(note)}
  const title=size.querySelector('strong');if(title)title.textContent=p.variants?.some(v=>/months?|years?/i.test(v.size))?'Age / size':'Size';
 };
 window.BOFashion={choose,belongs,choices,collections};
})();
