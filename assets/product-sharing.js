/* Product-specific links, native sharing where supported, and a copy-link fallback. */
(function(){
'use strict';
let openedLink=false;
function linkFor(id){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('product',String(id));return url.href;}
function copyDialog(url){
 document.getElementById('bo-share-sheet')?.remove();const previous=document.activeElement,layer=document.createElement('div');layer.id='bo-share-sheet';layer.className='bo-share-sheet';layer.innerHTML='<div class="bo-share-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="bo-share-heading"><button type="button" class="bo-share-close" aria-label="Close product sharing">×</button><h2 id="bo-share-heading">Share this product</h2><p>Send this link to open the product at BabyOne.</p><label for="bo-share-url">Product link</label><input id="bo-share-url" type="url" readonly><button type="button" class="btn btn-pink" id="bo-share-copy">Copy link</button><p id="bo-share-status" role="status" aria-live="polite"></p></div>';
 const close=()=>{layer.remove();previous?.focus({preventScroll:true})};document.body.appendChild(layer);const input=layer.querySelector('input');input.value=url;input.focus();input.select();
 layer.querySelector('.bo-share-close').onclick=close;layer.addEventListener('click',e=>{if(e.target===layer)close()});
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}if(e.key==='Tab'){const nodes=[...layer.querySelectorAll('button,input')];if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus()}}});
 layer.querySelector('#bo-share-copy').onclick=async()=>{const status=layer.querySelector('#bo-share-status');try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);else{input.focus();input.select();if(!document.execCommand('copy'))throw Error('Manual copy required')}status.textContent='Link copied.';}catch(_){input.focus();input.select();status.textContent='Select and copy the product link above.';}};
}
async function share(id){
 const product=productsData.find(p=>String(p.id)===String(id));if(!product)return;
 const url=linkFor(id);
 if(typeof navigator.share==='function')try{await navigator.share({title:product.name,text:product.name+' · BabyOne',url});return}catch(e){if(e.name==='AbortError')return;}
 try{if(!navigator.clipboard?.writeText)throw Error('Copy manually');await navigator.clipboard.writeText(url);showToast('Product link copied.');}
 catch(_){copyDialog(url)}
}
async function openSharedProduct(){
 const id=new URLSearchParams(location.search).get('product');if(!id||openedLink)return;
 if(typeof productsData==='undefined'||!productsData.some(p=>p.serverProduct))return;
 openedLink=true;let product=productsData.find(p=>String(p.id)===id&&!p.catalogHidden);
 if(!product){showToast('This product is currently unavailable. Please browse the store.');return;}
 window.openProductModal(product.id);
}
window.BOproductShare={share,linkFor};
window.addEventListener('babyone-catalog-ready',openSharedProduct);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',openSharedProduct);else openSharedProduct();
})();
