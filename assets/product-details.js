/* Only owner-saved specifications are shown; missing details are left unpublished. */
(function(){
'use strict';
const labels={age_range:'Age range',material:'Material / ingredients',care_instructions:'Care instructions',country_of_origin:'Country of origin',barcode:'Barcode',manufacturer:'Manufacturer',safety_information:'Safety information',highlights:'Key features'},old=window.openProductModal;
window.openProductModal=function(id){
 const result=old.apply(this,arguments),p=productsData.find(p=>String(p.id)===String(id)),grid=document.querySelector('#modal-product-content .modal-grid'),target=grid?.children[1];
 if(!p||!target||document.getElementById('bo-detail-sticky-bar')?.dataset.productId!==String(id))return result;
 grid.classList.add('bo-product-layout');grid.children[0].classList.add('bo-product-media-column');grid.children[0].firstElementChild?.classList.add('bo-product-photo-frame');target.classList.add('bo-product-information');
 target.querySelector('.bo-product-specifications')?.remove();const details=p.product_details||{},entries=Object.entries(labels).filter(([key])=>details[key]?.trim());
 if(entries.length){
  const section=document.createElement('section');section.className='bo-product-specifications';const heading=document.createElement('h3');heading.textContent='Product details';section.appendChild(heading);const list=document.createElement('dl');
  for(const [key,label] of entries){const term=document.createElement('dt'),value=document.createElement('dd');term.textContent=label;value.textContent=details[key];list.append(term,value)}
  section.appendChild(list);const actions=target.querySelector('.bo-detail-inline-actions');actions?actions.before(section):target.appendChild(section);
 }
 return result;
};
})();
