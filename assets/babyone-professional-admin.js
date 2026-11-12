
(function(){
'use strict';
const KEY='babyone-pro-dashboard-edits-v2',EXTRA='babyone-admin-products-v1',CATS='babyone-category-settings-v1',DELETED='babyone-deleted-products-v1',DELCATS='babyone-deleted-categories-v1';
const $=id=>document.getElementById(id),esc=escapeHtml;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const owner=()=>window.babyoneOwnerIdentity();
const authorized=()=>owner()&&sessionStorage.getItem('babyone-admin-session')==='yes';
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));window.BOstoreCloud?.saveKey?.(k,v).catch(err=>console.warn('Catalogue cloud sync:',err.message));return true}catch{showToast('Could not save. Export a backup or reduce uploaded image sizes.');return false}}
function apply(){if(window.BO_USE_MYSQL)return;const deleted=new Set(read(DELETED,[]));for(let i=productsData.length-1;i>=0;i--)if(deleted.has(String(productsData[i].id)))productsData.splice(i,1);const ids=new Set(productsData.map(p=>p.id));for(const p of read(EXTRA,[])){if(!ids.has(p.id)&&!deleted.has(String(p.id))){productsData.push(p);ids.add(p.id)}}const edits=read(KEY,{});for(const p of productsData)if(edits[p.id])Object.assign(p,edits[p.id]);for(const c of read(CATS,[])){const old=categoriesData.find(x=>x.id===c.id);if(old)Object.assign(old,c);else categoriesData.push(c)}const deadCats=new Set(read(DELCATS,[]));for(let i=categoriesData.length-1;i>=0;i--)if(deadCats.has(categoriesData[i].name))categoriesData.splice(i,1)}
const initialProducts=new Set(productsData.filter(p=>!/^bo-(?:owner|custom)-/.test(String(p.id))).map(p=>String(p.id)));
window.BOapplySharedCatalogue=(keys=[])=>{if(window.BO_USE_MYSQL)return;
 try{
  const extras=read(EXTRA,[]),extraIDs=new Set(extras.map(p=>String(p.id))),deleted=new Set(read(DELETED,[]));
  for(let i=productsData.length-1;i>=0;i--){const id=String(productsData[i].id);if(deleted.has(id)||(!initialProducts.has(id)&&/^bo-(?:owner|custom)-/.test(id)&&!extraIDs.has(id)))productsData.splice(i,1)}
  const known=new Set(productsData.map(p=>String(p.id)));
  for(const p of extras)if(!deleted.has(String(p.id))&&!known.has(String(p.id))){productsData.push(p);known.add(String(p.id))}
  const patches=read(KEY,{}),bath=read('babyone-bath-sample-edits-v1',{});
  for(const p of productsData){if(patches[p.id])Object.assign(p,patches[p.id]);if(bath[p.id])Object.assign(p,bath[p.id])}
  const cats=read(CATS,[]),ids=new Set(cats.map(c=>String(c.id))),deadCats=new Set(read(DELCATS,[]));
  for(let i=categoriesData.length-1;i>=0;i--)if(deadCats.has(categoriesData[i].name)||(String(categoriesData[i].id).startsWith('owner-cat-')&&!ids.has(String(categoriesData[i].id))))categoriesData.splice(i,1);
  for(const c of cats){if(deadCats.has(c.name))continue;const target=categoriesData.find(x=>String(x.id)===String(c.id));if(target)Object.assign(target,c);else categoriesData.push(c)}
  refreshStore();if(authorized()){if($('bo-admin-panel-category-manager')?.classList.contains('active'))categoriesPanel();if($('bo-admin-panel-catalogue')?.classList.contains('active'))setupManager();}
 }catch(e){console.warn('Shared BabyOne catalogue UI update:',e)}
};
function refreshStore(){renderCategories();renderProductRails();if(navState.view==='plp')renderPLPGrid();if(typeof updateCart==='function')updateCart()}
function saveProduct(id,patch){if(!authorized())return false;const e=read(KEY,{});e[id]={...(e[id]||{}),...patch};if(!store(KEY,e))return false;Object.assign(productsData.find(p=>p.id===id)||{},patch);refreshStore();return true}
let mode='catalogue',page=0,selected=new Set();const pageSize=20;
function syncEntry(){const ok=owner();window.babyoneRefreshOwnerUI?.();const b=$('bo-top-dashboard');if(b){b.classList.toggle('hidden',!ok);b.style.display=ok?'inline-flex':'none'}const menu=$('bo-admin-menu-entry');if(menu){menu.classList.toggle('hidden',!ok);menu.style.display=ok?'block':'none'}const quick=$('bo-admin-quick');if(quick){quick.style.display='none'}if(!ok){sessionStorage.removeItem('babyone-admin-session');$('bo-admin-layer')?.classList.add('hidden')}}
function open(){if(owner())sessionStorage.setItem('babyone-admin-session','yes');if(!authorized()){boAdmin.openLogin();return}['bo-u-modal','cart-drawer','product-modal'].forEach(id=>$(id)?.classList.add('hidden'));boAdmin.openDashboard();syncEntry()}
window.boManager={open};
function opts(values,current,all){return (all?'<option value="">'+all+'</option>':'')+values.map(x=>'<option '+(x===current?'selected':'')+' value="'+esc(x)+'">'+esc(x)+'</option>').join('')}
function list(){const q=$('bo-m-search').value.toLowerCase().trim(),cat=$('bo-m-cat').value,sub=$('bo-m-sub').value,status=$('bo-m-status').value;return productsData.filter(p=>(!cat||p.category===cat)&&(!sub||p.subcategory===sub)&&(!q||[p.name,p.id,p.sku,p.brand].join(' ').toLowerCase().includes(q))&&(!status||status==='visible'&&!p.catalogHidden||status==='hidden'&&p.catalogHidden||status==='low'&&p.stock!==undefined&&p.stock!==null&&p.stock!==''&&Number(p.stock)>0&&Number(p.stock)<=5||status==='out'&&p.stock!==undefined&&p.stock!==null&&p.stock!==''&&Number(p.stock)===0||status==='unknown'&&(p.stock===undefined||p.stock===null||p.stock==='')))}
const known=p=>p.stock!==undefined&&p.stock!==null&&p.stock!=='';
function status(p){return p.catalogHidden?'<span class="bo-chip">Hidden</span>':!known(p)?'<span class="bo-chip">Stock unset</span>':Number(p.stock)===0?'<span class="bo-chip out">Out of stock</span>':Number(p.stock)<=5?'<span class="bo-chip low">Low stock</span>':'<span class="bo-chip">In stock</span>'}
function setupManager(){const root=$('bo-admin-panel-catalogue');root.innerHTML='<div class="bo-admin-card"><div class="bo-edit-head"><div><h3 id="bo-m-title">Product catalogue</h3><p class="bo-muted">Manage products by category, update quantities and keep the storefront current.</p></div><button class="bo-admin-btn" id="bo-m-add">+ Add product</button></div><div class="bo-summary" id="bo-m-summary"></div><div class="bo-manager-tools"><input id="bo-m-search" class="bo-admin-field" aria-label="Search products" placeholder="Search product, brand or SKU"><select id="bo-m-cat" class="bo-admin-field" aria-label="Filter category"></select><select id="bo-m-sub" class="bo-admin-field" aria-label="Filter subcategory"><option value="">All subcategories</option></select><select id="bo-m-status" class="bo-admin-field" aria-label="Filter stock or visibility"><option value="">All statuses</option><option value="visible">Visible</option><option value="hidden">Hidden</option><option value="low">Low stock (1–5)</option><option value="out">Out of stock</option><option value="unknown">Stock unset</option></select></div><div class="bo-manager-actions"><span class="bo-muted" id="bo-m-selection">0 selected</span><select id="bo-m-bulk" class="bo-admin-field" style="width:auto" aria-label="Bulk action"><option value="set">Set stock to</option><option value="add">Add units</option><option value="subtract">Subtract units</option><option value="hide">Hide products</option><option value="show">Show products</option></select><input id="bo-m-amount" class="bo-stock-input" type="number" min="0" step="1" placeholder="Quantity" aria-label="Bulk quantity"><button class="bo-admin-btn secondary" id="bo-m-apply">Apply to selected</button><button class="bo-admin-btn secondary" id="bo-m-csv">Export filtered CSV</button></div><p id="bo-m-feedback" class="bo-save-status" role="status"></p><div class="bo-table-wrap"><table class="bo-admin-table"><thead><tr><th><input id="bo-m-all" type="checkbox" aria-label="Select this page"></th><th>Product</th><th>Category</th><th>Price</th><th>Stock quantity</th><th>Status</th><th>Actions</th></tr></thead><tbody id="bo-m-rows"></tbody></table></div><div id="bo-m-pages" class="bo-manager-actions"></div><p class="bo-muted">Changes save locally and sync to Firebase when the owner is connected. Export a backup regularly. Stock unset means no quantity has been entered.</p></div>';
$('bo-m-cat').innerHTML=opts(categoriesData.map(c=>c.name),'','All categories');
$('bo-m-cat').onchange=()=>{const cat=categoriesData.find(c=>c.name===$('bo-m-cat').value);$('bo-m-sub').innerHTML=opts([...new Set([...(cat?.subcategories||[]),...productsData.filter(p=>p.category===cat?.name).map(p=>p.subcategory).filter(Boolean)])],'','All subcategories');reset()};
for(const id of ['bo-m-search','bo-m-sub','bo-m-status'])$(id).addEventListener(id==='bo-m-search'?'input':'change',reset);
$('bo-m-add').onclick=()=>edit();$('bo-m-apply').onclick=bulk;$('bo-m-csv').onclick=csv;$('bo-m-all').onchange=e=>{list().slice(page*pageSize,(page+1)*pageSize).forEach(p=>e.target.checked?selected.add(p.id):selected.delete(p.id));render()};render();
}
function reset(){page=0;selected.clear();render()}
function render(){if(!$('bo-m-rows'))return;const all=list(),pages=Math.max(1,Math.ceil(all.length/pageSize));page=Math.min(page,pages-1);const current=all.slice(page*pageSize,(page+1)*pageSize);$('bo-m-title').textContent=mode==='inventory'?'Stock & inventory':'Product catalogue';$('bo-m-summary').innerHTML=[['Products',all.length],['Visible',all.filter(p=>!p.catalogHidden).length],['Low stock',all.filter(p=>known(p)&&p.stock>0&&p.stock<=5).length],['Units on hand',all.reduce((s,p)=>s+(known(p)?Number(p.stock):0),0)]].map(([k,v])=>'<div><span class="bo-muted">'+k+'</span><strong>'+v.toLocaleString('en-IN')+'</strong></div>').join('');$('bo-m-selection').textContent=selected.size+' selected';$('bo-m-all').checked=current.length>0&&current.every(p=>selected.has(p.id));$('bo-m-rows').innerHTML=current.map(p=>'<tr data-id="'+esc(p.id)+'"><td><input type="checkbox" data-select '+(selected.has(p.id)?'checked':'')+' aria-label="Select '+esc(p.name)+'"></td><td><div class="bo-product-cell"><img src="'+esc(p.image||'')+'" alt=""><div><b>'+esc(p.name)+'</b><small>'+esc(p.sku||p.brand||p.id)+'</small></div></div></td><td>'+esc(p.category)+'<br><small class="bo-muted">'+esc(p.subcategory||'')+'</small></td><td>'+babyonePriceLabel(p)+'</td><td><input class="bo-stock-input" data-stock type="number" min="0" step="1" value="'+(known(p)?Number(p.stock):'')+'" placeholder="Unset" aria-label="Stock for '+esc(p.name)+'"> <button class="bo-admin-btn secondary" data-save>Save</button></td><td>'+status(p)+'</td><td><button class="bo-admin-btn secondary" data-edit>Edit</button> <button class="bo-admin-btn" style="background:#b93e50;margin-top:5px" data-delete>Delete</button></td></tr>').join('')||'<tr><td colspan="7">No products match these filters.</td></tr>';
$('bo-m-rows').querySelectorAll('tr[data-id]').forEach(row=>{const id=row.dataset.id;row.querySelector('[data-select]').onchange=e=>{e.target.checked?selected.add(id):selected.delete(id);$('bo-m-selection').textContent=selected.size+' selected'};row.querySelector('[data-edit]').onclick=()=>edit(id);row.querySelector('[data-delete]').onclick=()=>deleteProduct(id);row.querySelector('[data-save]').onclick=()=>{const input=row.querySelector('[data-stock]');if(!input.reportValidity())return;const p=productsData.find(p=>p.id===id);if(p.variants?.some(v=>v.stock!==undefined&&v.stock!==null&&v.stock!=='')){edit(id);$('bo-e-message').textContent='Update quantities for each size or colour; total stock is calculated automatically.';return}if(saveProduct(id,{stock:input.value===''?null:Number(input.value),stockUnconfirmed:input.value===''})){render();$('bo-m-feedback').textContent='Stock saved.'}}});
$('bo-m-pages').innerHTML='<button class="bo-admin-btn secondary" id="bo-m-prev" '+(page===0?'disabled':'')+'>Previous</button><span class="bo-muted">Page '+(page+1)+' of '+pages+' · '+all.length+' products</span><button class="bo-admin-btn secondary" id="bo-m-next" '+(page+1>=pages?'disabled':'')+'>Next</button>';$('bo-m-prev').onclick=()=>{page--;render()};$('bo-m-next').onclick=()=>{page++;render()};}
function deleteProduct(id){
 if(!authorized())return;
 const p=productsData.find(x=>String(x.id)===String(id));if(!p)return;
 if(!window.confirm('Permanently remove "'+p.name+'" from the BabyOne catalogue? This cannot be undone in this browser.'))return;
 const deleted=read(DELETED,[]);if(!deleted.includes(String(id)))deleted.push(String(id));
 if(!store(DELETED,deleted))return;
 const extra=read(EXTRA,[]);store(EXTRA,extra.filter(x=>String(x.id)!==String(id)));
 productsData.splice(productsData.findIndex(x=>String(x.id)===String(id)),1);
 selected.delete(id);
 if(typeof cart!=='undefined'&&Array.isArray(cart)){for(let i=cart.length-1;i>=0;i--)if(String(cart[i].id)===String(id))cart.splice(i,1)}
 refreshStore();render();$('bo-m-feedback').textContent='Product deleted: '+p.name;
}
function bulk(){if(!authorized())return;const action=$('bo-m-bulk').value,n=Number($('bo-m-amount').value),items=productsData.filter(p=>selected.has(p.id));if(!items.length){$('bo-m-feedback').textContent='Select products first.';return}if(!['show','hide'].includes(action)&&($('bo-m-amount').value===''||!Number.isInteger(n)||n<0)){$('bo-m-feedback').textContent='Enter a whole quantity of zero or more.';return}if(!['show','hide'].includes(action)&&items.some(p=>p.variants?.some(v=>v.stock!=null&&v.stock!==''))){$('bo-m-feedback').textContent='Products with size or colour stock must be updated in the product editor.';return}if(['add','subtract'].includes(action)&&items.some(p=>!known(p))){$('bo-m-feedback').textContent='Set an initial stock quantity before adding or subtracting units.';return}const e=read(KEY,{});const patches=items.map(p=>[p.id,['hide','show'].includes(action)?{catalogHidden:action==='hide'}:{stock:action==='set'?n:Math.max(0,Number(p.stock)+(action==='add'?n:-n)),stockUnconfirmed:false}]);for(const [id,patch]of patches)e[id]={...(e[id]||{}),...patch};if(store(KEY,e)){apply();refreshStore();render();$('bo-m-feedback').textContent=items.length+' products updated.'}}
function download(data,type,name){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csv(){const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';download([['ID','Name','Category','Subcategory','Price INR','Stock','Hidden'],...list().map(p=>[p.id,p.name,p.category,p.subcategory,babyoneINRValue(p),p.stock,p.catalogHidden?'Yes':'No'])].map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8','BabyOne_Products.csv')}
let variants=[];
function renderVariants(){const el=$('bo-e-variants');el.innerHTML=variants.map((v,i)=>'<div class="bo-variant-row"><input data-v="'+i+'" data-field="size" aria-label="Size or colour" placeholder="Size / ML / Colour / Custom" value="'+esc(v.size||v.name||v.label||'')+'"><input data-v="'+i+'" data-field="price" aria-label="Variant price" type="number" min="0" step="0.01" value="'+(v.price??'')+'" placeholder="Price ₹"><input data-v="'+i+'" data-field="stock" aria-label="Variant stock" type="number" min="0" step="1" value="'+(v.stock??'')+'" placeholder="Stock"><button type="button" class="bo-admin-btn secondary" data-remove="'+i+'" aria-label="Remove variant">×</button></div>').join('');el.querySelectorAll('input').forEach(x=>x.oninput=()=>{variants[Number(x.dataset.v)][x.dataset.field]=x.value===''?null:x.dataset.field==='size'?x.value:Number(x.value)});el.querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{variants.splice(Number(x.dataset.remove),1);renderVariants()})}
function edit(id){if(!authorized())return;const p=productsData.find(p=>p.id===id)||{name:'',category:$('bo-m-cat')?.value||categoriesData[0].name,currency:'INR',price:0};variants=(p.variants||[]).map(v=>({...v,price:v.price!=null?(p.currency==='INR'?v.price:Math.round(v.price*83.5)):null}));let dialog=$('bo-editor-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='bo-editor-dialog';dialog.className='bo-edit-dialog';document.body.append(dialog)}
dialog.innerHTML='<form id="bo-e-form"><div class="bo-edit-head"><div><h3>'+(id?'Edit product':'Add product')+'</h3><p class="bo-muted">Product details, category, images and stock</p></div><button type="button" class="bo-admin-btn secondary" id="bo-e-close">Close</button></div><div class="bo-edit-grid"><label class="full">Product name<input name="name" required maxlength="240" value="'+esc(p.name)+'"></label><label>Category<select name="category" id="bo-e-category">'+opts(categoriesData.map(c=>c.name),p.category)+'</select></label><label>Subcategory<input name="subcategory" list="bo-e-subs" required value="'+esc(p.subcategory||'')+'"><datalist id="bo-e-subs"></datalist></label><label>Price (₹)<input name="price" type="number" min="0" step="0.01" required value="'+Number(babyoneINRValue(p).toFixed(2))+'"></label><label>Original price (₹)<input name="originalPrice" type="number" min="0" step="0.01" value="'+(p.originalPrice?(p.currency==='INR'?p.originalPrice:Math.round(p.originalPrice*83.5)):'')+'"></label><label>SKU<input name="sku" value="'+esc(p.sku||'')+'"></label><label>Brand<input name="brand" value="'+esc(p.brand||'')+'"></label><label>Total stock quantity<input name="stock" type="number" min="0" step="1" placeholder="Leave blank if not tracked" value="'+(known(p)?p.stock:'')+'"></label><label>Product badge<input name="badge" value="'+esc(p.badge||'')+'"></label><label class="full">Description<textarea name="description" rows="4">'+esc(p.description||'')+'</textarea></label><label class="full">Upload a main photo<input name="upload" type="file" accept="image/*"><small class="bo-muted">Use an image under 1 MB; images are saved in this browser.</small></label><label class="full">Upload gallery photos (select multiple)<input name="galleryUpload" type="file" accept="image/*" multiple><small>Leave empty to keep existing gallery images.</small></label><div class="full"><h4>Product variants — Size / ML / Colour / Custom</h4><label class="bo-admin-label">Variant type<select id="bo-e-variant-type" class="bo-admin-field"><option value="Size">Size</option><option value="ML">ML (millilitres)</option><option value="Colour">Colour</option><option value="Custom">Custom</option></select></label><p class="bo-muted">Enter label, price (₹) and stock for each option. When variant stock is used, fill every option; total stock is calculated from these quantities.</p><div id="bo-e-variants"></div><button id="bo-e-add-variant" type="button" class="bo-admin-btn secondary">+ Add variant</button></div><label><input type="checkbox" name="hidden" '+(p.catalogHidden?'checked':'')+'> Hide from store</label><label><input type="checkbox" name="sample" '+(p.catalogueSample?'checked':'')+'> Sample listing</label></div><p class="bo-save-status" role="status" id="bo-e-message"></p><footer><button class="bo-admin-btn" type="submit">Save product</button><button class="bo-admin-btn secondary" id="bo-e-cancel" type="button">Cancel</button></footer></form>';
const galleryArea=document.createElement('div');galleryArea.className='full';galleryArea.innerHTML='<h4>Gallery images — remove individually</h4><div id="bo-gallery-preview" style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0"></div>';
let keptGallery=[...(p.galleryImages||p.images||[])], queuedGallery=[];
const galleryInput=dialog.querySelector('[name="galleryUpload"]');galleryInput.closest('label').after(galleryArea);
const previewBox=galleryArea.querySelector('#bo-gallery-preview');
const galleryHint=document.createElement('p');galleryHint.className='bo-muted';galleryHint.style='font-size:12px;margin:6px 0';galleryArea.insertBefore(galleryHint,previewBox);
let galleryBusy=false;
function galleryPreview(){
 previewBox.replaceChildren();
 [...keptGallery,...queuedGallery].forEach((src,i)=>{
  const tile=document.createElement('div');tile.style='position:relative;width:94px;flex:0 0 94px';
  const img=document.createElement('img');img.src=src;img.alt='Gallery photo '+(i+1);img.style='width:94px;height:96px;object-fit:cover;border-radius:10px;border:1px solid #dce5ed';
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove this gallery image';remove.setAttribute('aria-label','Remove gallery photo '+(i+1));remove.style='position:absolute;right:-5px;top:-5px;border:0;background:#bd3048;color:white;border-radius:50%;width:27px;height:27px;font-size:19px;cursor:pointer';
  remove.onclick=()=>{if(i<keptGallery.length)keptGallery.splice(i,1);else queuedGallery.splice(i-keptGallery.length,1);galleryPreview()};
  tile.append(img,remove);previewBox.append(tile);
 });
 galleryHint.textContent=(keptGallery.length+queuedGallery.length)+' gallery photo(s) selected. Click × to remove individual images before saving.';
}
async function prepareGalleryImage(file){
 if(!file.type.startsWith('image/'))throw Error(file.name+': Not an image');
 // Compress large images so every selected file can be saved within browser storage limits.
 const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read '+file.name));reader.readAsDataURL(file)});
 if(file.size<=550000)return src;
 const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Could not open '+file.name));im.src=src});
 const scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',0.78);
}
galleryInput.onchange=async()=>{
 const selected=[...galleryInput.files];galleryInput.value='';if(!selected.length)return;
 galleryBusy=true;galleryInput.disabled=true;galleryHint.textContent='Processing '+selected.length+' selected image(s)…';
 const failures=[];
 for(const file of selected){try{queuedGallery.push(await prepareGalleryImage(file))}catch(err){failures.push(err.message)}}
 galleryBusy=false;galleryInput.disabled=false;galleryPreview();
 if(failures.length)document.getElementById('bo-e-message').textContent=failures.join('; ');
};galleryPreview();
const form=$('bo-e-form');function subOptions(){$('bo-e-subs').innerHTML=(categoriesData.find(c=>c.name===form.elements.category.value)?.subcategories||[]).map(s=>'<option value="'+esc(s)+'">').join('')}subOptions();$('bo-e-category').onchange=subOptions;$('bo-e-close').onclick=$('bo-e-cancel').onclick=()=>dialog.close();$('bo-e-add-variant').onclick=()=>{variants.push({size:'',price:null,stock:null});renderVariants()};const vt=$('bo-e-variant-type');vt.value=p.variantType||'Size';vt.onchange=()=>{document.querySelectorAll('#bo-e-variants input[data-field="size"]').forEach(x=>x.placeholder=vt.value==='ML'?'e.g. 100 ML':vt.value==='Colour'?'e.g. Blue':vt.value==='Custom'?'e.g. Pack of 2':'e.g. Small')};renderVariants();vt.onchange();
form.onsubmit=async e=>{e.preventDefault();if(!authorized()||!form.reportValidity())return;if(galleryBusy){$('bo-e-message').textContent='Please wait until all gallery photos finish processing.';return}const f=form.elements;if(variants.some(v=>!String(v.size||'').trim())){$('bo-e-message').textContent='Enter a size or colour label for each variant.';return}if(new Set(variants.map(v=>v.size.trim().toLowerCase())).size!==variants.length){$('bo-e-message').textContent='Each variant needs a different size or colour label.';return}const tracking=variants.some(v=>v.stock!=null&&v.stock!=='');if(tracking&&variants.some(v=>v.stock==null||v.stock==='')){$('bo-e-message').textContent='Enter stock for every variant, including zero for sold-out options.';return}let image=p.image||'';const file=f.upload.files[0];if(file){if(file.size>1000000||!file.type.startsWith('image/')){$('bo-e-message').textContent='Choose an image smaller than 1 MB.';return}image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}let gallery=[...keptGallery,...queuedGallery];if(file&&!gallery.includes(image))gallery.unshift(image);const patch={variantType:vt.value,name:f.name.value.trim(),category:f.category.value,subcategory:f.subcategory.value.trim(),price:Number(f.price.value),originalPrice:f.originalPrice.value===''?null:Number(f.originalPrice.value),currency:'INR',sku:f.sku.value.trim(),brand:f.brand.value.trim(),badge:f.badge.value.trim(),description:f.description.value,image,galleryImages:gallery,images:gallery,stock:tracking?variants.reduce((s,v)=>s+Number(v.stock),0):f.stock.value===''?null:Number(f.stock.value),variants:variants.map(v=>({...v,size:v.size.trim(),price:v.price==null?Number(f.price.value):v.price})),catalogHidden:f.hidden.checked,catalogueSample:f.sample.checked,priceEstimate:f.sample.checked,stockUnconfirmed:!tracking&&f.stock.value===''};
if(!id){const product={...patch,id:'bo-owner-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),rating:0,reviews:0,catalogueCurated:true};const extra=read(EXTRA,[]);extra.push(product);if(!store(EXTRA,extra))return;productsData.push(product);refreshStore()}else if(!saveProduct(id,patch))return;
const cat=categoriesData.find(c=>c.name===patch.category);if(cat&&!cat.subcategories.includes(patch.subcategory)){cat.subcategories.push(patch.subcategory);store(CATS,categoriesData)}dialog.close();render();$('bo-m-feedback').textContent='Product saved. Storefront updated.';};dialog.showModal();}
function categoriesPanel(){const root=$('bo-admin-panel-category-manager');root.innerHTML='<div class="bo-admin-card"><h3>Categories & subcategories</h3><p class="bo-muted">Add a category or subcategory, then assign products in the catalogue editor.</p><form id="bo-category-form" class="bo-manager-actions"><input class="bo-admin-field" style="max-width:280px" name="name" required placeholder="New category name"><button class="bo-admin-btn">Add category</button></form><div id="bo-category-list"></div></div>';$('bo-category-form').onsubmit=e=>{e.preventDefault();const name=e.target.elements.name.value.trim();if(!name||categoriesData.some(c=>c.name.toLowerCase()===name.toLowerCase())){showToast('Enter a unique category name');return}const c={id:'owner-cat-'+Date.now(),name,img:'',subcategories:[]};if(read(DELCATS,[]).includes(name))store(DELCATS,read(DELCATS,[]).filter(x=>x!==name));if(store(CATS,[...categoriesData,c])){categoriesData.push(c);categoriesPanel();refreshStore();setupManager()}};const list=$('bo-category-list');categoriesData.forEach(c=>{const row=document.createElement('div');row.className='bo-admin-card';row.style.marginTop='14px';row.innerHTML='<b>'+esc(c.name)+'</b><p class="bo-muted">'+c.subcategories.map(esc).join(' · ')+'</p><form class="bo-manager-actions"><input class="bo-admin-field" style="max-width:280px" required aria-label="New subcategory for '+esc(c.name)+'" placeholder="New subcategory"><button class="bo-admin-btn secondary">Add subcategory</button></form>';const cover=document.createElement('div');cover.className='bo-category-cover-edit';
 const thumb=document.createElement('img');thumb.src=c.img||'';thumb.alt=c.name+' category cover';thumb.loading='lazy';
 const coverActions=document.createElement('div');const coverLabel=document.createElement('label');coverLabel.className='bo-admin-label';coverLabel.textContent='Main category cover photo';
 const coverFile=document.createElement('input');coverFile.className='bo-admin-field';coverFile.type='file';coverFile.accept='image/*';coverFile.setAttribute('aria-label','Upload cover image for '+c.name);
 const coverMessage=document.createElement('p');coverMessage.className='bo-muted';coverMessage.textContent='Upload a photo to replace this category cover (mobile and desktop).';
 coverActions.append(coverLabel,coverFile,coverMessage);cover.append(thumb,coverActions);row.append(cover);
 coverFile.onchange=async()=>{const file=coverFile.files?.[0];if(!file)return;if(!authorized()){coverMessage.textContent='Please open as admin first.';return;}
   coverFile.disabled=true;coverMessage.textContent='Preparing cover image…';
   try{const image=await new Promise((resolve,reject)=>{const im=new Image(),url=URL.createObjectURL(file);im.onload=()=>{try{const canvas=document.createElement('canvas'),scale=Math.min(1,900/Math.max(im.naturalWidth,im.naturalHeight));canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.8);URL.revokeObjectURL(url);resolve(data);}catch(error){URL.revokeObjectURL(url);reject(error)}};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not read image'))};im.src=url});
      const next=categoriesData.map(x=>x.id===c.id?{...x,img:image}:x);
      if(!store(CATS,next))throw Error('Could not save cover in this browser');c.img=image;thumb.src=image;refreshStore();coverMessage.textContent='Cover saved here. Publishing to customers if your Firebase owner account is connected…';
      if(window.BOheroCloud?.user?.()){
        try{const res=await fetch(image),blob=await res.blob();const fileForCloud=new File([blob],'category-cover.jpg',{type:'image/jpeg'});const published=await window.BOheroCloud.uploadImage(fileForCloud,'category-cover');await window.BOheroCloud.saveCategoryCover(c.name,published.url);c.img=published.url;store(CATS,categoriesData);thumb.src=published.url;refreshStore();coverMessage.textContent='Cover saved and published across devices.'}
        catch(error){coverMessage.textContent='Saved here only; cloud publishing failed: '+(error.message||error)}
      }else coverMessage.textContent='Cover saved on this device. Connect Firebase under Videos to publish everywhere.';
    }catch(error){coverMessage.textContent='Could not save cover: '+(error.message||error)}finally{coverFile.disabled=false;coverFile.value=''}};
const subList=document.createElement('div');subList.style='display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';(c.subcategories||[]).forEach(sub=>{const chip=document.createElement('div');chip.style='display:inline-flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid #e1e8ef;border-radius:10px;background:#f7fafc;font-size:12px';const name=document.createElement('span');name.textContent=sub;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Delete subcategory '+sub);remove.title='Delete subcategory '+sub;remove.style='border:0;border-radius:6px;background:#ffe9ed;color:#ad3046;font-size:17px;cursor:pointer;padding:2px 8px';remove.onclick=()=>{if(!authorized())return;const affected=productsData.filter(p=>p.category===c.name&&p.subcategory===sub);if(!confirm('FIRST CONFIRMATION: Delete subcategory "'+sub+'" from "'+c.name+'" and '+affected.length+' products?'))return;if(!confirm('SECOND CONFIRMATION: Permanently delete "'+sub+'" and its products?'))return;const deleted=new Set(read(DELETED,[]));affected.forEach(p=>deleted.add(String(p.id)));if(!store(DELETED,[...deleted]))return;const next=categoriesData.map(x=>x.id===c.id?{...x,subcategories:x.subcategories.filter(v=>v!==sub)}:x);if(!store(CATS,next))return;const tombstones=read('babyone-deleted-subcategories-v1',[]);if(!store('babyone-deleted-subcategories-v1',[...new Set([...tombstones,c.name+'::'+sub])]))return;c.subcategories=c.subcategories.filter(v=>v!==sub);for(let j=productsData.length-1;j>=0;j--)if(productsData[j].category===c.name&&productsData[j].subcategory===sub)productsData.splice(j,1);store(EXTRA,read(EXTRA,[]).filter(p=>!(p.category===c.name&&p.subcategory===sub)));categoriesPanel();setupManager();refreshStore();showToast('Subcategory deleted')};chip.append(name,remove);subList.append(chip)});row.append(subList);
const del=document.createElement('button');del.type='button';del.className='bo-admin-btn';del.style.background='#b93e50';del.style.marginTop='10px';del.textContent='Delete entire category';row.append(del);del.onclick=()=>{if(!authorized())return;const affected=productsData.filter(p=>p.category===c.name);if(!confirm('FIRST CONFIRMATION: Delete category "'+c.name+'" and '+affected.length+' associated products?'))return;if(!confirm('SECOND CONFIRMATION: Permanently delete "'+c.name+'" and all its products from this browser?'))return;const deleted=new Set(read(DELETED,[]));affected.forEach(p=>deleted.add(String(p.id)));if(!store(DELETED,[...deleted]))return;const next=categoriesData.filter(x=>x.name!==c.name);if(!store(DELCATS,[...new Set([...read(DELCATS,[]),c.name])]))return;if(!store(CATS,next))return;categoriesData.splice(categoriesData.findIndex(x=>x.name===c.name),1);for(let i=productsData.length-1;i>=0;i--)if(productsData[i].category===c.name)productsData.splice(i,1);const extra=read(EXTRA,[]);store(EXTRA,extra.filter(p=>p.category!==c.name));categoriesPanel();setupManager();refreshStore();showToast('Category deleted');};
row.querySelector('form').onsubmit=e=>{e.preventDefault();const name=e.target.querySelector('input').value.trim();if(!name||c.subcategories.includes(name))return;const next=categoriesData.map(x=>x===c?{...x,subcategories:[...x.subcategories,name]}:x);if(store(CATS,next)){c.subcategories.push(name);categoriesPanel();refreshStore();setupManager()}};list.append(row)})}

const baseConfig=getNavConfig;
window.getNavConfig=function(name){const base=baseConfig(name),c=categoriesData.find(c=>c.name===name);if(!base||!c)return base;const removed=new Set(read('babyone-deleted-subcategories-v1',[]));const tiles=[...new Set([...base.subcategoryTiles,...c.subcategories])].filter(t=>!removed.has(name+'::'+t));return {...base,subcategoryTiles:tiles,filters:{...Object.fromEntries(tiles.map(t=>[t,['All']])),...base.filters}}};
const basePLP=getPLPProducts;
window.getPLPProducts=function(){const c=navState.category,t=navState.subcategory;if(c==='Bath & Skincare'&&!bathSkinCareNav.subcategoryTiles.includes(t))return productsData.filter(p=>!p.catalogHidden&&p.category===c&&p.subcategory===t);return basePLP()};

function start(){apply();let button=$('bo-top-dashboard');if(!button){button=document.createElement('button');button.id='bo-top-dashboard';button.className='bo-dashboard-entry hidden';button.textContent='Dashboard';document.querySelector('.header-actions').prepend(button)}button.onclick=open;syncEntry();
const nav=document.querySelector('.bo-admin-nav'),catBtn=document.createElement('button');catBtn.textContent='Categories';catBtn.dataset.panel='category-manager';catBtn.onclick=()=>boAdmin.tab('category-manager',catBtn);nav.append(catBtn);const section=document.createElement('section');section.id='bo-admin-panel-category-manager';section.className='bo-admin-panel';document.querySelector('.bo-admin-grid>main').append(section);setupManager();categoriesPanel();
const videoBtn=document.createElement('button');videoBtn.textContent='Videos';videoBtn.dataset.panel='video-manager';videoBtn.onclick=()=>boAdmin.tab('video-manager',videoBtn);nav.append(videoBtn);const videoPanel=document.createElement('section');videoPanel.id='bo-admin-panel-video-manager';videoPanel.className='bo-admin-panel';document.querySelector('.bo-admin-grid>main').append(videoPanel);
function videoManager(){
 videoPanel.innerHTML=`<div class="bo-admin-card bo-mobile-video-manager bo-video-simple">
  <h3>Add a video</h3><p class="bo-video-help">Choose a video file, enter the title, link a product if you wish, then Save Video.</p>
  <form id="bo-video-form" class="bo-video-easy-form">
   <label class="bo-admin-label" for="bo-video-picker">Upload video file</label>
   <input class="bo-admin-field bo-video-file-input" id="bo-video-picker" type="file" accept="video/*,.mp4,.mov,.m4v,.webm,.3gp" required>
   <div id="bo-video-file-status" class="bo-video-file-status" role="status" aria-live="polite">Choose a video from your phone or computer.</div>
   <div id="bo-video-preview-wrap" hidden><button type="button" id="bo-video-preview-start" class="bo-admin-btn secondary">Preview selected video</button><video id="bo-video-preview" controls playsinline preload="none" hidden></video><button type="button" id="bo-video-clear" class="bo-admin-btn secondary">Choose another video</button></div>
   <label class="bo-admin-label" for="bo-video-cover-picker">Video cover photo <span class="bo-video-optional">(optional)</span></label>
   <input class="bo-admin-field bo-video-cover-picker" id="bo-video-cover-picker" type="file" accept="image/*,.jpg,.jpeg,.png,.webp">
   <div class="bo-video-cover-preview-row" id="bo-video-cover-preview-row"><img id="bo-video-cover-preview" hidden alt="Selected video cover"><div><span id="bo-video-cover-note">Choose a cover image, or we'll automatically use a frame from your video.</span><button id="bo-video-cover-reset" class="bo-admin-btn secondary" type="button" hidden>Use video frame instead</button></div></div>
   <label class="bo-admin-label" for="bo-video-title">Video title</label>
   <input class="bo-admin-field" id="bo-video-title" maxlength="120" type="text" placeholder="Video title" required>
   <label class="bo-admin-label" for="bo-video-search">Related product (optional)</label>
   <input class="bo-admin-field" id="bo-video-search" type="search" placeholder="Search your products..." autocomplete="off">
   <div id="bo-video-matches" class="bo-video-matches" role="listbox"></div>
   <div id="bo-video-selected" class="bo-video-linked-note">No product selected</div>
   <div id="bo-video-progress" class="bo-video-progress" role="status" aria-live="polite"></div>
   <button id="bo-video-save" class="bo-admin-btn bo-video-save" type="submit">Save Video</button>
  </form>
  <details class="bo-video-cloud-setup"><summary>Publish videos to every customer</summary>
   <p>Connect your Firebase owner account once to publish videos across devices. Until connected, videos save on this device only. Your original videos are never deleted.</p>
   <div id="bo-cloud-login"><input id="bo-cloud-email" class="bo-admin-field" type="email" autocomplete="username" placeholder="Firebase owner email"><input id="bo-cloud-password" class="bo-admin-field" type="password" autocomplete="current-password" placeholder="Firebase password"><button type="button" id="bo-cloud-connect" class="bo-admin-btn secondary">Connect Firebase</button></div>
   <p id="bo-cloud-status" role="status">Checking cloud availability…</p>
  </details>
  <div id="bo-video-storage-mode" class="bo-video-storage-mode" role="status">Saved videos on this device are only visible here. Sign in to Firebase above to publish them for customers.</div>
  <h4 class="bo-video-existing-head">Your videos</h4><div id="bo-video-list" class="bo-video-list"></div>
 </div>`;
 const by=id=>videoPanel.querySelector('#'+id),form=by('bo-video-form'),picker=by('bo-video-picker'),title=by('bo-video-title'),search=by('bo-video-search'),matches=by('bo-video-matches'),selected=by('bo-video-selected'),status=by('bo-video-file-status'),preview=by('bo-video-preview'),previewWrap=by('bo-video-preview-wrap'),previewStart=by('bo-video-preview-start'),progress=by('bo-video-progress'),save=by('bo-video-save'),list=by('bo-video-list'),coverPicker=by('bo-video-cover-picker'),coverPreview=by('bo-video-cover-preview'),coverNote=by('bo-video-cover-note'),coverReset=by('bo-video-cover-reset');
 let chosen='',busy=false,previewUrl='',chosenCover='',coverBusy=false,coverRequest=0;
 // A thumbnail is stored as a small JPEG, not as the original full-resolution image.
 // That makes covers usable in both local browser data and Firebase Firestore metadata.
 async function imageCover(file){
  if(!file || !(file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name||'')))throw new Error('Please choose a JPG, PNG or WebP picture.');
  const url=URL.createObjectURL(file);
  try{
   const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(new Error('This photo format cannot be opened. Try JPG or PNG.'));x.src=url});
   const canvas=document.createElement('canvas');canvas.width=270;canvas.height=480;
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image editing is not available in this browser.');
   const iw=img.naturalWidth,ih=img.naturalHeight;if(!iw||!ih)throw new Error('The selected cover is empty.');
   ctx.fillStyle='#f5f7fb';ctx.fillRect(0,0,canvas.width,canvas.height);
   const scale=Math.max(canvas.width/iw,canvas.height/ih),w=iw*scale,h=ih*scale;
   ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
   let data=canvas.toDataURL('image/jpeg',.74);
   if(data.length>135000)data=canvas.toDataURL('image/jpeg',.54);
   if(data.length>210000)throw new Error('Cover image is too complex. Please choose a simpler photo.');
   return data;
  }finally{URL.revokeObjectURL(url)}
 }
 function showCover(data){
  coverPreview.hidden=!data;coverPreview.removeAttribute('src');
  if(data)coverPreview.src=data;
  if(data && picker.files?.[0])preview.poster=data;else preview.removeAttribute('poster');
  coverReset.hidden=!data;
  coverNote.textContent=data?'This cover will appear on the video before a customer taps Play.':'Choose a cover image, or we\'ll automatically use a frame from your video.';
 }
 coverPicker.addEventListener('change',async()=>{
  const file=coverPicker.files?.[0],request=++coverRequest;
  chosenCover='';showCover('');if(!file)return;
  coverBusy=true;coverNote.textContent='Preparing your cover photo…';
  try{const data=await imageCover(file);if(request!==coverRequest)return;chosenCover=data;showCover(data)}
  catch(error){if(request===coverRequest){coverNote.textContent=error.message||'Unable to open the cover photo';coverPicker.value=''}}
  finally{if(request===coverRequest)coverBusy=false}
 });
 coverReset.onclick=()=>{coverRequest++;coverBusy=false;chosenCover='';coverPicker.value='';showCover('')};
 function cloudState(){const c=window.BOvideoCloud,connected=!!c?.user?.();by('bo-cloud-status').textContent=connected?'Connected as '+c.user().email+' — new videos will be published for customers.':(c?.ready?'Not connected. Sign in once to publish to customers.':'Cloud loading or unavailable. Local device saving is available.');by('bo-cloud-login').hidden=connected;by('bo-video-storage-mode').textContent=connected?'Cloud mode: videos are uploaded to Firebase and shown on your website.':'Device mode: videos stay on this browser. For shared public videos, connect Firebase above.'}
 cloudState();videoPanel.addEventListener('bo-cloud-change',cloudState);window.addEventListener('bo-video-cloud-change',cloudState,{once:true});
 by('bo-cloud-connect').onclick=async()=>{const c=window.BOvideoCloud;if(!c?.ready){by('bo-cloud-status').textContent='Firebase not ready. Open the deployed HTTPS website with internet access.';return}const btn=by('bo-cloud-connect');btn.disabled=true;by('bo-cloud-status').textContent='Connecting…';try{await c.login(by('bo-cloud-email').value,by('bo-cloud-password').value);by('bo-cloud-password').value='';cloudState()}catch(e){by('bo-cloud-status').textContent='Sign in failed: '+(e.message||'check your Firebase account and settings')}finally{btn.disabled=false}};
 function clearPreview(){try{preview.pause();preview.removeAttribute('src');preview.removeAttribute('poster')}catch(_){}if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}preview.hidden=true;previewStart.hidden=false;previewWrap.hidden=true}
 picker.addEventListener('change',()=>{clearPreview();progress.textContent='';const f=picker.files?.[0];if(!f){status.textContent='Choose a video from your phone or computer.';return}status.textContent=f.name+' · '+(f.size/1048576).toFixed(1)+' MB';try{preview.preload='none';previewWrap.hidden=false}catch(_){status.textContent+=' — Preview unavailable; saving may still work.'}});
 previewStart.onclick=()=>{const f=picker.files?.[0];if(!f)return;try{previewUrl=URL.createObjectURL(f)}catch(e){status.textContent='Preview unavailable; you can still save the video.';return}preview.src=previewUrl;if(chosenCover)preview.poster=chosenCover;preview.hidden=false;previewStart.hidden=true;preview.play().catch(()=>{})};
 by('bo-video-clear').onclick=()=>{picker.value='';clearPreview();status.textContent='Choose a video from your phone or computer.'};
 const prices=p=>Number.isFinite(Number(p?.price))?'₹'+Number(babyoneINRValue(p)).toLocaleString('en-IN'):'';
 search.oninput=()=>{chosen='';selected.textContent='No product selected';matches.replaceChildren();const q=search.value.trim().toLowerCase();if(!q)return;productsData.filter(p=>!p.catalogHidden&&String(p.name||'').toLowerCase().includes(q)).slice(0,10).forEach(p=>{const b=document.createElement('button');b.type='button';b.className='bo-video-result';b.textContent=p.name+' — '+prices(p);b.onclick=()=>{chosen=String(p.id);search.value=p.name;selected.textContent='Linked to '+p.name;matches.replaceChildren()};matches.appendChild(b)})};
 reelsData.forEach((r,i)=>{
  const row=document.createElement('div');row.className='bo-video-manager-row';const name=document.createElement('div');name.className='bo-video-row-name';const p=productsData.find(x=>String(x.id)===String(r.productId));name.textContent=(r.title||'Untitled video')+(p?' · '+p.name:'')+(r.videoUrl?' · Published':r.localKey?' · On this device':' · YouTube');
  const actions=document.createElement('div');actions.className='bo-video-manager-actions';
  const thumb=document.createElement('img');thumb.className='bo-video-existing-thumbnail';thumb.alt='Cover for '+(r.title||'video');thumb.loading='lazy';thumb.src=r.cover||(r.id?'https://i.ytimg.com/vi/'+encodeURIComponent(r.id)+'/hqdefault.jpg':'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%22120%22%3E%3Crect width=%2280%22 height=%22120%22 fill=%22%23e2eaf1%22/%3E%3C/svg%3E');
  const changeCover=document.createElement('button');changeCover.type='button';changeCover.className='bo-admin-btn secondary';changeCover.textContent='Change cover';
  const editPicker=document.createElement('input');editPicker.type='file';editPicker.accept='image/*,.jpg,.jpeg,.png,.webp';editPicker.hidden=true;editPicker.setAttribute('aria-label','Choose new cover for '+(r.title||'video'));
  changeCover.onclick=()=>editPicker.click();
  editPicker.onchange=async()=>{
   const f=editPicker.files?.[0];if(!f)return;changeCover.disabled=true;changeCover.textContent='Saving cover…';
   try{
    const nextCover=await imageCover(f);
    if(r.cloudId){const cloud=window.BOvideoCloud;if(!cloud?.user?.())throw Error('Sign in to Firebase to update the cover shown to all customers.');if(typeof cloud.updateCover!=='function')throw Error('Cloud cover editing is not available yet.');await cloud.updateCover(r,nextCover)}
    const next=reelsData.map((item,j)=>j===i?{...item,cover:nextCover}:item);
    localStorage.setItem('babyone-owner-reels-v1',JSON.stringify(next));
    reelsData.splice(0,reelsData.length,...next);renderReels();videoManager();showToast('Video cover updated');
   }catch(err){showToast('Could not change cover: '+(err.message||'Try again'));changeCover.disabled=false;changeCover.textContent='Change cover';editPicker.value=''}
  };
  const play=document.createElement('button');play.type='button';play.className='bo-admin-btn secondary';play.textContent='Preview';play.onclick=()=>openReel(i);
  const del=document.createElement('button');del.type='button';del.className='bo-admin-btn';del.textContent='Delete';del.style.background='#b93e50';del.onclick=async()=>{
   if(!confirm('Delete this video?'))return;
   if(r.videoUrl&&window.BOvideoCloud?.ready){try{await window.BOvideoCloud.remove(r)}catch(e){showToast('Cloud delete blocked: '+(e.message||'permissions'));return}}
   const next=reelsData.filter((_,j)=>j!==i);
   try{localStorage.setItem('babyone-owner-reels-v1',JSON.stringify(next))}catch(e){showToast('Could not save changes');return}
   reelsData.splice(0,reelsData.length,...next);if(r.localKey)try{await boVideoDelete(r.localKey)}catch(_){/* metadata has still been removed */}
   renderReels();videoManager();showToast('Video removed');
  };actions.append(changeCover,play,del,editPicker);row.append(thumb,name,actions);list.appendChild(row);
 });
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;const f=picker.files?.[0];if(!f){status.textContent='Select your video file first';picker.focus();return}
  if(!String(f.type).startsWith('video/')&&!/\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name||'')){progress.textContent='Choose a video file such as MP4, MOV or WebM';return}
  const text=title.value.trim();if(!text){title.focus();return}if(coverBusy){progress.textContent='Please wait until your cover photo finishes processing.';return}if(search.value.trim()&&!chosen){progress.textContent='Tap a matching product to link it, or clear the product search.';return}
  busy=true;save.disabled=true;save.textContent='Saving…';progress.textContent='Preparing video…';const cloud=window.BOvideoCloud,remote=!!(cloud?.ready&&cloud.user?.());let r={id:'',title:text,author:'@babyone',productId:chosen,createdAt:Date.now(),fileName:f.name,fileSize:f.size,cover:chosenCover};
  try{
   if(remote){
    progress.textContent='Preparing video cover…';if(!r.cover)r.cover=await boVideoCover(f);
    progress.textContent='Uploading to website…';r=await cloud.upload(f,r,(done,total)=>{progress.textContent='Uploading '+Math.round(100*done/Math.max(1,total))+'%';});
   }else{
    r.localKey='video-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
    await boVideoSave(r.localKey,f,(done,total)=>{progress.textContent='Saving '+Math.round(100*done/Math.max(1,total))+'%';});
    // Verify byte count and type without rewriting a raw content-URI Blob.
    const check=await boVideoLoad(r.localKey);if(!check||check.size!==f.size)throw new Error('Video verification failed. Select the file again.');
    progress.textContent='Preparing preview…';if(!r.cover)r.cover=await boVideoCover(f);
   }
   const next=[...reelsData,r];localStorage.setItem('babyone-owner-reels-v1',JSON.stringify(next));reelsData.push(r);
   clearPreview();renderReels();videoManager();showToast(remote?'Video published to your website':'Video saved on this device');
  }catch(err){
   if(r.localKey)try{await boVideoDelete(r.localKey)}catch(_){}
   progress.textContent='Could not save: '+(err?.message||err?.name||'Unknown error')+(remote?' — Check Firebase Storage, Firestore and permissions.':' — Try a locally saved MP4 or open the HTTPS website.');
   save.disabled=false;save.textContent='Try saving again';busy=false;
  }
 };
}
videoManager();

const oldTab=boAdmin.tab;boAdmin.tab=function(name,btn){if(name==='products'){oldTab.call(this,'catalogue',nav.querySelector('[data-panel="catalogue"]'));mode='catalogue';render();edit();return}if(name==='inventory')name='catalogue',mode='inventory';else if(name==='catalogue')mode='catalogue';oldTab.call(this,name,btn||nav.querySelector('[data-panel="'+name+'"]'));if(name==='catalogue')render();if(name==='category-manager')categoriesPanel();if(name==='video-manager')videoManager()};
nav.querySelector('[data-panel="catalogue"]').textContent='Products & categories';nav.querySelector('[data-panel="inventory"]').textContent='Stock & quantities';
const ownerHeader=document.querySelector('.bo-admin-top');if(ownerHeader){const ownerLabel=document.createElement('div');ownerLabel.style='font-size:12px;font-weight:800;color:#294e6a';ownerLabel.textContent='Owner: HADHI · 9645762324';ownerHeader.append(ownerLabel)}
const oldOpen=boAdmin.openDashboard;boAdmin.openDashboard=function(){oldOpen.apply(this,arguments);if(authorized()){syncEntry();render()}};
document.addEventListener('submit',()=>setTimeout(syncEntry,0),true);document.addEventListener('click',()=>setTimeout(syncEntry,0),true);window.addEventListener('storage',()=>{apply();syncEntry();render();refreshStore()});
const oldCard=productCard;window.productCard=function(p){let card=oldCard(p);if(known(p)&&Number(p.stock)===0)card=card.replace('<span class="product-badge">','<span class="product-badge">Out of stock · ');return card};
function available(p){const v=p.variants?.[p.selectedVariant||0];return Math.min(known(p)?Number(p.stock):Infinity,v&&v.stock!=null&&v.stock!==''?Number(v.stock):Infinity)}
const oldAdd=addToCart;window.addToCart=function(id){const p=productsData.find(p=>p.id===id);if(!p||p.catalogHidden)return;const size=p.variants?.[p.selectedVariant||0]?.size||'default',same=cart.filter(i=>i.id===id&&((i.cartKey||'').split('::')[1]||'default')===size).reduce((s,i)=>s+i.qty,0),total=cart.filter(i=>i.id===id).reduce((s,i)=>s+i.qty,0);if(same>=available(p)||known(p)&&total>=Number(p.stock)){showToast('Available stock limit reached');return}oldAdd(id)};
const oldQty=changeQty;window.changeQty=function(id,d){const item=cart.find(c=>(c.cartKey||c.id)===id),p=item&&productsData.find(p=>p.id===item.id);if(d>0&&p){const label=(item.cartKey||'').split('::')[1],v=p.variants?.find(v=>v.size===label),total=cart.filter(i=>i.id===p.id).reduce((s,i)=>s+i.qty,0);if(known(p)&&total+d>Number(p.stock)||v&&v.stock!=null&&v.stock!==''&&item.qty+d>Number(v.stock)){showToast('Available stock limit reached');return}}oldQty(id,d)};
refreshStore();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
