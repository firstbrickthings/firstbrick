/* Public navigation follows the live catalogue; the owner keeps the complete category setup. */
(function(){
 'use strict';
 const visible=()=>productsData.filter(p=>!p.catalogHidden);
 const profiles={'Clothing':'bo-fashion-9d70-025','Toys & Learning':'bo-toys-261117-026','Ride-On':'bo-photo-3bc4-027','Feeding':'bo-toys-261117-054','Travel & Gear':'bo-photo-3bc4-002','Cradles & Rockers':'bo-photo-3bc4-034','Bath & Skincare':'babyone-cetaphil-001','Diapering':'babyone-diapers-001','Potty':'bo-photo-3bc4-007'};
 function categories(){return window.BO_USE_MYSQL?categoriesData.filter(c=>window.BOcatalogLoaded&&visible().some(p=>p.category===c.name)):categoriesData}
 function image(category){return visible().find(p=>p.id===profiles[category.name])?.image||visible().find(p=>p.category===category.name)?.image||category.img}
 function promos(cards){return !window.BO_USE_MYSQL?cards:cards.filter(c=>c.action==='potty'?visible().some(p=>p.category==='Potty'):visible().some(p=>Number(p.originalPrice)>Number(p.price)))}
 function banner(category){return !window.BO_USE_MYSQL||!category||visible().some(p=>p.category===category)}
 function bathGroup(p){
  const text=[p.brand,p.name,p.subcategory].filter(Boolean).join(' ').toLowerCase();
  if(p.category==='Diapering')return /wipe|tissue/.test(text)?'Wipes':'Diapers';
  if(p.category!=='Bath & Skincare')return null;
  if(/cetaphil|cetaplil/.test(text))return 'Cetaphil';
  if(/sebamed/.test(text))return 'Sebamed';
  if(p.catalogueNavigationGroup)return p.catalogueNavigationGroup;
  if(/^(diapers|cloth diapers)$/i.test(p.subcategory||''))return 'Diapers';
  if(/wipe|tissue/.test(text))return 'Wipes';
  if(/massage.*mat|massaging.*mat/.test(text))return 'Massaging Mats';
  if(/bath.?tub|baby bather|bath seat|bath support/.test(text))return 'Bath Tubs';
  return 'Accessories';
 }
 function bathProducts(tile,filter='All'){
  let list=visible().filter(p=>bathGroup(p)===tile);
  if(filter&&filter!=='All')list=list.filter(p=>p.subcategory===filter);
  return list;
 }
 function bathConfig(base){
  if(!window.BO_USE_MYSQL)return base;
  const tiles=base.subcategoryTiles.filter(tile=>bathProducts(tile).length);
  return {...base,subcategoryTiles:tiles,filters:Object.fromEntries(tiles.map(tile=>[tile,['All',...new Set(bathProducts(tile).map(p=>p.subcategory).filter(Boolean))]]))};
 }
 function diaperProducts(tile){
  return visible().filter(p=>{
   const group=bathGroup(p),cloth=/cloth diapers|freesize uno/i.test([p.subcategory,p.name].join(' '));
   return tile==='Wipes'?group==='Wipes':tile==='Cloth Diapers'?group==='Diapers'&&cloth:group==='Diapers'&&!cloth;
  });
 }
 function collectionImage(category,tile){
  const list=category==='Bath & Skincare'?bathProducts(tile):category==='Diapering'?diaperProducts(tile):[];
  return list.find(p=>p.owner_photo_import)?.image||list[0]?.image;
 }
 function finishNavigation(){
  const previousConfig=window.getNavConfig,previousProducts=window.getPLPProducts;
  window.getNavConfig=function(category){
   if(window.BO_USE_MYSQL&&category==='Diapering'){
    const tiles=['Diapers','Cloth Diapers','Wipes'].filter(t=>diaperProducts(t).length);
    return {subcategoryTiles:tiles,tileType:{},filters:Object.fromEntries(tiles.map(t=>[t,['All']])),filterMap:{}};
   }
   return previousConfig.apply(this,arguments);
  };
  window.getPLPProducts=function(){
   if(window.BO_USE_MYSQL&&navState.category==='Diapering'&&navState.subcategory!=='All')return diaperProducts(navState.subcategory);
   return previousProducts.apply(this,arguments);
  };
 }
 window.BOcatalogView={categories,image,promos,banner,bathGroup,bathProducts,bathConfig,collectionImage};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finishNavigation);else finishNavigation();
})();
