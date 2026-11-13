/* Public store contact links. Owner authentication uses its separate verified allowlist. */
(function(){
'use strict';
const phone='+917034476592',whatsapp='https://wa.me/917034476592',email='babyonestores@gmail.com';
function start(){
 document.querySelectorAll('a[href^="tel:"]').forEach(a=>{a.href='tel:'+phone;a.textContent='+91 70344 76592'});
 document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>{const url=new URL(a.href);url.pathname='/917034476592';a.href=url.href});
 const footer=document.querySelector('.bo-footer-top');if(footer&&!footer.querySelector('[href^="mailto:"]')){const a=document.createElement('a');a.href='mailto:'+email;a.textContent=email;footer.appendChild(a)}
 const button=document.createElement('a');button.id='bo-whatsapp-float';button.className='bo-whatsapp-float';button.href=whatsapp+'?text='+encodeURIComponent('Hi BabyOne, I would like help with my shopping.');button.target='_blank';button.rel='noopener';button.setAttribute('aria-label','Chat with BabyOne on WhatsApp');button.title='Chat with BabyOne on WhatsApp';
 button.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.1 3A12.8 12.8 0 0 0 5.04 22.24L3.2 29l6.94-1.82A12.8 12.8 0 1 0 16.1 3Zm0 23.4a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-4.12 1.08 1.1-4.02-.25-.41A10.62 10.62 0 1 1 16.1 26.4Zm5.82-7.96c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.5-.16-.72.16-.21.32-.83 1.05-1.02 1.26-.19.21-.37.24-.69.08-.32-.16-1.36-.5-2.6-1.61-.96-.86-1.61-1.91-1.8-2.23-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.63-.53-.54-.72-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68 0 1.58 1.15 3.11 1.31 3.32.16.21 2.26 3.45 5.48 4.84.76.33 1.36.53 1.82.68.76.24 1.44.21 1.98.13.6-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.14-.3-.22-.62-.38Z"/></svg><span>WhatsApp</span>';
 document.body.appendChild(button);
 const observer=new MutationObserver(()=>{const blocked=['bo-admin-layer','bo-server-admin','bo-u-modal','product-modal','cart-drawer','wishlist-drawer'].some(id=>{const e=document.getElementById(id);return e&&!e.classList.contains('hidden')&&e.getClientRects().length});button.hidden=blocked});
 observer.observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
