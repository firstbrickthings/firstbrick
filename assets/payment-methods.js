/* Payment choices only. PIN entry and payment approval belong to the UPI app. */
(function () {
  const apps = [
    {id:'google_pay', name:'Google Pay', mark:'G', style:'google'},
    {id:'phonepe', name:'PhonePe', mark:'पे', style:'phonepe'},
    {id:'paytm', name:'Paytm', mark:'paytm', style:'paytm'},
    {id:'bhim', name:'BHIM', mark:'BHIM', style:'bhim'}
  ];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(root, options) {
    const {total, testMode, upiEnabled, gatewayEnabled, allowCod} = options;
    let amount = '₹' + Number(total).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
    let deliveryPending=options.deliveryPending===true;
    const defaultMethod = upiEnabled && gatewayEnabled ? 'RAZORPAY_UPI' : gatewayEnabled ? 'RAZORPAY' : allowCod ? 'COD' : '';
    const methods = [
      ...(gatewayEnabled ? [
        {id:'RAZORPAY_UPI', name:'UPI', detail:'Google Pay, PhonePe, Paytm & more', symbol:'UPI'},
        {id:'RAZORPAY', name:'Card / Netbanking', detail:'Pay securely with Razorpay', symbol:'▤'}
      ] : []),
      ...(allowCod ? [{id:'COD', name:'Cash on delivery', detail:'Pay when your order arrives', symbol:'₹'}] : [])
    ];
    root.className='bo-payments';
    root.innerHTML=`<div class="bo-pay-heading"><div><span class="bo-pay-eyebrow">PAYMENT</span><h3>Choose how to pay</h3></div>${testMode?'<span class="bo-pay-test-badge">TEST MODE</span>':''}</div>
      <div class="bo-pay-amount"><span>Amount to pay<small>Your order total is filled automatically</small></span><strong>${escape(amount)}</strong></div>
      <fieldset class="bo-pay-method-list"><legend class="bo-pay-sr">Payment method</legend>${methods.map(m=>`<label class="bo-pay-method"><input type="radio" name="payment_choice" id="bo-payment-${m.id}" value="${m.id}" ${m.id===defaultMethod?'checked':''}><span class="bo-pay-method-icon ${m.id==='RAZORPAY_UPI'?'bo-pay-upi-icon':''}" aria-hidden="true">${m.symbol}</span><span class="bo-pay-method-text"><strong>${m.name}</strong><small>${m.detail}</small></span><span class="bo-pay-radio" aria-hidden="true"></span></label>`).join('')}</fieldset>
      <input type="hidden" name="payment" value="${defaultMethod}">
      <section id="bo-upi-panel" class="bo-upi-panel" aria-label="UPI payment apps" hidden>
        <div class="bo-upi-title"><h4>Choose your UPI app</h4><span>${testMode?'App preview':'UPI payment'}</span></div>
        <fieldset class="bo-upi-apps"><legend class="bo-pay-sr">UPI app</legend>${apps.map((app,i)=>`<label class="bo-upi-app"><input type="radio" name="upi_app" id="bo-upi-${app.id}" value="${app.id}" ${i===0?'checked':''}><span class="bo-upi-logo bo-upi-logo-${app.style}" aria-hidden="true">${app.mark}</span><strong>${app.name}</strong><span class="bo-upi-selected" aria-hidden="true">✓</span></label>`).join('')}</fieldset>
        <p class="bo-upi-selection" id="bo-upi-selection" aria-live="polite"></p>
        <ol class="bo-upi-steps" aria-label="How UPI payment works"><li><span>1</span>Choose app</li><li><span>2</span>Approve in app</li><li><span>3</span>Get confirmation</li></ol>
        <p class="bo-upi-security">Your amount is filled automatically. Enter your UPI PIN only inside your payment app.</p>
        <details class="bo-upi-lite"><summary><span aria-hidden="true">⚡</span> About UPI Lite</summary><p>UPI Lite is a feature inside supported UPI apps. Your app decides whether it is available for a payment; it is not a separate payment app. Eligible Lite payments may not ask for a UPI PIN.</p></details>
        <div id="bo-upi-help" class="bo-upi-help" role="status">${!upiEnabled?'UPI is not available for this store yet. Please choose Card / Netbanking or contact BabyOne.':testMode?'This is a test simulation. App switching and PIN approval require live payments. In Razorpay, use success@razorpay to test success or failure@razorpay to test failure.':'Continue to Razorpay to approve the payment using your chosen UPI app, where supported.'}</div>
        ${!upiEnabled?'<button type="button" class="bo-upi-fallback">Use Card / Netbanking instead →</button>':''}
      </section>
      <p class="bo-pay-footer">${testMode?'Razorpay Test Mode uses simulated payments.':'Payment is confirmed only after verification.'}</p>`;
    const form=root.closest('form'), submit=form.querySelector('button[type=submit]');
    function selection(){return {method:root.querySelector('[name=payment_choice]:checked')?.value || '', app:root.querySelector('[name=upi_app]:checked')?.value || 'google_pay'};}
    function canPay(){const {method}=selection();return method==='RAZORPAY_UPI'?gatewayEnabled && upiEnabled:method==='RAZORPAY'?gatewayEnabled:method==='COD' && allowCod;}
    function update(){
      const {method,app}=selection(), upi=method==='RAZORPAY_UPI';
      root.querySelector('[name=payment]').value=method;
      root.querySelector('#bo-upi-panel').hidden=!upi;
      const appName=apps.find(a=>a.id===app)?.name || 'UPI';
      root.querySelector('#bo-upi-selection').textContent=appName+' selected'+(testMode?' · preview for live payments':'');
      submit.disabled=!canPay();
      submit.textContent=deliveryPending&&canPay()?'Calculate delivery':!canPay()?(upi?'UPI unavailable · choose another method':'Payment unavailable · try again'):method==='COD'?'Place order · '+amount:testMode?(upi?'Test UPI payment · ':'Pay securely · ')+amount:'Pay '+amount+(upi?' with '+appName:'');
    }
    root.addEventListener('change',update);
    root.querySelector('.bo-upi-fallback')?.addEventListener('click',()=>{root.querySelector('#bo-payment-RAZORPAY').checked=true;update();root.querySelector('#bo-payment-RAZORPAY').focus();});
    update();
    return {selection,canPay,setTotal(value){deliveryPending=false;amount='₹'+Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});root.querySelector('.bo-pay-amount strong').textContent=amount;update();}};
  }
  window.BOpaymentMethods={mount};
})();
