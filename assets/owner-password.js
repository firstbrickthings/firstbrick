/* Owner-only password entry; customer SMS sign-in remains separate. */
(()=>{
 'use strict';
 const api=(window.BABYONE_API_BASE||'/api').replace(/\/$/, '');
 async function call(path,body){
  const headers={'Content-Type':'application/json',...await BOauth.headers('POST').catch(()=>({}))};
  const response=await fetch(api+path,{method:'POST',credentials:'same-origin',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Owner sign-in could not be completed. Please try again.');return data;
 }
 function shell(title,intro,fields,action){
  const modal=document.getElementById('bo-u-modal'),body=document.getElementById('bo-u-content');
  modal.classList.remove('hidden','bo-full-checkout');document.body.style.overflow='hidden';
  body.innerHTML='<span class="eyebrow">BabyOne · Owner</span><h2 class="bo-email-title">'+title+'</h2><p class="bo-email-intro">'+intro+'</p><form id="bo-owner-password-form">'+fields+'<p class="bo-work-status" role="status" aria-live="polite"></p><button class="btn btn-pink" type="submit" style="width:100%">'+action+'</button></form>';
  modal.firstElementChild.scrollTop=0;return body.querySelector('form');
 }
 async function finish(){
  await BOauth.refresh();const user=await BOserver.checkIdentity();
  if(!user?.is_admin)throw Error('Owner access is not available. Please sign in again.');
  localStorage.setItem('babyone-session-event',String(Date.now()));boU.close();await boAdmin.openDashboard();
 }
 function change(current){
  const form=shell('Choose your owner password','Set a new password with at least 12 characters to finish opening your dashboard.',
   '<label class="bo-work-field">New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label class="bo-work-field">Confirm password<input name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label>','Save password & open dashboard');
  form.onsubmit=async e=>{e.preventDefault();const status=form.querySelector('[role=status]'),button=form.querySelector('button');if(form.password.value!==form.confirm.value){status.textContent='The passwords do not match.';return}button.disabled=true;status.textContent='Saving your password…';try{await call('/auth/owner/password/change',{current_password:current,password:form.password.value});await finish()}catch(error){status.textContent=error.message}finally{button.disabled=false}};
  form.password.focus();
 }
 function open(){
  const form=shell('Owner dashboard','Enter your owner password. No SMS code is needed.',
   '<label class="bo-work-field">Owner mobile number<input name="phone" type="tel" autocomplete="username" value="9645762324" readonly></label><label class="bo-work-field">Password<input name="password" type="password" autocomplete="current-password" maxlength="256" required></label>','Open dashboard');
  form.onsubmit=async e=>{e.preventDefault();const status=form.querySelector('[role=status]'),button=form.querySelector('button');button.disabled=true;status.textContent='Signing in…';try{const password=form.password.value,result=await call('/auth/owner/password',{phone:form.phone.value,password});await BOauth.refresh();if(result.password_change_required)change(password);else await finish()}catch(error){status.textContent=error.message}finally{button.disabled=false}};
  form.password.focus();
 }
 window.BOownerLogin={open};
 if(new URLSearchParams(location.search).get('owner-login')==='1')BOauth.ready.then(open);
})();
