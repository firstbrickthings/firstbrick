/* One payment panel; approval and PIN entry stay in the payment provider/app. */
(function(){
  'use strict';
  const apps=[
    {id:'google_pay',name:'Google Pay',mark:'G',style:'google'},
    {id:'phonepe',name:'PhonePe',mark:'पे',style:'phonepe'},
    {id:'paytm',name:'Paytm',mark:'paytm',style:'paytm'},
    {id:'cred',name:'CRED UPI',mark:'C',style:'cred'},
    {id:'bhim',name:'BHIM',mark:'▶',style:'bhim'},
    {id:'other',name:'Other UPI apps',mark:'•••',style:'other'}
  ];
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={
    upi:'<path d="m9 3 7 9-7 9 3-9-3-9Zm-5 0 7 9-7 9 3-9-3-9Z"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
    netbanking:'<path d="m3 8 9-5 9 5H3Zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
    wallet:'<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5m-2-2.5h.01"/>',
    cod:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>'
  };
  const logo=app=>app.id==='other'?app.mark:'<img src="assets/payment-logos/'+(app.id==='google_pay'?'googlepay':app.id)+'.svg" alt="" width="28" height="28">';
  const icon=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[key]+'</svg>';
  function mount(root,options){
    const {testMode,upiEnabled,gatewayEnabled,allowCod}=options;
    let amount=money(options.total),deliveryPending=options.deliveryPending===true;
    const methods=[
      ...(gatewayEnabled?[
        ...(upiEnabled?[{id:'RAZORPAY_UPI',name:'UPI',icon:'upi',preference:'upi'}]:[]),
        {id:'RAZORPAY',name:'Cards',icon:'card',preference:'card'},
        {id:'RAZORPAY_NETBANKING',name:'Netbanking',icon:'netbanking',preference:'netbanking'},
        {id:'RAZORPAY_WALLET',name:'Wallets',icon:'wallet',preference:'wallet'}
      ]:[]),
      ...(allowCod?[{id:'COD',name:'Cash on delivery',icon:'cod',preference:'cod'}]:[])
    ];
    const defaultMethod=methods[0]?.id||'';
    root.className='bo-payments bo-payments-premium';
    root.innerHTML=`<div class="bo-pay-heading"><div><span class="bo-pay-eyebrow">SECURE CHECKOUT</span><h3>Choose how to pay</h3></div>${testMode?'<span class="bo-pay-test-badge">TEST MODE</span>':'<span class="bo-pay-lock" aria-label="Secure payment">'+icon('card')+'</span>'}</div>
      <fieldset class="bo-pay-method-list"><legend class="bo-pay-sr">Payment method</legend>${methods.map((m,i)=>`<div class="bo-pay-option"><label class="bo-pay-method"><input type="radio" name="payment_choice" id="bo-payment-${m.id}" value="${m.id}" ${i===0?'checked':''} aria-controls="bo-pay-panel-${m.id}"><span class="bo-pay-method-icon">${icon(m.icon)}</span><span class="bo-pay-method-text"><strong>${m.name}</strong></span>${m.preference==='upi'?'<span class="bo-payment-mini-apps" aria-hidden="true"><b><img src="assets/payment-logos/googlepay.svg" alt=""></b><b><img src="assets/payment-logos/phonepe.svg" alt=""></b><b><img src="assets/payment-logos/paytm.svg" alt=""></b></span>':''}<span class="bo-pay-chevron" aria-hidden="true">⌄</span></label>
      <section class="bo-pay-option-body" id="bo-pay-panel-${m.id}" ${i===0?'':'hidden'}>${m.preference==='upi'?`<fieldset class="bo-upi-apps"><legend class="bo-pay-sr">Choose a UPI app</legend>${apps.map((app,n)=>`<label class="bo-upi-app"><input type="radio" name="upi_app" id="bo-upi-${app.id}" value="${app.id}" ${n===0?'checked':''}><span class="bo-upi-logo bo-upi-logo-${app.style}" aria-hidden="true">${logo(app)}</span><strong>${app.name}</strong><span class="bo-upi-selected" aria-hidden="true">✓</span></label>`).join('')}</fieldset>`:m.preference==='cod'?'<p>Pay when your order arrives.</p>':`<p>${m.preference==='card'?'Select your card':m.preference==='netbanking'?'Select your bank':'See available wallets'} securely in Razorpay.</p>`}</section></div>`).join('')}</fieldset>
      <input type="hidden" name="payment" value="${defaultMethod==='COD'?'COD':defaultMethod==='RAZORPAY_UPI'?'RAZORPAY_UPI':'RAZORPAY'}">
      ${!methods.length?'<p class="bo-pay-unavailable" role="status">Online payments are temporarily unavailable.</p>':''}
      <p class="bo-pay-provider"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="8" width="12" height="10" rx="2"/><path d="M6 8V6a4 4 0 0 1 8 0v2"/></svg> Secured by <strong>Razorpay</strong>${testMode?' · Simulated payment':''}</p>`;
    const form=root.closest('form'),submit=form.querySelector('button[type=submit]');
    const footer=document.createElement('div');footer.className='bo-pay-action-bar';
    footer.innerHTML='<div class="bo-pay-amount"><span>Total payable</span><strong>'+escape(amount)+'</strong></div>';
    submit.before(footer);footer.appendChild(submit);
    function selection(){const choice=methods.find(m=>m.id===root.querySelector('[name=payment_choice]:checked')?.value);return {method:choice?.id==='RAZORPAY_UPI'?'RAZORPAY_UPI':choice?.id==='COD'?'COD':choice?'RAZORPAY':'',preference:choice?.preference||'all',app:root.querySelector('[name=upi_app]:checked')?.value||'other'};}
    function canPay(){const {method}=selection();return method==='RAZORPAY_UPI'?gatewayEnabled&&upiEnabled:method==='RAZORPAY'?gatewayEnabled:method==='COD'&&allowCod;}
    function update(){
      const choice=root.querySelector('[name=payment_choice]:checked')?.value,{method,app}=selection();
      root.querySelector('[name=payment]').value=method;
      root.querySelectorAll('.bo-pay-option-body').forEach(panel=>panel.hidden=panel.id!=='bo-pay-panel-'+choice);
      const appName=apps.find(a=>a.id===app)?.name||'UPI';
      submit.disabled=!canPay();
      submit.textContent=deliveryPending&&canPay()?'Calculate delivery':!canPay()?'Payment unavailable':method==='COD'?'Place order':testMode?'Continue · Test payment':method==='RAZORPAY_UPI'&&app!=='other'?'Continue with '+appName:'Continue to payment';
    }
    root.addEventListener('change',update);update();
    return {selection,canPay,setTotal(value){deliveryPending=false;amount=money(value);footer.querySelector('.bo-pay-amount strong').textContent=amount;update();}};
  }
  function money(value){return '₹'+Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  window.BOpaymentMethods={mount};
})();
