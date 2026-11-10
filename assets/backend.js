/* Python/MySQL store connection. Firebase supplies identity, never prices or order data. */
(function () {
  const base = (window.BABYONE_API_BASE || '/api').replace(/\/$/, '');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let records = new Map(), categories = [], adminIdentity = null, loading, testLinkOpened = false;
  async function token() {
    if (!window.BOphoneOTP?.getIdToken) throw Error('Sign in with your verified phone number first.');
    return window.BOphoneOTP.getIdToken();
  }
  async function request(path, options = {}, authenticated = true) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const headers = {'Content-Type': 'application/json', ...(options.headers || {})};
      if (authenticated) headers.Authorization = 'Bearer ' + await token();
      const response = await fetch(base + path, {...options, headers, signal: controller.signal, cache: 'no-store'});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'The store could not process this request. Check the form and try again.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('The store connection timed out. Retry the same order to check its status.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function storefrontProduct(p) {
    const metadata = p.metadata || {};
    const variants = p.variants.filter(v => v.enabled);
    return {...metadata, id:p.id, name:p.name, category:p.category, description:p.description,
      image:p.image, currency:'INR', catalogHidden:!p.active, serverProduct:true,
      sale_enabled:p.sale_enabled, price:variants[0] ? Number(variants[0].price) : null,
      stock:p.sale_enabled ? variants.reduce((sum,v)=>sum+v.stock,0) : 0,
      variants:variants.map(v=>({size:v.label,price:Number(v.price),stock:p.sale_enabled?v.stock:0,serverVariantId:v.id,available:p.sale_enabled&&v.stock>0})),
      patterns:metadata.patterns || [], selectedVariant:0, diaperSizesExpanded:true,
      badge:p.sale_enabled ? (metadata.badge || 'BabyOne') : 'Details awaiting confirmation', rating:0, reviews:0};
  }
  async function catalog() {
    if (loading) return loading;
    loading = (async () => {
      const all = []; let offset = 0, result;
      do {
        result = await request('/catalog/products?limit=100&offset='+offset, {}, false);
        all.push(...result.items); offset += result.items.length;
      } while (offset < result.total && result.items.length);
      categories = await request('/catalog/categories', {}, false);
      records = new Map(all.map(p => [p.id, p]));
      productsData.splice(0, productsData.length, ...all.map(storefrontProduct));
      for (const c of categories) window.babyoneDeliveryRates[c.name] = Number(c.delivery_fee);
      for (const c of categories) if (!categoriesData.some(old=>old.name===c.name)) categoriesData.push({id:c.id,name:c.name,img:'',subcategories:[]});
      renderProductRails();renderExplorerGrid();
      if (!document.getElementById('explorer-page')?.classList.contains('hidden')) renderPLPGrid();
      document.getElementById('bo-server-notice')?.remove();
      document.getElementById('bo-payment-test-notice')?.remove();
      if (all.some(p=>p.metadata?.payment_test && p.sale_enabled && p.variants.some(v=>v.enabled && v.stock>0))) {
        const notice=document.createElement('aside');notice.id='bo-payment-test-notice';notice.className='bo-payment-test-notice';
        notice.innerHTML='<div><strong>Razorpay Test Mode</strong><p>Try a ₹10 test payment. No real charge or delivery.</p></div><button type="button" class="btn btn-pink">Try test payment</button>';
        notice.querySelector('button').onclick=()=>window.boU.paymentTest();
        document.getElementById('main').prepend(notice);
        if(!testLinkOpened && new URLSearchParams(location.search).get('payment-test')==='1'){
          testLinkOpened=true;window.boU.paymentTest();
        }
      }
      return all;
    })().finally(()=>{loading=null});
    return loading;
  }
  function cartItems(lines) {
    return lines.map(line => {
      const product = records.get(line.id);
      if (!product) throw Error('A product is no longer available. Refresh the catalog and update your bag.');
      const label = line.size || line.variants?.[line.selectedVariant ?? 0]?.size || '';
      const variant = product.variants.find(v=>v.label===label && v.enabled);
      if (!variant) throw Error('A product option changed. Remove it and select it again.');
      return {variant_id:variant.id, quantity:line.qty, pattern_id:line.patternId || null};
    });
  }
  async function quote(lines) {
    if (!records.size) await catalog();
    return request('/checkout/quote', {method:'POST',body:JSON.stringify({items:cartItems(lines)})});
  }
  async function submit(order) {
    if (!order.serverQuote) throw Error('Reopen checkout to review a server-verified total.');
    const shipping = Object.fromEntries(['name','address','city','state','pin','email'].map(k=>[k,String(order[k] || '')]));
    const stored=await request('/orders', {method:'POST',body:JSON.stringify({idempotency_key:order.id,
      quote_hash:order.serverQuote.quote_hash,items:order.serverItems,shipping,payment:order.payment==='RAZORPAY'?'RAZORPAY':'COD'})});
    if(stored.payment==='RAZORPAY'){order.serverOrderId=stored.id;return completePayment(stored.id,order.paymentPreference);}
    return stored;
  }
  let checkoutScript;
  function loadCheckout(){
    if(window.Razorpay)return Promise.resolve();
    if(!checkoutScript)checkoutScript=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;
      script.onerror=()=>{checkoutScript=null;script.remove();reject(Error('Razorpay could not load. Check your connection and retry.'))};document.head.appendChild(script);
    });
    return checkoutScript;
  }
  async function completePayment(orderId,paymentPreference){
    const current=await request('/payments/razorpay/'+encodeURIComponent(orderId)+'/status');
    if(current.payment_status==='paid')return current.order;
    const config=await request('/payments/razorpay/'+encodeURIComponent(orderId)+'/checkout',{method:'POST'});
    if(config.payment_status==='paid')return config.order;
    if(!config.checkout?.key?.startsWith('rzp_test_'))throw Error('Only Razorpay Test Mode is enabled.');
    await loadCheckout();
    return new Promise((resolve,reject)=>{
      let finished=false,checking=false;
      const done=(error,order)=>{if(finished)return;finished=true;error?reject(error):resolve(order)};
      const preferredMethods=paymentPreference==='upi'?{config:{display:{
        blocks:{upi:{name:'Google Pay / UPI',instruments:[{method:'upi'}]}},
        sequence:['block.upi'],preferences:{show_default_blocks:true}
      }}}:{};
      const checkout=new window.Razorpay({...config.checkout,...preferredMethods,
        handler:async result=>{
          checking=true;
          try{const verified=await request('/payments/razorpay/'+encodeURIComponent(orderId)+'/verify',{method:'POST',body:JSON.stringify(result)});
            if(verified.payment_status==='paid'){done(null,verified.order)}
            else done(Error('Payment is awaiting capture. Check My Orders before paying again.'));
          }catch(error){done(Error('Payment verification is pending. Open My Orders and check payment status before paying again.'));}
        },
        modal:{ondismiss:async()=>{
          if(checking||finished)return;
          try{const current=await request('/payments/razorpay/'+encodeURIComponent(orderId)+'/status');
            if(current.payment_status==='paid'){done(null,current.order);return;}
          }catch(_){}
          done(Error('Payment was not confirmed. Your bag is kept. Retry this checkout or resume the same order in My Orders.'));
        }},theme:{color:'#ad3d70'}});
      checkout.on('payment.failed',()=>{showToast('The test payment failed. Retry in Razorpay or close checkout.');});
      checkout.open();
    });
  }
  async function resumePayment(orderId){
    try{await completePayment(orderId);showToast('Test payment verified.');await window.boU.home();}
    catch(error){showToast(error.message)}
  }
  async function paymentConfig(){try{return await request('/payments/config',{},false)}catch(_){return {razorpay_test_enabled:false}}}
  async function myOrders() { const all=[];let page;do{page=await request('/me/orders?limit=100&offset='+all.length);all.push(...page.items)}while(all.length<page.total&&page.items.length);return all; }
  async function checkIdentity() {
    try {
      const me = await request('/me'); adminIdentity = me.is_admin ? me : null;
      document.getElementById('bo-server-manage')?.remove();
      if (adminIdentity) {
        const button=document.createElement('button');button.id='bo-server-manage';button.type='button';button.className='btn btn-outline';button.textContent='Manage store';button.onclick=()=>openAdmin();
        document.querySelector('.header-actions').appendChild(button);
      }
      return me;
    } catch (_) { adminIdentity=null;document.getElementById('bo-server-manage')?.remove(); }
  }
  async function openAdmin() {
    const me = await checkIdentity();
    if (!me?.is_admin) { showToast('Sign in as a store administrator.');return; }
    let layer = document.getElementById('bo-server-admin');layer?.remove();
    layer = document.createElement('div');layer.id='bo-server-admin';layer.className='bo-server-admin';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','MySQL store management');
    layer.innerHTML=`<div class="bo-server-admin-panel"><div class="bo-server-admin-head"><h2>Manage your store</h2><button type="button" id="bo-server-close" class="btn btn-outline">Close</button></div><p>These changes save to MySQL for all customers. Confirm product prices and stock before enabling sales.</p><nav><button type="button" class="btn btn-outline" id="bo-server-products">Products & stock</button><button type="button" class="btn btn-outline" id="bo-server-orders">Orders</button><button type="button" class="btn btn-outline" id="bo-server-fees">Delivery fees</button></nav><p id="bo-server-status" role="status"></p><div id="bo-server-content"></div></div>`;
    document.body.appendChild(layer);const previous=document.activeElement;document.body.style.overflow='hidden';
    const close=()=>{layer.remove();document.body.style.overflow='';previous?.focus()};
    document.getElementById('bo-server-close').onclick=close;document.getElementById('bo-server-close').focus();
    layer.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const els=[...layer.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus()}}});
    const content=document.getElementById('bo-server-content'),status=document.getElementById('bo-server-status');
    const run=fn=>async()=>{status.textContent='Loading…';try{await fn();status.textContent=''}catch(e){status.textContent=e.message}};
    async function products(offset=0,q='') {
      const page=await request('/admin/products?limit=20&offset='+offset+'&q='+encodeURIComponent(q));
      content.innerHTML=`<form id="bo-server-search"><label for="bo-server-query">Find a product</label><input id="bo-server-query" value="${esc(q)}"><button class="btn btn-outline">Search</button></form><button type="button" id="bo-server-new" class="btn btn-outline">Add product</button><p>${page.total} products · showing ${offset+1}–${Math.min(offset+20,page.total)}</p><div class="bo-server-product-list"></div><button type="button" id="bo-server-prev" class="btn btn-outline" ${offset===0?'disabled':''}>Previous</button><button type="button" id="bo-server-next" class="btn btn-outline" ${offset+20>=page.total?'disabled':''}>Next</button>`;
      const list=content.querySelector('.bo-server-product-list');
      for(const product of page.items){const button=document.createElement('button');button.type='button';button.className='bo-server-product-row';button.textContent=product.name+' · '+(product.sale_enabled?'Sales enabled':'Needs approval')+' · '+product.variants.reduce((s,v)=>s+v.stock,0)+' units';button.onclick=()=>edit(product);list.appendChild(button)}
      document.getElementById('bo-server-search').onsubmit=e=>{e.preventDefault();run(()=>products(0,document.getElementById('bo-server-query').value))()};
      document.getElementById('bo-server-new').onclick=()=>edit(null);document.getElementById('bo-server-prev').onclick=run(()=>products(offset-20,q));document.getElementById('bo-server-next').onclick=run(()=>products(offset+20,q));
    }
    function edit(product) {
      const p=product || {name:'',description:'',category_id:categories[0]?.id,image:'',active:true,sale_enabled:false,variants:[{label:'',price:'0.00',stock:0,enabled:true}],metadata:{}};
      content.innerHTML=`<form id="bo-server-edit"><h3>${product?'Edit product':'Add product'}</h3><label>Name<input name="name" required maxlength="255" value="${esc(p.name)}"></label><label>Category<select name="category_id">${categories.map(c=>`<option value="${esc(c.id)}" ${c.id===p.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Description<textarea name="description">${esc(p.description)}</textarea></label><label>Product image URL<input name="image" value="${esc(p.image)}"></label><label><input name="active" type="checkbox" ${p.active?'checked':''}> Visible in store</label><label><input name="sale_enabled" type="checkbox" ${p.sale_enabled?'checked':''}> I confirm the price and inventory; enable sales</label><h4>Options and inventory</h4><div id="bo-server-variants">${p.variants.map((v,i)=>`<fieldset data-variant="${i}"><legend>Option ${i+1}</legend><label>Size / option<input name="label" value="${esc(v.label)}"></label><label>Price (₹)<input name="price" type="number" min="0" step="0.01" required value="${esc(v.price)}"></label><label>Units in stock<input name="stock" type="number" min="0" step="1" required value="${v.stock}"></label><label><input name="enabled" type="checkbox" ${v.enabled?'checked':''}> Option enabled</label></fieldset>`).join('')}</div><button type="button" id="bo-server-add-option" class="btn btn-outline">Add option</button><button class="btn btn-pink" type="submit">Save to MySQL</button><button type="button" class="btn btn-outline" id="bo-server-back">Back</button></form>`;
      document.getElementById('bo-server-back').onclick=run(()=>products());
      document.getElementById('bo-server-add-option').onclick=()=>{const div=document.createElement('fieldset');div.innerHTML='<legend>New option</legend><label>Size / option<input name="label"></label><label>Price (₹)<input name="price" type="number" min="0" step="0.01" required></label><label>Units in stock<input name="stock" type="number" min="0" step="1" required value="0"></label><label><input name="enabled" type="checkbox" checked> Option enabled</label>';document.getElementById('bo-server-variants').appendChild(div)};
      document.getElementById('bo-server-edit').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,button=f.querySelector('[type=submit]');button.disabled=true;status.textContent='Saving…';try{const variants=[...f.querySelectorAll('fieldset')].map((row,i)=>({...(p.variants[i]?.id?{id:p.variants[i].id}:{}),label:row.querySelector('[name=label]').value,price:row.querySelector('[name=price]').value,stock:Number(row.querySelector('[name=stock]').value),enabled:row.querySelector('[name=enabled]').checked}));
        const payload={name:f.elements.name.value,category_id:f.elements.category_id.value,description:f.elements.description.value,image:f.elements.image.value,active:f.elements.active.checked,sale_enabled:f.elements.sale_enabled.checked,variants,patterns:p.metadata?.patterns || [],expected_version:product?.version || null};
        const saved=await request('/admin/products'+(product?'/'+encodeURIComponent(product.id):''),{method:product?'PUT':'POST',body:JSON.stringify(payload)});await catalog();edit(saved);status.textContent='Saved to MySQL.';
      }catch(e){status.textContent=e.message;button.disabled=false;}};
    }
    async function orders(offset=0){const page=await request('/admin/orders?limit=20&offset='+offset);content.innerHTML=`<h3>Orders (${page.total})</h3><div id="bo-server-order-list"></div><button id="bo-order-prev" class="btn btn-outline" ${offset===0?'disabled':''}>Previous</button><button id="bo-order-next" class="btn btn-outline" ${offset+20>=page.total?'disabled':''}>Next</button>`;
      for(const order of page.items){const row=document.createElement('article');row.className='bo-server-order';row.innerHTML=`<h4>${esc(order.id)}</h4><p>${esc(order.name)} · ${esc(order.phone)} · ₹${esc(order.total)}</p><p>${esc(order.address)}, ${esc(order.city)}, ${esc(order.state)} ${esc(order.pin)}</p><ul>${order.items.map(i=>`<li>${esc(i.name)} × ${i.qty}</li>`).join('')}</ul><label>Status<select>${['Order Confirmed','Packed','Shipped','Out for Delivery','Delivered','Cancelled'].map(s=>`<option ${order.status===s?'selected':''}>${s}</option>`).join('')}</select></label><button class="btn btn-outline">Save status</button>`;row.querySelector('button').onclick=run(async()=>{await request('/admin/orders/'+encodeURIComponent(order.id),{method:'PATCH',body:JSON.stringify({status:row.querySelector('select').value})});await orders(offset)});content.querySelector('#bo-server-order-list').appendChild(row)}
      document.getElementById('bo-order-prev').onclick=run(()=>orders(offset-20));document.getElementById('bo-order-next').onclick=run(()=>orders(offset+20));
    }
    async function fees(){
      categories=await request('/catalog/categories',{},false);content.innerHTML='<h3>Delivery fees</h3><p>One fee per category in an order, independent of quantity.</p>';
      for(const category of categories){const form=document.createElement('form');form.innerHTML='<label>'+esc(category.name)+' (₹)<input type="number" min="0" step="0.01" required value="'+esc(category.delivery_fee)+'"></label><button class="btn btn-outline">Save fee</button>';form.onsubmit=async e=>{e.preventDefault();try{await request('/admin/categories/'+encodeURIComponent(category.id),{method:'PUT',body:JSON.stringify({name:category.name,delivery_fee:form.querySelector('input').value})});await catalog();status.textContent='Delivery fee saved.'}catch(error){status.textContent=error.message}};content.appendChild(form);}
    }
    document.getElementById('bo-server-fees').onclick=run(fees);
    document.getElementById('bo-server-products').onclick=run(()=>products());document.getElementById('bo-server-orders').onclick=run(()=>orders());await run(()=>products())();
  }
  window.BOserver={request,catalog,quote,submit,myOrders,openAdmin,cartItems,checkIdentity,paymentConfig,resumePayment};
  window.BOordersCloud={ready:true,submit,user:()=>adminIdentity,flush:async()=>{},
    load:async()=>{const result=await request('/admin/orders?limit=100');window.BOsharedOrderRows=result.items;window.boAdmin?.refreshOrders?.();return result.items;},
    updateStatus:async(id,status)=>request('/admin/orders/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})})};
  document.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('bo-mysql-store');
    catalog().catch(()=>{const notice=document.createElement('p');notice.id='bo-server-notice';notice.className='bo-server-notice';notice.setAttribute('role','status');notice.textContent='The store connection is unavailable. You can browse, but checkout needs the store server.';document.getElementById('main').prepend(notice)});
    if(window.boAdmin){window.boAdmin.openDashboard=()=>openAdmin();window.boAdmin.openLogin=()=>openAdmin();}
    if(window.boManager)window.boManager.open=()=>openAdmin();
    const tracking=document.getElementById('bo-track-form');
    tracking?.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const box=document.getElementById('bo-track-result');
      if(!box)return;
      box.textContent='Checking your order…';
      try{
        const id=new FormData(tracking).get('orderId');
        const order=await request('/me/orders/'+encodeURIComponent(id));
        box.innerHTML='<p><strong>'+esc(order.id)+'</strong></p><p>'+esc(order.status)+' · ₹'+esc(order.total)+'</p>';
      }catch(error){box.textContent=error.message;}
    },true);
  });
  window.addEventListener('babyone-phone-auth-state',checkIdentity);
})();
