/* Subcategory covers follow the shared catalogue, without changing product data. */
(function(){
 'use strict';
 const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const aliases={
  'Newborn Clothing':['Onesies & Rompers'],
  'Caps, Mittens & Booties':['Mits & Caps'],
  'Feeding':['Feeding Bottles'],
  'Diapering':['Diapers'],
  'Bath & Skincare':['Baby Care Sets','Baby Wash & Shampoo'],
  'Bedding':['Mattresses & Bedding'],
  'Gifts & Hampers':['Gift Sets'],
  'Mother’s Essentials':['Maternity Pads'],
  'Teethers & Pacifiers':['Rattles & Teethers'],
  'Jabla':['Jablas','Infants'],
  'Swaddles':['Swaddles & Sleepsuits'],
  'Battery Toys':['RC Toys'],
  'Activity Toys':['Montessori Toys'],
  'Play Gym & Play Mat':['Play Gyms','Play Mats'],
  'Combo':['Combo ₹1,999','Hospital Bags'],
  'Mattress & Bed':['Mattresses & Bedding'],
  'Mittens & Caps':['Mits & Caps'],
  'Rompers & Bodysuits':['Onesies & Rompers'],
  'Jablas':['Jabla','Infants'],
  'Nappy':['Cloth Diapers','Cloth'],
  'Bath Towels':['Towels'],
  'Skincare & Diapers':['Diapers','Baby Care Sets'],
  'Cradles':['Manual Cradles'],
  'Cradle Accessories':['Mattresses & Bedding'],
  'Swings':['Electric Swings'],
  'Play Gym':['Play Gyms'],
  'Mom Accessories (Bags)':['Mother Bag','Hospital Bags'],
  'Carrier':['Baby Carriers'],
  'Wipes':['Baby Wipes'],
  'Diaper Changing Mat':['Diaper Changing Mats'],
  'Caps':['Mits & Caps'],
  'Mother Bag':['Hospital Bags'],
  'Feeding Cover':['Feeding Covers'],
  'Disposable Diaper Bags':['Diapers']
 };
 const bath={Cetaphil:'assets/photo-76b4b378c6adb71e.webp',Sebamed:'assets/photo-d1cf9924a727bdf6.webp'};
 // Category reference photos from the existing catalogue suppliers’ public product feeds.
 const referencePhotos={
  "Feeding Cover": "https://cdn.shopify.com/s/files/1/0068/6135/7171/files/1_e8ce59c0-9593-4877-85da-d2b10953ca66.webp?v=1794556212",
  "Diaper Changing Mat": "https://cdn.shopify.com/s/files/1/0068/6135/7171/files/masilo-changing-mat-1046048.png?v=1788849334",

  "Suction Toys": "https://cdn.shopify.com/s/files/1/0068/6135/7171/files/scoobies-stick-i-dgets-orange-5449698.jpg?v=1752672731",
  "Disposable Diaper Bags": "https://cdn.shopify.com/s/files/1/0068/6135/7171/files/safe-o-kid-disposable-diaper-bags-blue-4203548.jpg?v=1785823826",
  "Cutlery": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/E-COM01_33b0b6a7-e8d1-49a0-b081-8b46655f3d24.jpg?v=1765757282",
  "Sipper Cups": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/Ecom_1.jpg?v=1763127792",
  "Feeding Bottle Cleaning": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/19380Siliconbottle_nipplebrushBlueEcom-1.jpg?v=1765758861",
  "Food Feeders & Nipples": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/Artboard1_c6a5a5c2-5c28-4da5-80a9-90009725c07f.jpg?v=1763134045",
  "Bath Towels": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/SLIDE1_b4c39bb1-3726-4547-b8a0-f6e8d06d9520.jpg?v=1763130511",
  "Swatter & Rompers": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/906188-906190.jpg?v=1781699657",
  "Baby Car Seat": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/SLIDE1_b7687234-025d-4f68-9e0c-a59edc91b02c.jpg?v=1763139638",
  "Stroller": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/Artboard1_f9d9122d-c773-4fd2-808e-00ed631599d5.jpg?v=1763139361",
  "Ear Muff": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/61WXamrWzWL.jpg?v=1779728562",
  "Warm Bottle": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/19975_ElectricBottleWarmer_E-Comm_1.jpg?v=1788265789",
  "Bottle Warmer": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/19975_ElectricBottleWarmer_E-Comm_1.jpg?v=1788265789",
  "Food Container": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/814agS59KGL.jpg?v=1779730919",
  "Bib": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/E-COM01_1c3af49c-50fe-49b4-81b0-2c97089f4900.jpg?v=1763132444",
  "Baby Holder": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/E-COM1_3b1b32ed-2e64-4ed0-98b4-f880be2769f5.jpg?v=1763135774",
  "Cycle": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/19598_Ecom_01.jpg?v=1763128010",
  "Swing Car": "https://cdn.shopify.com/s/files/1/0673/9633/7876/files/Artboard1_3fb083f1-0109-44b1-bee5-f29b3c6695ba.jpg?v=1763126839",
  "Ride-On": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/1_0ae5756a-324c-4e42-9b30-03106861ab0e.jpg?v=1793872191",
  "Electric Ride-On": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/1_0ae5756a-324c-4e42-9b30-03106861ab0e.jpg?v=1793872191",
  "Play Gym": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/81koB9IjmsL._SL1500.jpg?v=1791193588",
  "Teethers & Pacifiers": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/71YcuPClSzL.jpg?v=1779729147",
  "Cradle Accessories": "https://cdn.shopify.com/s/files/1/0717/4622/4450/files/81_a4FjH9_L._SL1500.jpg?v=1791617523"
};
 const covers=new WeakMap();
 const ownerProfiles={
  'Ride-On':{'Cycle':'bo-photo-3bc4-013','Swing Car':'bo-photo-3bc4-024','Ride-On':'bo-photo-3bc4-037','Electric Ride-On':'bo-photo-3bc4-027'},
  'Potty':{'Potty Set':'bo-photo-3bc4-007'},
  'Travel & Gear':{'Walkers':'bo-photo-3bc4-002','Swings':'bo-photo-3bc4-016'},
  'Toys & Learning':{'Activity Toys':'bo-photo-3bc4-033'},
  'Cradles & Rockers':{'Electric Swings':'bo-photo-3bc4-034','Bouncers':'bo-photo-3bc4-022'},
  'Bath & Skincare':{'Bath Tubs':'bo-photo-3bc4-008'},
  'Feeding':{'High Chairs':'bo-photo-3bc4-035'}
 };
 function candidates(category,tile){
  const target=normalize(tile),names=[target,...(aliases[tile]||[]).map(normalize)];
  const products=productsData.filter(p=>!p.catalogHidden&&!p.live_gateway_check&&p.id!=='babyone-hospital-bag-payment-check'&&p.image&&!/favicon|payment-check/i.test(p.image));
  const local=products.filter(p=>p.category===category);
  const curated=typeof babyoneCuratedTileImages==='undefined'?{}:babyoneCuratedTileImages;
  const matches=p=>normalize(p.subcategory)===target||normalize(p.brand)===target||normalize(p.catalogueNavigationGroup)===target;
  const named=p=>names.some(n=>n&&normalize(p.name).includes(n));
  const matcher=window.babyoneOwnerCategoryMatchers?.[category]?.[tile];
  const images=[
   local.find(p=>p.id===ownerProfiles[category]?.[tile]&&p.owner_photo_import)?.image,
   ...local.filter(p=>p.owner_photo_import&&matches(p)).map(p=>p.image),
   ...local.filter(matches).map(p=>p.image),curated[category]?.[tile],
   ...local.filter(named).map(p=>p.image),referencePhotos[tile],
   ...products.filter(p=>names.includes(normalize(p.subcategory))||normalize(p.brand)===target).map(p=>p.image),
   ...Object.values(curated).flatMap(group=>Object.entries(group).filter(([name])=>names.includes(normalize(name))).map(([,image])=>image)),
   ...local.filter(p=>matcher&&matcher.test([p.name,p.subcategory].join(' '))).map(p=>p.image),
   ...(category==='Bath & Skincare'?[bath[tile]]:[]),
   categoriesData.find(c=>c.name===tile)?.img,
   categoriesData.find(c=>c.name===category)?.img
  ];
  const unique=[...new Set(images.filter(Boolean))],categoryImage=categoriesData.find(c=>c.name===category)?.img;
  // Older seed rows reused the category picture; prefer a specific photo over that or a sample illustration.
  return [...unique.filter(src=>src!==categoryImage&&!src.startsWith('data:image/')),...unique.filter(src=>src!==categoryImage&&src.startsWith('data:image/')),...unique.filter(src=>src===categoryImage)];
 }
 window.babyoneSubcategoryCover=function(category,tile){
  const images=candidates(category,tile),safe=value=>escapeHtml(String(value));
  return '<img src="'+safe(images[0]||'assets/favicon.svg')+'" alt="'+safe(tile)+'" data-cover-category="'+safe(category)+'" data-cover-tile="'+safe(tile)+'" loading="lazy" decoding="async" onerror="babyoneRetrySubcategoryCover(this)">';
 };
 window.babyoneRetrySubcategoryCover=function(image){
  let state=covers.get(image);
  if(!state){state={images:candidates(image.dataset.coverCategory,image.dataset.coverTile),tried:new Set()};covers.set(image,state)}
  state.tried.add(image.getAttribute('src'));
  const next=state.images.find(src=>!state.tried.has(src));
  if(next)image.src=next;else image.onerror=null;
 };
})();
