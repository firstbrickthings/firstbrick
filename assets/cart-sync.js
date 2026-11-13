/* Saved bags belong to verified accounts. Conflicts require an explicit customer choice. */
(function(){
'use strict';
let uid=null,version=0,epoch=0,applying=false,loading=false,dirty=false,timer=null,saving=false,consentBusy=false;
const choicesHosts=new WeakMap();
let activityAllowed=null,lastTouch=Date.now(),lastPing=0,pinging=false;
const api=(path,options={})=>BOserver.request(path,options),read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch(_){return d}},write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const ownerKey='babyone-cart-owner-v1',cacheKey=id=>'babyone-saved-bag-'+id,previousOwner=read(ownerKey,null)||(read('babyone-profile-v1',{})?.accountUid||read('babyone-profile-v1',{})?.firebaseUid);
if(previousOwner&&typeof cart!=='undefined'&&cart.length){if(!read(cacheKey(previousOwner),null))write(cacheKey(previousOwner),{cart,version:0,dirty:true});applying=true;cart=[];updateCart();applying=false;}
function cache(){if(uid)write(cacheKey(uid),{cart,version,dirty})}
const oldUpdate=window.updateCart;
window.updateCart=function(){oldUpdate.apply(this,arguments);if(applying||loading)return;if(uid){dirty=true;cache();clearTimeout(timer);timer=setTimeout(save,600)}};
function showStatus(text,choices){
 let box=document.getElementById('bo-saved-bag-status');if(!box){box=document.createElement('aside');box.id='bo-saved-bag-status';box.className='bo-saved-bag-status';box.setAttribute('role','status');document.getElementById('cart-items-container')?.before(box)}if(!box)return;
 box.replaceChildren();const p=document.createElement('p');p.textContent=text;box.appendChild(p);for(const [label,fn] of choices||[]){const b=document.createElement('button');b.type='button';b.className='btn btn-outline';b.textContent=label;b.onclick=fn;box.appendChild(b)}
}
function fromServer(data){
 const rows=data.ordered?[]:data.items;
 return rows.map(line=>{const p=productsData.find(p=>String(p.id)===String(line.id))||{id:line.id||line.variant_id,variants:[],serverProduct:true,currency:'INR'};const index=p.variants.findIndex(v=>v.serverVariantId===line.variant_id);return {...p,cartKey:p.id+'::'+encodeURIComponent(line.size||'default')+'::'+(line.pattern_id||'default'),serverVariantId:line.variant_id,name:line.name+(line.size?' — '+line.size:'')+(line.pattern_name?' — '+line.pattern_name:''),image:line.image||'assets/favicon.svg',price:Number(line.price),size:line.size||'',patternId:line.pattern_id||null,patternName:line.pattern_name||null,qty:line.quantity,selectedVariant:index>=0?index:0}});
}
function apply(data){version=data.version;applying=true;cart=fromServer(data);updateCart();applying=false;dirty=false;cache();document.getElementById('bo-saved-bag-status')?.remove()}
function lines(){return BOserver.cartItems(cart)}
async function save(){
 if(!uid||loading||saving||!dirty)return;const account=uid,stamp=epoch;
 let items;try{items=lines()}catch(e){showStatus(e.message,[['Reload catalogue',async()=>{await BOserver.catalog();save()}]]);return}
 saving=true;
 try{
  const result=await api('/me/cart',{method:'PUT',body:JSON.stringify({items,expected_version:version})});if(stamp!==epoch||uid!==account)return;
  pingActivity();version=result.version;const changed=JSON.stringify(lines())!==JSON.stringify(items);dirty=changed;cache();if(changed)timer=setTimeout(save,50);else document.getElementById('bo-saved-bag-status')?.remove();
 }catch(e){if(stamp!==epoch)return;showStatus(e.message,[['Load saved bag',async()=>{const server=await api('/me/cart');apply(server)}],['Keep this device’s bag',async()=>{const server=await api('/me/cart');version=server.version;dirty=true;cache();save()}]])}
 finally{saving=false;}
}
async function connect(me){
 if(me&&uid===me.uid)return;
 const stamp=++epoch;clearTimeout(timer);activityAllowed=null;lastPing=0;
 document.querySelectorAll('.bo-whatsapp-choices').forEach(box=>box.remove());
 if(!me){if(!uid)return;if(uid)cache();uid=null;version=0;dirty=false;loading=false;applying=true;cart=[];updateCart();applying=false;write(ownerKey,null);return;}
 const guest=uid||previousOwner?[]:structuredClone(cart);if(uid)cache();uid=me.uid;loading=true;dirty=false;write(ownerKey,uid);
 try{
  await BOserver.catalog();const server=await api('/me/cart');if(stamp!==epoch)return;
  const cached=read(cacheKey(uid),null);
  apply(server);
  const pending=cached?.dirty?(cached.cart||[]):guest;
  if(cached?.dirty||pending.length){
   if(cached?.dirty&&cached.version!==server.version&&server.items.length){applying=true;cart=pending;updateCart();applying=false;dirty=true;showStatus('Your saved bag changed on another device. Choose which version to keep.',[['Load saved bag',()=>apply(server)],['Keep this device’s bag',()=>{version=server.version;dirty=true;save()}]]);return;}
   const merged=new Map((cached?.dirty?[]:cart).map(i=>[i.cartKey||i.id,i]));for(const line of pending){const key=line.cartKey||line.id,old=merged.get(key);merged.set(key,old?{...old,qty:Math.max(old.qty,line.qty)}:line)}applying=true;cart=[...merged.values()];updateCart();applying=false;dirty=true;cache();
  }
  const params=new URLSearchParams(location.search),recovery=params.get('recover_cart');
  if(params.get('track')){document.getElementById('bo-track-id').value=params.get('track');boU.close();document.getElementById('home-track-order').scrollIntoView({block:'start'});document.getElementById('bo-track-form').requestSubmit();}
  if(recovery){const restored=await api('/me/cart/recover?'+new URLSearchParams({message_id:recovery,expires:params.get('expires')||'',signature:params.get('signature')||''}));if(stamp!==epoch)return;apply(restored);const saved=read('babyone-profile-v1',{});for(const [key,value] of Object.entries(restored.checkout_profile||{}))if(value&&!saved[key])saved[key]=value;write('babyone-profile-v1',saved);params.delete('recover_cart');params.delete('expires');params.delete('signature');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);setTimeout(()=>boU.checkout(),50);}
 }catch(e){if(stamp===epoch)showStatus('Your bag is kept on this device. '+e.message,[['Retry sync',()=>{const identity=window.BOverifiedIdentity;uid=null;connect(identity)}]])}
 finally{if(stamp===epoch){loading=false;if(dirty)timer=setTimeout(save,100);mountChoices()}}
}
async function mountChoices(){
 const checkout=document.getElementById('bo-checkout-form'),account=document.getElementById('bo-my-orders-list');const host=checkout||account?.parentElement;if(!uid||!host||choicesHosts.get(host)===epoch||host.querySelector('.bo-whatsapp-choices')||consentBusy)return;consentBusy=true;
 const stamp=epoch;try{const [prefs,contact]=await Promise.all([api('/me/whatsapp'),BOserver.request('/store/contact',{},false)]);if(stamp!==epoch||!host.isConnected||host.querySelector('.bo-whatsapp-choices'))return;
 activityAllowed=prefs.cart_reminders;choicesHosts.set(host,stamp);
 // A saved yes or no is final for checkout. Account keeps the editable preferences.
 if(checkout&&prefs.consent_at)return;
 const box=document.createElement('fieldset');box.className='bo-whatsapp-choices';
 const orderLabel='<label><input type="checkbox" name="bo_wa_orders"> Send my order confirmations and delivery updates to '+prefs.phone+' on WhatsApp</label>';
 const cartLabel='<label><input type="checkbox" name="bo_wa_cart"> Send one reminder after my bag is unchanged for 20 minutes</label>';
 const choices=orderLabel+(checkout?'<details><summary>Optional shopping reminder</summary>'+cartLabel+'</details>':cartLabel);
 box.innerHTML='<legend>WhatsApp updates (optional)</legend>'+choices+'<p>Your choice is saved for future orders. Change it in Account or reply STOP.</p>'+(checkout?'':'<button type="button" class="btn btn-outline">Save WhatsApp choices</button>')+'<p class="bo-wa-choice-status" role="status"></p>';
 box.querySelector('[name=bo_wa_orders]').checked=prefs.order_updates;box.querySelector('[name=bo_wa_cart]').checked=prefs.cart_reminders;box.querySelector('.bo-wa-choice-status').textContent=contact.whatsapp_automation_active?'':'Automatic messaging is awaiting the store’s WhatsApp connection.';
 let saved=prefs;
 box._save=async()=>{if(stamp!==epoch)throw Error('Your account changed. Reopen checkout before saving WhatsApp choices.');const next={order_updates:box.querySelector('[name=bo_wa_orders]').checked,cart_reminders:box.querySelector('[name=bo_wa_cart]').checked};if(saved.consent_at&&next.order_updates===saved.order_updates&&next.cart_reminders===saved.cart_reminders)return;saved=await api('/me/whatsapp',{method:'PUT',body:JSON.stringify(next)});activityAllowed=saved.cart_reminders;if(stamp!==epoch)throw Error('Your account changed. Reopen checkout.');box.querySelector('.bo-wa-choice-status').textContent=contact.whatsapp_automation_active?'Your WhatsApp choices are saved.':'Your choices are saved. Messages will start when the store connects WhatsApp.';};
 if(!checkout)box.querySelector('button').onclick=async()=>{const button=box.querySelector('button'),status=box.querySelector('.bo-wa-choice-status');button.disabled=true;try{await box._save()}catch(e){status.textContent=e.message}finally{button.disabled=false}};

 if(checkout)checkout.querySelector('#bo-payment-methods')?.before(box);else host.appendChild(box);
 }catch(_){}finally{consentBusy=false}
}
async function pingActivity(){
 if(!uid||document.hidden||!cart.length||activityAllowed===false||pinging||lastTouch<=lastPing||Date.now()-lastTouch>70000||Date.now()-lastPing<50000)return;
 const stamp=epoch;pinging=true;try{const result=await api('/me/cart/activity',{method:'POST'});if(stamp===epoch){lastPing=Date.now();if(!result.tracked)activityAllowed=false}}catch(_){}finally{pinging=false}
}
for(const name of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(name,event=>{if(event.isTrusted)lastTouch=Date.now()},{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastTouch=Date.now();pingActivity()}});
setInterval(pingActivity,30000);
window.addEventListener('babyone-server-identity',e=>connect(e.detail));
new MutationObserver(()=>mountChoices()).observe(document.body,{childList:true,subtree:true});
setInterval(async()=>{if(!uid||dirty||loading||saving||document.hidden)return;const stamp=epoch;try{const remote=await api('/me/cart');if(stamp===epoch&&remote.version!==version)apply(remote)}catch(_){}},30000);
window.BOcartSync={save,connect,async saveCheckoutChoices(){const box=document.querySelector('#bo-checkout-form .bo-whatsapp-choices');if(box)await box._save()}};
// Cart recovery keeps the link through OTP sign-in, then opens authenticated checkout.
if(new URLSearchParams(location.search).has('recover_cart')||new URLSearchParams(location.search).has('track'))setTimeout(()=>{if(!window.BOverifiedIdentity)boU.login(true)},2000);
const track=new URLSearchParams(location.search).get('track');if(track){document.getElementById('bo-track-id').value=track;document.getElementById('home-track-order')?.scrollIntoView({block:'start'});}
})();
