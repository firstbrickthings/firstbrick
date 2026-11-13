/* One purchase path for desktop/mobile controls; the server confirms price and stock. */
(function(){
'use strict';
const drawer=()=>document.getElementById('cart-drawer');
const productFor=id=>productsData.find(p=>String(p.id)===String(id));
const optionFor=(product,line)=>product?.variants?.find(v=>line.serverVariantId?v.serverVariantId===line.serverVariantId:v.size===(line.size||line.variants?.[line.selectedVariant??0]?.size||''));
function sameOption(a,b){if(String(a.id)!==String(b.id))return false;const product=productFor(a.id),av=optionFor(product,a),bv=optionFor(product,b);return av?.serverVariantId&&bv?.serverVariantId?av.serverVariantId===bv.serverVariantId:(a.size||'')===(b.size||'');}
function unitsFor(line){return cart.filter(c=>sameOption(c,line)).reduce((sum,c)=>sum+Number(c.qty||0),0);}
function report(message){showToast(message);}
function showBag(open){
 const bag=drawer();if(!bag)return;
 if(open){window.closeProductModal?.();window.boU?.close();document.getElementById('wishlist-drawer')?.classList.add('hidden');document.getElementById('mobile-drawer')?.classList.add('hidden');updateCart();bag.classList.remove('hidden');document.body.style.overflow='hidden';setBabyoneActiveTab('cart');bag.querySelector('[aria-label="Close"]')?.focus({preventScroll:true});}
 else{bag.classList.add('hidden');document.body.style.overflow='';setBabyoneActiveTab(typeof navState!=='undefined'&&navState.view==='plp'?'categories':'home');}
}
window.toggleCartModal=()=>showBag(drawer()?.classList.contains('hidden'));
function add(id,buy){
 const p=productFor(id),state=babyonePurchaseState(p);if(!state.canBuy){report(state.reason);return false;}
 const item=window.babyoneCartLine(p);if(!item)return false;
 const variant=p.variants?.[p.selectedVariant??0];item.serverVariantId=variant?.serverVariantId;item.price=Number(variant?.price??p.price);
 const pattern=p.patterns?.find(pattern=>pattern.id===item.patternId);
 if(pattern?.available===false){report('This pattern is unavailable. Choose another pattern.');return false;}
 if(buy&&p.id==='babyone-hospital-bag-payment-check'&&p.live_gateway_check){
  window.closeProductModal?.();showBag(false);
  window.boU.checkout({items:[{...item,qty:1}],keepBag:true});return true;
 }
 const existing=cart.find(c=>(c.cartKey||c.id)===item.cartKey),units=unitsFor(item);
 if(units+(buy&&existing?0:1)>state.stock){report('Only '+state.stock+' unit(s) of this option are available. Please review the quantity in your bag.');if(buy)showBag(true);return false;}
 if(existing){if(!buy)existing.qty=Number(existing.qty||0)+1;existing.price=item.price;existing.serverVariantId=item.serverVariantId;}else cart.push(item);
 updateCart();
 if(buy){window.closeProductModal?.();showBag(false);document.getElementById('wishlist-drawer')?.classList.add('hidden');window.boU.checkout();}
 else report('Added to your bag');
 return true;
}
window.addToCart=id=>add(id,false);
window.buyProductNow=id=>add(id,true);
window.changeQty=function(key,delta){
 const item=cart.find(c=>(c.cartKey||c.id)===key);if(!item||![-1,1].includes(delta))return;
 if(delta>0){const p=productFor(item.id);if(item.serverProduct&&!p){report('This product is currently unavailable. Please review your bag.');return;}const v=optionFor(p,item),stock=p?.serverProduct?Math.min(100,Number(v?.stock)||0):100;
  if(p?.serverProduct&&(!p.sale_enabled||!v?.available)){report('This option is currently unavailable. Please review your bag.');return;}
  if(unitsFor(item)>=stock){report('Only '+stock+' unit(s) of this option are available.');return;}}
 const next=Number(item.qty||0)+delta;if(next<=0)cart=cart.filter(c=>(c.cartKey||c.id)!==key);else item.qty=next;
 updateCart();
};
// Checkout and bag use a lower layer than product details; close details before opening either.
window.BOpurchase={showBag};
})();
