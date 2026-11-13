/* Delivery is reviewed here; Razorpay is the single payment-method selector. */
(function(){
 'use strict';
 const money=n=>'₹'+Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 function mount(root,options){
  let total=money(options.total),pending=options.deliveryPending===true;
  const online=!!options.gatewayEnabled,cod=!!options.allowCod;
  root.className='bo-checkout-payment';
  root.innerHTML=(options.testMode?'<p class="bo-pay-test-badge">RAZORPAY TEST MODE · No real charge</p>':'')+
   (online&&cod?'<fieldset class="bo-checkout-payment-kind"><legend>Payment</legend><label><input id="bo-payment-RAZORPAY" type="radio" name="payment_choice" value="RAZORPAY" checked> Pay online</label><label><input id="bo-payment-COD" type="radio" name="payment_choice" value="COD"> Cash on delivery</label></fieldset>':'')+
   '<input type="hidden" name="payment" value="'+(online?'RAZORPAY':cod?'COD':'')+'">'+
   (online?'<p class="bo-checkout-provider"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="8" width="12" height="10" rx="2"/><path d="M6 8V6a4 4 0 0 1 8 0v2"/></svg> Secure payment with <strong>Razorpay</strong><span>UPI · Cards · Netbanking</span></p>':'');
  const form=root.closest('form'),submit=form.querySelector('button[type=submit]'),footer=document.createElement('div');
  footer.className='bo-pay-action-bar';footer.innerHTML='<div class="bo-pay-amount"><span>Total payable</span><strong>'+total+'</strong></div>';submit.before(footer);footer.appendChild(submit);
  function selection(){const method=root.querySelector('[name=payment_choice]:checked')?.value||(online?'RAZORPAY':cod?'COD':'');return {method,preference:'all',app:null}}
  function canPay(){return selection().method==='RAZORPAY'?online:selection().method==='COD'&&cod}
  function update(){const choice=selection();root.querySelector('[name=payment]').value=choice.method;submit.disabled=!canPay();submit.textContent=!canPay()?'Payment unavailable':pending?'Calculate delivery':choice.method==='COD'?'Place order':options.testMode?'Continue · Test payment':'Pay securely'}
  root.addEventListener('change',update);update();
  return {selection,canPay,setTotal(value){pending=false;total=money(value);footer.querySelector('strong').textContent=total;update()}};
 }
 window.BOpaymentMethods={mount};
})();
