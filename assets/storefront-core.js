
/* ================= CATEGORIES — matching avatar imagery ================= */
const categoriesData = [
  { id:'newborn', name:'New Born', img:'assets/photo-b3ba3fb637d4fb1f.webp', subcategories:["Swaddles & Sleepsuits","Hospital Bags","Mits & Caps","Baby Care Sets","Newborn Clothing","Caps, Mittens & Booties","Feeding","Diapering","Bath & Skincare","Bedding","Gifts & Hampers","Mother’s Essentials"] },
  { id:'feeding', name:'Feeding', img:'assets/photo-0a9732be3078be31.webp', subcategories:["Feeding Bottles","Breast Pumps","Sterilizers","High Chairs","Bibs & Burp Cloths","Cutlery","Sipper Cups","Feeding Bottle Cleaning","Teethers & Pacifiers","Food Feeders & Nipples"] },
  { id:'diapering', name:'Diapering', img:'assets/photo-7c6436cb7c7c1668.webp', subcategories:['Organic Diapers','Wipes & Care','Diaper Rash Cream','Diaper Bags','Changing Mats'] },
  { id:'clothing', name:'Clothing', img:'assets/photo-2441543eec86ee1d.webp', subcategories:["Onesies & Rompers","Party Wear","Organic Cotton Suits","Booties & Shoes","Jabla","Infants","Dry Sheets","Swaddles","Diaper Changing Mats"] },
  { id:'toys', name:'Toys & Learning', img:'assets/photo-f6599321d4bd42c5.webp', subcategories:["Rattles & Teethers","Montessori Toys","Play Gyms","Battery Toys","Activity Toys","Soft Toys","Gift Sets","RC Toys","Play Gym & Play Mat"] },
  { id:'nursery', name:'Hospital Kit', img:'assets/photo-984aa8a4f6f21e5c.webp', subcategories:["Cribs & Cots","Mattresses & Bedding","Wardrobes","Night Lights","Combo","Mattress & Bed","Swaddles","Mittens & Caps","Rompers & Bodysuits","Jablas","Nappy","Dry Sheets","Basket","Bath Towels","Skincare & Diapers","Breast Pumps","Maternity Pads","Nipple Shields","Cradles","Combo ₹1,999","Combo ₹3,999","Combo ₹4,999","Combo ₹5,999"] },
  { id:'cradles', name:'Cradles & Rockers', img:'assets/photo-c1763c2d5d1568c3.webp', subcategories:["Electric Swings","Manual Cradles","Bouncers","Rocking Chairs","Hanging Cradle","Cradle Accessories"] },
  { id:'bath', name:'Bath & Skincare', img:'assets/photo-f27553fc206c5297.webp', subcategories:['Cetaphil','Sebamed','Wipes','Diapers','Accessories','Bath Tubs','Massaging Mats'] },
  { id:'travel', name:'Travel & Gear', img:'assets/photo-b00701b131d8c0a4.webp', subcategories:["Strollers & Prams","Car Seats","Baby Carriers","Walkers","Wardrobes","Cabinets","Swings","Skating Rides","Play Mats","Play Gym"] },
  { id:'momcare', name:'Mom Care', img:'assets/photo-bec649ce96bf53f3.webp', subcategories:["Maternity Wear","Nursing Bras","Postpartum Care","Stretch Mark Oils","Feeding Pillow","Breast Pumps","Mom Accessories (Bags)","Maternity Pillow","Maternity Pads","Carrier","Feeding Covers"] },
  { id:'travel-essentials', name:'Travel', img:'assets/photo-fb82a54b6bf76f36.webp', subcategories:['Swatter & Rompers','Diaper Changing Mat','Baby Car Seat','Stroller','Caps','Mother Bag','Feeding Cover','Ear Muff','Warm Bottle','Food Container','Disposable Diaper Bags','Bib','Baby Holder','Suction Toys','Bottle Warmer'] },
  { id:'rideon', name:'Ride-On', img:'assets/photo-b00701b131d8c0a4.webp', subcategories:['Cycle','Swing Car','Ride-On','Play Gym','Electric Ride-On'] }
];

/* ================= PRODUCTS — premium international imagery ================= */
const productsData = [
  { id:'p1', name:'CloudComfort Ergonomic Stroller 360', category:'Travel & Gear', subcategory:'Strollers & Prams', price:249.99, originalPrice:299.99, rating:4.9, reviews:128, badge:'Best Seller', image:'assets/photo-fb82a54b6bf76f36.webp', description:'Ultra-lightweight aluminium stroller with 360° shock-absorption wheels and a multi-position reclining seat.' },
  { id:'p2', name:'Organic Cotton Newborn Romper Gift Set', category:'New Born', subcategory:'Swaddles & Sleepsuits', price:39.99, originalPrice:54.99, rating:4.8, reviews:94, badge:'100% Organic', image:'https://images.unsplash.com/photo-1555252335-9f8e9a6b0c9f?auto=format&fit=crop&w=800&q=80', description:'Super soft, breathable GOTS-certified organic cotton onesies designed for delicate baby skin.' },
  { id:'p3', name:'Smart Anti-Colic Glass Feeding Bottle 250ml', category:'Feeding', subcategory:'Feeding Bottles', price:22.50, originalPrice:28.00, rating:4.9, reviews:210, badge:'Parent Favorite', image:'assets/photo-95048201ec0a5b1f.webp', galleryImages:['assets/photo-95048201ec0a5b1f.webp','assets/photo-8e00ef61cd68cb20.webp','assets/photo-f9033511e44bbb66.webp','assets/photo-6de26435f89c3f7f.webp','assets/photo-61aabfd6a2f9c422.webp','assets/photo-ebab3b0f8e4531ab.webp'], description:'Innovative anti-colic ventilation system that reduces air intake during feeding.' },
  { id:'p4', name:'Ultra-Soft Plant-Based Diapers (Pack of 80)', category:'Diapering', subcategory:'Organic Diapers', price:34.99, originalPrice:42.00, rating:4.7, reviews:340, badge:'Hypoallergenic', image:'assets/photo-c562ec1abc425f78.webp', description:'Dermatologist-tested, eco-friendly diapers with a wetness indicator and leak protection.' },
  { id:'p5', name:'Montessori Wooden Sensory Activity Gym', category:'Toys & Learning', subcategory:'Montessori Toys', price:68.00, originalPrice:85.00, rating:4.9, reviews:88, badge:'Eco Toys', image:'assets/photo-528c44762894740f.webp', description:'Sustainably sourced wooden play gym with non-toxic hanging sensory toys.' },
  { id:'p6', name:'SnoozeGlide Automatic Electric Cradle Swing', category:'Cradles & Rockers', subcategory:'Electric Swings', price:189.99, originalPrice:220.00, rating:4.8, reviews:65, badge:'Smart Motion', image:'assets/photo-cfcf4656e36529db.webp', description:'Five unique sway speeds, integrated lullaby sounds and Bluetooth connection.' },
  { id:'p7', name:'Gentle Chamomile Baby Wash & Shampoo Set', category:'Bath & Skincare', subcategory:'Baby Wash & Shampoo', price:18.99, originalPrice:24.00, rating:4.9, reviews:175, badge:'Tear-Free', image:'assets/photo-f56907c274013c09.webp', description:'Tear-free nourishing cleanser infused with soothing chamomile and lavender.' },
  { id:'p8', name:'Luxe Convertible Solid Wood Crib & Bed', category:'Hospital Kit', subcategory:'Cribs & Cots', price:380.00, originalPrice:450.00, rating:5.0, reviews:42, badge:'Convertible', image:'assets/photo-2ae1a01f61b30362.webp', description:'4-in-1 convertible wooden crib that easily transforms from crib to toddler bed.' },
  { id:'p9', name:'Luxury Velvet Ergonomic Nursing Pillow', category:'Mom Care', subcategory:'Postpartum Care', price:45.00, originalPrice:59.99, rating:4.9, reviews:112, badge:'Mom Essential', image:'assets/photo-e5571d4de112de4b.webp', description:'Relieves back and arm strain during nursing with memory-foam support.' },
  { id:'p10', name:'Mini Electric Speedster Ride-On Car', category:'Ride-On', subcategory:'Electric Ride-On', price:159.00, originalPrice:199.00, rating:4.8, reviews:79, badge:'Hot Seller', image:'assets/photo-b00701b131d8c0a4.webp', galleryImages:['assets/photo-b00701b131d8c0a4.webp','assets/photo-6b36bdb0d1108068.webp','assets/photo-e9c1fb9c85ad7507.webp','assets/photo-ad4bde6e53cc7d88.webp'], description:'A fun ride-on car for little adventures. Check the manufacturer age, weight and safety guidance before use.' },
  { id:'p11', name:'6-in-1 Steam Baby Bottle Sterilizer', category:'Feeding', subcategory:'Sterilizers', price:39.99, originalPrice:49.99, rating:4.8, reviews:86, badge:'Feeding Essential', image:'assets/photo-180794c401881818.webp', galleryImages:[
    'assets/photo-180794c401881818.webp',
    'assets/photo-f011e22e0282bf1d.webp',
    'assets/photo-a3fade943a03933b.webp',
    'assets/photo-5c380d51e563e3cb.webp',
    'assets/photo-010436bde8063e50.webp',
    'assets/photo-78464b9acd558b85.webp'
  ], description:'A steam sterilizer for baby feeding bottles and accessories. Check the manufacturer instructions and compatibility before use.' }
];

// Expand catalogue to six browsable items per category, each clearly labelled by subcategory.
(function ensureSixProductsPerCategory(){
  const subcats={
    'New Born':['Swaddles & Sleepsuits','Sleeping Bags','Diapers & Wipes','Feeding Bottles','Sterilizers','Bedding Sets'],
    'Feeding':['Feeding Bottles','Nipples & Teats','Breast Pumps','High Chairs','Formula & Food','Sippy Cups & Utensils'],
    'Diapering':['Organic Diapers','Baby Wipes','Changing Mats','Diaper Bags','Diaper Creams','Nappy Organisers'],
    'Clothing':['Newborn Rompers','Daywear Sets','Sleepwear','Bodysuits','Knitwear','Occasion Wear'],
    'Toys & Learning':['Montessori Toys','Soft Toys','Ride-On Toys','Rattles & Teethers','STEM Toys','Art & Craft'],
    'Hospital Kit':['Cribs & Cots','Wardrobes','Bedding Sets','Night Lights','Storage Baskets','Mattresses'],
    'Cradles & Rockers':['Electric Cradles','Manual Cradles','Cradle Swings','Baby Bouncers','Bassinettes','Cradle Accessories'],
    'Bath & Skincare':['Baby Wash & Shampoo','Baby Lotions','Bath Tubs','Grooming Kits','Baby Oils','Bath Towels'],
    'Travel & Gear':['Strollers & Prams','Baby Carriers','Car Seats','Travel Bags','Ride-On Cars','Stroller Accessories'],
    'Mom Care':['Maternity Wear','Nursing Covers','Nursing Pillows','Postpartum Care','Breastfeeding Essentials','Maternity Bags']
  };
  const baseByCat={}; productsData.forEach(p=>{if(!baseByCat[p.category])baseByCat[p.category]=p;});
  const existing=productsData.slice();
  categoriesData.forEach((cat,ci)=>{
    const subs=subcats[cat.name]||['Essentials','Everyday Care','Comfort','Accessories','Premium Picks','New Arrivals'];
    const have=productsData.filter(p=>p.category===cat.name);
    const base=baseByCat[cat.name]||existing[ci%existing.length];
    for(let n=have.length;n<6;n++){
      const sub=subs[n%subs.length];
      productsData.push({...base,id:'auto-'+cat.id+'-'+n,name:sub+' — BabyOne Essential',subcategory:sub,price:Number((base.price*(0.72+(n%4)*0.13)).toFixed(2)),originalPrice:Number((base.price*(0.95+(n%4)*0.13)).toFixed(2)),badge:n===5?'New Arrival':'Everyday Essential',description:'Thoughtfully selected BabyOne essential designed for everyday comfort and convenience.'});
    }
    productsData.filter(p=>p.category===cat.name).forEach((p,i)=>{if(!p.subcategory||p.subcategory==='All')p.subcategory=subs[i%subs.length];});
  });
})();

// Editable starter catalogue: six sample products for each Bath & Skincare brand/range.
// These are clearly marked as samples so the store owner can replace details in Admin later.
(function seedBathSkincareStarterProducts(){
  const groups = [
    {key:'Cetaphil',brand:'Cetaphil',image:'assets/photo-76b4b378c6adb71e.webp',names:['Gentle Baby Wash','Daily Baby Lotion','Moisturising Cream','Baby Shampoo','Diaper Care Cream','Gentle Cleansing Bar']},
    {key:'Sebamed',brand:'Sebamed',image:'assets/photo-d1cf9924a727bdf6.webp',names:['Baby Bubble Bath','Baby Lotion','Baby Shampoo','Baby Cleansing Bar','Baby Protective Facial Cream','Baby Diaper Rash Cream']},
    {key:'Wipes',brand:'BabyOne Selection',image:'assets/photo-8547e56b6781f5d9.webp',names:['Water Baby Wipes','Sensitive Skin Wipes','Fragrance-Free Wipes','Travel Packs','Extra Soft Wipes','Daily Care Wipes']},
    {key:'Diapers',brand:'BabyOne Selection',image:'assets/photo-859aa86800d22bf7.webp',names:['Newborn Tape Diapers','Baby Pant Diapers','Overnight Diapers','Premium Soft Diapers','Air Dry Diapers','Gentle Care Diapers']},
    {key:'Accessories',brand:'BabyOne Selection',image:'assets/photo-5c3208902de8e461.webp',names:['Newborn Grooming Kit','Baby Nail Care Set','Soft Hair Brush & Comb','Bath Time Accessories','Baby Towel Set','Bath Care Starter Kit']}
  ];
  const existingIds = new Set(productsData.map(p=>p.id));
  groups.forEach((g,gi)=>g.names.forEach((name,i)=>{
    const id=`babyone-bath-sample-${gi+1}-${i+1}`;
    if(existingIds.has(id)) return;
    const price=[9.99,12.50,14.99,8.50,16.00,11.25][i];
    productsData.push({id,name:`${g.brand==='BabyOne Selection'?'':g.brand+' '}${name} — Sample`,brand:g.brand,category:'Bath & Skincare',subcategory:g.key,price,originalPrice:Number((price*1.2).toFixed(2)),rating:4.7,reviews:12+i,badge:'Sample • Edit in Admin',image:g.image,description:`Starter sample listing for ${name.toLowerCase()}. Replace the name, photos, price, description and stock details with the real product in the BabyOne Admin Dashboard.`});
    existingIds.add(id);
  }));
})();

/* ================= CETAPHIL BABY CARE CATALOG =================
   Source: user-provided Cetaphil catalog brief.
   Prices not supplied in that brief remain unset; set them in Admin before selling.
   The six previous generic Cetaphil samples remain in productsData but are archived
   from the customer-facing catalogue so no existing records are discarded.
*/
productsData.filter(p => String(p.id).startsWith('babyone-bath-sample-1-')).forEach(p => { p.catalogHidden = true; });
const babyoneCetaphilCatalog = [{"id":"babyone-cetaphil-001","name":"Cetaphil Baby Gentle Wash & Shampoo","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Bathing & Cleansing","price":499,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-c3b7e67b27b0aa0f.webp","galleryImages":["assets/photo-bf460fbc3619c14f.webp","assets/photo-7defcc3a4b4e04de.webp","assets/photo-93bbcc1c0463443a.webp","assets/photo-4e3fc31307875586.webp","assets/photo-037c86fe5709a2ad.webp"],"description":"Tear-free, head-to-toe 2-in-1 cleanser enriched with Organic Calendula, Glycerin, and Panthenol for sensitive scalp and skin.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"230 ml","price":499},{"size":"400 ml","price":799}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-002","name":"Cetaphil Baby Moisturising Bath & Wash","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Bathing & Cleansing","price":449,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-6e1dfa80f62e7845.webp","galleryImages":["assets/photo-1e1c24b8e9c0a034.webp","assets/photo-5348b5c2cd933fd9.webp","assets/photo-dacb84f3d917b9fb.webp","assets/photo-bd4dbe6809f3ae1c.webp"],"description":"Formulated with 1/3 moisturising lotion, Aloe Vera, and Almond Oil to cleanse gently without stripping natural skin moisture.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"230 ml","price":449},{"size":"400 ml","price":699}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-003","name":"Cetaphil Baby Daily Lotion","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":499,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-0de1cdf8967629d3.webp","galleryImages":["assets/photo-8a37d3208c9bcd0a.webp","assets/photo-273b23304dee82fd.webp","assets/photo-c51a37e2c9f52045.webp","assets/photo-00a2940ce0c3dd7b.webp"],"description":"Hypoallergenic daily moisturizer with Shea Butter, Sunflower Oil, and Vitamin E delivering 24-hour hydration.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"200 ml","price":499},{"size":"400 ml","price":799}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-004","name":"Cetaphil Baby Massage Oil","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":449,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-1d63ef265ecd4da8.webp","galleryImages":["assets/photo-df83724dc299c89f.webp","assets/photo-83c1a362f536c2d5.webp","assets/photo-669e9120703841c8.webp","assets/photo-fd0c87203f055df7.webp"],"description":"Lightweight blend of Organic Calendula and Shea Butter for daily baby massage and barrier support.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"200 ml","price":449},{"size":"300 ml","price":649}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-005","name":"Cetaphil Baby Soothing Moisturising Cream","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":449,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-e26ac978f6efa841.webp","galleryImages":["assets/photo-bbc0424049da42dc.webp","assets/photo-40b7ce63a4546bf6.webp","assets/photo-2b10249a71f9c3f8.webp","assets/photo-db238a074eacacaf.webp"],"description":"Targeted rich cream for extra dry or chapped baby skin areas.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"100 g","price":449},{"size":"200 g","price":749}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-006","name":"Cetaphil Baby Diaper Cream with Organic Calendula","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Diaper Care","price":349,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-e163e1891efcc5de.webp","galleryImages":["assets/photo-67f0b5055141b62d.webp","assets/photo-0a03fd379cc8801c.webp","assets/photo-4e79d0db2e8f871f.webp","assets/photo-b26c9192bb63d8dd.webp"],"description":"Forms a breathable, protective barrier using Zinc Oxide and Chamomile to soothe and prevent diaper rash.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"70 g","price":349},{"size":"100 g","price":499}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-007","name":"Cetaphil Baby Healing Ointment","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Diaper Care","price":399,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-74c94c0ea892ba54.webp","galleryImages":["assets/photo-2f3562cbbdba6ab3.webp","assets/photo-d3e5a09a5813c1e4.webp","assets/photo-69ba18459ed9cf56.webp","assets/photo-41db91b92f507647.webp"],"description":"Multi-purpose skin protectant formulated with Petrolatum and Shea Butter for severe diaper area dryness and redness.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"50 g","price":399},{"size":"100 g","price":649}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-008","name":"Cetaphil Sun SPF 50+ Light Gel","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Sun & Outdoor Protection","price":699,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-727a627c4456175f.webp","galleryImages":["assets/photo-071163fdef8b58d5.webp","assets/photo-9838e137ece34a71.webp","assets/photo-ed918af30caa84dd.webp"],"description":"Ultra-lightweight, high broad-spectrum UVA/UVB protection designed for outdoor exposure.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"50 ml","price":699},{"size":"100 ml","price":1099}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-cetaphil-009","name":"Cetaphil Sun Kids Liposomal Lotion SPF 50+","brand":"Cetaphil","category":"Bath & Skincare","subcategory":"Sun & Outdoor Protection","price":799,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cetaphil Baby Care","image":"assets/photo-82a79a7191d12454.webp","galleryImages":["assets/photo-0320eaca33ecd846.webp","assets/photo-19a3e4434e853993.webp","assets/photo-dcb5128c928f7da2.webp"],"description":"Very high protection broad-spectrum sun lotion formulated specifically for children and delicate skin.","catalogHidden":false,"variants":[{"size":"50 ml","price":799},{"size":"150 ml","price":1499}],"selectedVariant":0,"priceEstimate":true}];
babyoneCetaphilCatalog.forEach(p => { if (!productsData.some(x => x.id === p.id)) productsData.push(p); });

/* ================= SEBAMED BABY CARE CATALOG =================
   User-provided product image URLs. Prices and sizes are provisional examples;
   confirm real stock, sizes and selling prices before publishing.
*/
productsData.filter(p => String(p.id).startsWith('babyone-bath-sample-2-')).forEach(p => { p.catalogHidden = true; });
const babyoneSebamedCatalog = [{"id":"babyone-sebamed-001","name":"Sebamed Baby Cleansing Bar","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Bathing & Cleansing","price":199,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-67d7782569037b75.webp","galleryImages":["assets/photo-b3956ed729485c27.webp","assets/photo-67996a3b524d3f58.webp","assets/photo-53de83e778ff2e1a.webp","assets/photo-3c51658a71ae4b72.webp"],"description":"Gentle cleansing bar for delicate baby skin.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"100 g","price":199},{"size":"150 g","price":299}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-002","name":"Sebamed Baby Gentle Wash","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Bathing & Cleansing","price":499,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-e05fea1ffd63c491.webp","galleryImages":["assets/photo-77e0695717e9fc90.webp","assets/photo-c24cdd8cbeb57a75.webp","assets/photo-cb99c866d8943340.webp","assets/photo-95579bb952fac65d.webp"],"description":"Gentle daily wash for delicate baby skin.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"200 ml","price":499},{"size":"400 ml","price":799}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-003","name":"Sebamed Baby Shampoo","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Bathing & Cleansing","price":399,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-5c047d9bca8b46d4.webp","galleryImages":["assets/photo-e3ce739a75094e22.webp","assets/photo-b13a56895156d0f5.webp","assets/photo-8d4b4d7732363f25.webp","assets/photo-31730ec2b9690881.webp"],"description":"Gentle shampoo for delicate baby hair and scalp.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"150 ml","price":399},{"size":"250 ml","price":599}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-004","name":"Sebamed Baby Bubble Bath","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Bathing & Cleansing","price":499,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-41da6ef8baafd3c6.webp","galleryImages":["assets/photo-3a523426c2690ab7.webp","assets/photo-30480246bdf63fcc.webp","assets/photo-1096d39dfabfd656.webp","assets/photo-722ccea36cf1c8dd.webp"],"description":"Gentle bubble bath for baby bath time.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"200 ml","price":499},{"size":"500 ml","price":899}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-005","name":"Sebamed Baby Protective Facial Cream","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":499,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-31ea2ba074128f01.webp","galleryImages":["assets/photo-e5fa3c141a352335.webp","assets/photo-e2aace8d66559a89.webp","assets/photo-ce9605c5ce360fc3.webp","assets/photo-c53df6d82747424e.webp"],"description":"Protective facial cream for delicate baby skin.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"50 ml","price":499},{"size":"100 ml","price":799}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-006","name":"Sebamed Baby Body Lotion","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":499,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-0bb60580204b78ac.webp","galleryImages":["assets/photo-b4819a943901bad3.webp","assets/photo-713810c9b51f8a84.webp","assets/photo-dee61df5195f8063.webp","assets/photo-556b22c15753b86d.webp"],"description":"Everyday moisturising body lotion for baby skin.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"200 ml","price":499},{"size":"400 ml","price":849}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-007","name":"Sebamed Baby Massage Oil","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":449,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-9e91c9ffe360df20.webp","galleryImages":["assets/photo-d285ce5f060ef898.webp","assets/photo-525ee567fb4814f3.webp","assets/photo-68d3c012f2bc6551.webp","assets/photo-387c93fb556cfb14.webp"],"description":"Baby massage oil for daily skin care.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"150 ml","price":449},{"size":"200 ml","price":599}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-008","name":"Sebamed Baby Cream","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Daily Skin Care","price":399,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-f35c460634584496.webp","galleryImages":["assets/photo-7c597dcce8e34603.webp","assets/photo-16154b6f00420f1b.webp","assets/photo-d55307483c23ab01.webp","assets/photo-2262abc04dc5cc2e.webp"],"description":"Moisturising cream for delicate baby skin.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"50 ml","price":399},{"size":"100 ml","price":649}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-009","name":"Sebamed Baby Powder","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Diaper Care","price":299,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-e31c2e46395fb879.webp","galleryImages":["assets/photo-c060f109c9668b6b.webp","assets/photo-38224cc2ce357c91.webp","assets/photo-2113c402e699d498.webp","assets/photo-4d08dd2d1e2d75a6.webp"],"description":"Baby powder for everyday skin care.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"100 g","price":299},{"size":"200 g","price":449}],"selectedVariant":0,"priceEstimate":true},{"id":"babyone-sebamed-010","name":"Sebamed Baby Sun Lotion","brand":"Sebamed","category":"Bath & Skincare","subcategory":"Sun & Outdoor Protection","price":699,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Sebamed Baby Care","image":"assets/photo-9022c22b07d08bf0.webp","galleryImages":["assets/photo-25b2c648d6fad3e9.webp","assets/photo-7efda45ce9d32832.webp","assets/photo-5a21f02926c035b7.webp","assets/photo-8539821b6c2d0eb7.webp"],"description":"Sun lotion for outdoor baby care; check product label for recommended age and SPF.","catalogHidden":false,"imageSource":"User supplied","variants":[{"size":"100 ml","price":699},{"size":"200 ml","price":1099}],"selectedVariant":0,"priceEstimate":true}];
babyoneSebamedCatalog.forEach(p => { if (!productsData.some(x => x.id === p.id)) productsData.push(p); });

const adBannerData1 = [
  { title:'Turbo Fun Ride-Ons', subtitle:'Safe, electric & remote-controlled', cta:'Explore Ride-Ons', category:'Travel & Gear', bg:'assets/photo-b00701b131d8c0a4.webp' },
  { title:'Mom Care Essentials', subtitle:'Luxury postpartum & comfort gear', cta:'Shop Mom Care', category:'Mom Care', bg:'assets/photo-efad07a3afa7298b.webp' },
  { title:'Newborn Nest Collection', subtitle:'100% organic cotton swaddles', cta:'Shop Newborn', category:'New Born', bg:'assets/photo-9fdd69d0f677103a.webp' }
];
const adBannerData2 = [
  { title:'Summer Baby Fashion', subtitle:'Softest organic cotton playsuits', cta:'Explore Clothing', category:'Clothing', bg:'assets/photo-38f49c4a6bc032ea.webp' },
  { title:'Smart Anti-Colic Feeding', subtitle:'BPA-free glass & silicone bottles', cta:'Explore Feeding', category:'Feeding', bg:'assets/photo-183b0e455b8e4fe0.webp' },
  { title:'Compact Travel Strollers', subtitle:'One-hand folding cabin strollers', cta:'Explore Travel', category:'Travel & Gear', bg:'assets/photo-9c86c21d92a501fd.webp' }
];

/* ================= HERO — parent & baby love moments ================= */
const heroSlidesData = [
  { kicker:'The BabyOne Collection', title:'Little journeys. Big love.', sub:'Thoughtfully chosen essentials for the little ones who hold your whole heart.', img:'assets/photo-b7ffbfeb5bd1a7a7.webp' },
  { kicker:'Comfort, Close to You', title:'Carry them close. Go anywhere.', sub:'Everyday comfort for little passengers and the people who love them.', img:'assets/photo-fb82a54b6bf76f36.webp' },
  { kicker:'Comfort for Feeding', title:'A little more comfort, every feed.', sub:'Thoughtful nursing support for quieter, closer moments together.', img:'assets/photo-0a9732be3078be31.webp', sourceLink:'https://www.flipkart.com/mom-son-breast-feeding-pillow-breastfeeding/p/itm2a4b6ce474772' },
  { kicker:'Sleep & Snuggle', title:'A softer place for little dreams.', sub:'Foldable, cozy newborn essentials made for rest at home or away.', img:'https://images.unsplash.com/photo-1555252335-9f8e9a6b0c9f?auto=format&fit=crop&w=1000&q=85', sourceLink:'https://www.amazon.in/StarAndDaisy-Sleeping-Comfortable-Foldable-Washable/dp/B0FVSHMJHX' },
  { kicker:'Everyday Baby Care', title:'Care in every little moment.', sub:'Gentle essentials to keep babies comfortable through busy little days.', img:'https://www.mamypoko.co.in/_next/image?q=75&url=%2Fimg%2Fnew-born.webp&w=1080', sourceLink:'https://www.facebook.com/mamypokopantsindia/posts/its-the-small-moments-that-show-what-care-really-means-and-were-here-to-keep-tho/1379744290863956/' }
];

/* Reels — each linked to a real product */
const reelsData = [
  { id:'nl9W-C4bedo', author:'@mommy_jess', title:'A closer look at the CloudComfort Stroller', productId:'p1' },
  { id:'HznyNa5KQd0', author:'@sarah_and_baby', title:'Our gentle morning bath routine', productId:'p7' },
  { id:'4LI-KoJIIZQ', author:'@daddy_diapers', title:'Setting up the SnoozeGlide cradle at home', productId:'p6' },
  { id:'zHHnCC5p_dM', author:'@early_learning_fun', title:'Montessori sensory play in real life', productId:'p5' }
];
const reelIds = reelsData.map(r => r.id);
window.boCloudMergeReels = function(rows){
 if(!Array.isArray(rows))return;
 const published=new Map(rows.filter(r=>r?.cloudId&&r.videoUrl).map(r=>[String(r.cloudId),r]));
 let changed=false;
 for(let i=reelsData.length-1;i>=0;i--){
  const r=reelsData[i];if(r.cloudId&&!published.has(String(r.cloudId))){reelsData.splice(i,1);changed=true;continue}
  if(r.cloudId&&published.has(String(r.cloudId))){const latest=published.get(String(r.cloudId));
   if(JSON.stringify({...r,id:''})!==JSON.stringify({...latest,id:''})){Object.assign(r,latest,{id:'',cloudId:String(latest.cloudId)});changed=true}
  }
 }
 const present=new Set(reelsData.filter(r=>r.cloudId).map(r=>String(r.cloudId)));
 for(const [id,r] of published)if(!present.has(id)){reelsData.push({...r,id:'',cloudId:id});changed=true}
 if(changed){
  try{if(localStorage.getItem('babyone-owner-reels-v1')!==null)localStorage.setItem('babyone-owner-reels-v1',JSON.stringify(reelsData));}catch(e){}
  try{renderReels();window.boRefreshRails?.()}catch(_e){}
 }
};
try{const saved=window.BO_USE_MYSQL?null:JSON.parse(localStorage.getItem('babyone-owner-reels-v1')||'null');if(Array.isArray(saved))reelsData.splice(0,reelsData.length,...saved)}catch(e){}
/* BabyOne video storage v3 — OPFS with ArrayBuffer IndexedDB fallback.
   Do not put Android content:// File/Blob objects directly into IDB (InvalidBlob).
   Never silently claim local storage publishes videos to all customers. */
function boVideoDB(){return new Promise((resolve,reject)=>{
 if(!('indexedDB' in window))return reject(new Error('This browser blocks device video storage. Open your published HTTPS website in Chrome or Safari.'));
 let req;try{req=indexedDB.open('babyone-video-files',2)}catch(e){return reject(new Error('Cannot access device storage: '+(e.message||e.name)))}
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('videos'))db.createObjectStore('videos');if(!db.objectStoreNames.contains('chunks'))db.createObjectStore('chunks')};
 req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db)};
 req.onerror=()=>reject(req.error||new Error('Browser storage unavailable'));
 req.onblocked=()=>reject(new Error('Close other BabyOne tabs before saving a video'));
})}
function boVideoTx(db,mode,store,key,val){return new Promise((resolve,reject)=>{
 let tx,req,value;try{tx=db.transaction(store,mode);req=mode==='readonly'?tx.objectStore(store).get(key):(val===undefined?tx.objectStore(store).delete(key):tx.objectStore(store).put(val,key));}catch(e){reject(e);return}
 req.onsuccess=()=>{value=req.result};tx.oncomplete=()=>resolve(value);
 tx.onerror=()=>reject(tx.error||new Error('Video storage transaction failed'));
 tx.onabort=()=>reject(tx.error||new Error('Video storage transaction stopped'));
})}
const boVideoChunkSize=1024*1024*2;
async function boVideoSave(key,file,onProgress){
 if(!file||!file.size)throw new Error('The selected video file is empty or unreadable. Please choose another file.');
 const progress=typeof onProgress==='function'?onProgress:()=>{};
 // Prefer streaming to origin-private file storage: no browser-blob serialization and low memory usage.
 if(navigator.storage?.getDirectory){
  try{
   const dir=await navigator.storage.getDirectory();const h=await dir.getFileHandle('babyone_'+key+'.video',{create:true});const writer=await h.createWritable();
   try{
    let copied=0;
    if(file.stream){const reader=file.stream().getReader();for(;;){const {done,value}=await reader.read();if(done)break;await writer.write(value);copied+=value.byteLength;progress(copied,file.size)}}
    else{for(let at=0;at<file.size;at+=boVideoChunkSize){const part=await file.slice(at,at+boVideoChunkSize).arrayBuffer();await writer.write(part);progress(Math.min(file.size,at+part.byteLength),file.size)}}
    await writer.close();const verified=await h.getFile();if(verified.size!==file.size)throw new Error('Stored file size mismatch');
    return 'device';
   }catch(err){try{await writer.abort()}catch(_){};try{await dir.removeEntry('babyone_'+key+'.video')}catch(_){};throw err}
  }catch(error){if(error?.name==='QuotaExceededError')throw new Error('Not enough device storage for this video. Upload to Firebase Storage or free device space.');}
 }
 // Fallback: read bytes into 2 MB ArrayBuffers; raw File/Blob IDB writes caused InvalidBlob on Android.
 const db=await boVideoDB();let count=0;
 try{
  for(let at=0;at<file.size;at+=boVideoChunkSize){
   const bytes=await file.slice(at,Math.min(file.size,at+boVideoChunkSize)).arrayBuffer();
   if(!bytes.byteLength)throw new Error('The phone could not read the chosen video. Try a local MP4 file.');
   await boVideoTx(db,'readwrite','chunks',key+'::'+count,bytes);count++;
   progress(Math.min(file.size,at+bytes.byteLength),file.size);
  }
  await boVideoTx(db,'readwrite','videos',key,{storage:'arraybuffer-v3',chunks:count,size:file.size,type:file.type||'video/mp4',name:file.name||'video.mp4'});
  return 'device';
 }catch(error){
  for(let i=0;i<count;i++)try{await boVideoTx(db,'readwrite','chunks',key+'::'+i)}catch(_){};
  if(error?.name==='QuotaExceededError')throw new Error('Device browser storage is full. Connect Firebase for large video uploads, or free space.');
  throw new Error('Could not save video bytes: '+(error?.message||error?.name||'Unknown error'));
 }finally{db.close()}
}
async function boVideoLoad(key){
 if(navigator.storage?.getDirectory){
  try{const dir=await navigator.storage.getDirectory();const h=await dir.getFileHandle('babyone_'+key+'.video');const file=await h.getFile();if(file.size>0)return file}catch(_){}
 }
 const db=await boVideoDB();
 try{
  const info=await boVideoTx(db,'readonly','videos',key);
  if(!info)return null;
  if(info.storage!=='arraybuffer-v3')return info; // Old user videos remain accessible.
  const chunks=[];
  for(let i=0;i<info.chunks;i++){const bytes=await boVideoTx(db,'readonly','chunks',key+'::'+i);if(!bytes)throw new Error('Saved video is incomplete. Upload the original file again.');chunks.push(bytes)}
  const blob=new Blob(chunks,{type:info.type||'video/mp4'});
  if(blob.size!==info.size)throw new Error('Saved video size mismatch');
  return blob;
 }finally{db.close()}
}
async function boVideoDelete(key){
 if(navigator.storage?.getDirectory){try{const dir=await navigator.storage.getDirectory();await dir.removeEntry('babyone_'+key+'.video')}catch(_){}}
 const db=await boVideoDB();try{
  const old=await boVideoTx(db,'readonly','videos',key);
  if(old?.storage==='arraybuffer-v3')for(let i=0;i<old.chunks;i++)await boVideoTx(db,'readwrite','chunks',key+'::'+i);
  await boVideoTx(db,'readwrite','videos',key);
 }finally{db.close()}
}
async function boActivateVideo(el,key){
 try{
  const blob=await boVideoLoad(key);if(!blob){throw new Error('The saved video file is missing from this device')}
  const url=URL.createObjectURL(blob);
  el.replaceChildren();const v=document.createElement('video');v.controls=true;v.autoplay=true;v.playsInline=true;v.preload='metadata';v.style.cssText='width:100%;height:100%;object-fit:contain;';v.src=url;el.appendChild(v);
  v.addEventListener('error',()=>{v.insertAdjacentText('afterend','This video format may not be supported on your phone. Try an MP4 (H.264).')},{once:true});
  v.addEventListener('ended',()=>{el.dataset.playing='0';},{once:true});
  // Keep the blob URL alive for the full playback, including iOS metadata loading.
  // Revoke it when the DOM video element is removed or replaced.
  const removalObserver=new MutationObserver(()=>{if(!v.isConnected){URL.revokeObjectURL(url);removalObserver.disconnect();}});
  removalObserver.observe(el,{childList:true});
  v.play().catch(()=>{});
 }catch(e){el.dataset.playing='0';el.textContent='Video unavailable on this device. '+(e.message||'Please check video storage.');el.style.cssText='color:#fff;display:grid;place-items:center;text-align:center;padding:20px'}
}
/* Small cover images are optional; if a phone cannot decode a video locally, upload still works. */
function boVideoCover(file){return new Promise(resolve=>{
 let video,objectUrl,timer,finished=false;
 function done(value){if(finished)return;finished=true;clearTimeout(timer);if(video){video.pause();video.removeAttribute('src');video.load()}if(objectUrl)URL.revokeObjectURL(objectUrl);resolve(value||'')}
 try{
  video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='metadata';objectUrl=URL.createObjectURL(file);
  video.onloadeddata=()=>{try{const c=document.createElement('canvas');c.width=200;c.height=350;const ctx=c.getContext('2d');if(!ctx)return done('');ctx.fillStyle='#26384a';ctx.fillRect(0,0,200,350);const scale=Math.max(200/video.videoWidth,350/video.videoHeight);const w=video.videoWidth*scale,h=video.videoHeight*scale;ctx.drawImage(video,(200-w)/2,(350-h)/2,w,h);done(c.toDataURL('image/jpeg',0.58))}catch(e){done('')}};
  video.onerror=()=>done('');timer=setTimeout(()=>done(''),3500);video.src=objectUrl;video.load();
 }catch(e){done('')}
})}


/* ================= STATE ================= */
let cart = [];
let wishlist = [];
let activeAd1 = 0, activeAd2 = 0;
let activeHero = 0;
let heroTimer = null, ad1Timer = null, ad2Timer = null;
let selectedCategory = 'All';
let selectedSub = 'All';

/* ================= HERO ================= */
function boHeroOpenProduct(id){
  const p=(typeof productsData!=='undefined'?productsData:[]).find(x=>String(x.id)===String(id));
  if(!p){showToast('Linked product is not available');return;}
  if(typeof openProductModal==='function')openProductModal(p.id);
}
function renderHero(){
  const slidesEl=document.getElementById('hero-slides'),dotsEl=document.getElementById('hero-dots');
  if(!slidesEl||!dotsEl)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  slidesEl.innerHTML=heroSlidesData.map((s,i)=>{
    const isVideo=s.mediaType==='video' && !!(s.videoUrl||s.videoMobileUrl);
    const videoUrl=window.matchMedia('(max-width:640px)').matches?(s.videoMobileUrl||s.videoUrl):(s.videoUrl||s.videoMobileUrl);
    const poster=s.img||'';
    const media=isVideo?`<video class="bo-hero-video" data-hero-video="${i}" muted playsinline preload="metadata" poster="${esc(poster)}" src="${esc(videoUrl)}" aria-label="${esc(s.title||'BabyOne promotional video')}"></video>`:'';
    const style=(!isVideo&&poster)?` style="background-image:url(&quot;${esc(poster)}&quot;)"`:'';
    return `<div ${i?'inert':''} class="hero-slide ${i===0?'active':''} ${isVideo?'bo-hero-is-video':''}"${style}>${media}</div>`;
  }).join('');
  dotsEl.replaceChildren();
  activeHero=0;startHeroTimer();
}
function goHero(i){
  const slides=[...document.querySelectorAll('#hero-slides .hero-slide')],dots=document.querySelectorAll('#hero-dots .hero-dot');
  if(!slides.length)return;
  slides.forEach(s=>{const v=s.querySelector('video');if(v){v.pause();v.onended=null;}});
  activeHero=(i+slides.length)%slides.length;
  slides.forEach((s,index)=>{s.classList.toggle('active',index===activeHero);s.inert=index!==activeHero;});
  dots.forEach((d,index)=>d.classList.toggle('active',index===activeHero));
  startHeroTimer();
}
function startHeroTimer(){
  clearTimeout(heroTimer);
  if(window.boHeroPaused || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const active=document.querySelectorAll('#hero-slides .hero-slide')[activeHero];
  if(!active)return;
  const v=active.querySelector('video');
  if(!v){heroTimer=setTimeout(()=>goHero(activeHero+1),5000);return;}
  const advance=()=>{if(active.classList.contains('active'))goHero(activeHero+1)};
  v.onended=advance;
  try{v.currentTime=0}catch(_){}
  const schedule=()=>{clearTimeout(heroTimer);const ms=(Number.isFinite(v.duration)&&v.duration>0)?Math.min(60000,Math.max(4000,Math.ceil(v.duration*1000)+650)):14000;heroTimer=setTimeout(advance,ms)};
  v.onloadedmetadata=schedule;schedule();
  const maybe=v.play();if(maybe&&typeof maybe.catch==='function')maybe.catch(()=>{clearTimeout(heroTimer);heroTimer=setTimeout(advance,9000)});
}
window.addEventListener('resize',()=>{
 const mobile=window.matchMedia('(max-width:640px)').matches;
 if(window._boHeroWasMobile===undefined){window._boHeroWasMobile=mobile;return;}
 if(window._boHeroWasMobile!==mobile){window._boHeroWasMobile=mobile;renderHero()}
});

/* ================= CATEGORIES ================= */
function renderCategories(){
  const container=document.getElementById('cat-container');if(!container)return;
  container.innerHTML=categoriesData.map(c=>`<button class="cat-tile" aria-label="Shop ${escapeHtml(c.name)}"><img src="${escapeHtml(c.img)}" alt="${escapeHtml(c.name)}" loading="lazy"><span>${escapeHtml(c.name)}</span></button>`).join('');
  container.querySelectorAll('button').forEach((button,i)=>button.onclick=()=>filterByCategory(categoriesData[i].name));
}

/* ================= PROMOS ================= */
function renderPromos(){
  document.getElementById('promo-slides-1').innerHTML = adBannerData1.map((b,i)=>`
    <div class="promo-slide ${i===activeAd1?'active':''}">
      <img src="${b.bg}" alt="${b.title}" loading="lazy" />
    </div>`).join('');
  document.getElementById('promo-dots-1').replaceChildren();

  document.getElementById('promo-slides-2').innerHTML = adBannerData2.map((b,i)=>`
    <div class="promo-slide ${i===activeAd2?'active':''}">
      <img src="${b.bg}" alt="${b.title}" loading="lazy" />
    </div>`).join('');
  document.getElementById('promo-dots-2').replaceChildren();

  clearInterval(ad1Timer); clearInterval(ad2Timer);
  ad1Timer = setInterval(()=>nextAdSlide(1), 5500);
  ad2Timer = setInterval(()=>nextAdSlide(2), 6500);
}
function nextAdSlide(n){ if(n===1){ activeAd1=(activeAd1+1)%adBannerData1.length; } else { activeAd2=(activeAd2+1)%adBannerData2.length; } renderPromos(); }
function prevAdSlide(n){ if(n===1){ activeAd1=(activeAd1-1+adBannerData1.length)%adBannerData1.length; } else { activeAd2=(activeAd2-1+adBannerData2.length)%adBannerData2.length; } renderPromos(); }
function goAd(n,i){ if(n===1) activeAd1=i; else activeAd2=i; renderPromos(); }

/* ================= PRODUCT CARD ================= */
function babyonePriceLabel(p){
  if(p.price===null || p.price===undefined || p.price==='') return 'Price to be updated';
  if(p.currency==='INR') return '₹'+Number(p.price).toLocaleString('en-IN',{maximumFractionDigits:2});
  return '₹'+Math.round(Number(p.price||0)*83.5).toLocaleString('en-IN');
}
function babyoneModalPriceLabel(p){
  if(p.price===null || p.price===undefined || p.price==='') return 'Price to be updated';
  return p.currency==='INR' ? '₹'+Number(p.price).toLocaleString('en-IN',{maximumFractionDigits:2}) : '$'+Number(p.price).toFixed(2);
}
function babyoneProductGallery(p){
  // Only show photographs belonging to this exact product.
  return [...new Set([p.image,...(p.galleryImages||[]),...(p.images||[])].filter(Boolean))];
}
function babyoneGallerySlots(p){
  const images=babyoneProductGallery(p);
  if(p.category==='Diapering')return images;
  // Temporary demo gallery images are clearly identified and can be replaced in admin.
  return Array.from({length:6},(_,i)=>images[i] || (p.brand==='Cetaphil' ? p.image : `https://picsum.photos/seed/babyone-${encodeURIComponent(p.id)}-${i}/800/1000`));
}
function babyoneIsDemoGallerySlot(p,index){return p.category!=='Diapering' && index>=babyoneProductGallery(p).length;}
function babyoneSelectGallerySlot(id,index){
  const buttons=document.querySelectorAll('#product-detail-thumbs-'+CSS.escape(id)+' button');
  const button=buttons[index];
  if(!button || button.disabled)return;
  const img=button.querySelector('img');
  const main=document.getElementById('main-product-image-'+id);
  if(!img||!main)return;
  main.src=img.src;
  buttons.forEach((b,j)=>b.classList.toggle('active',j===index));
}

function babyoneCardSizeLabel(p){
  const text=((p.name||'')+' '+(p.subcategory||'')+' '+(p.description||'')).toLowerCase();
  if(/wash|shampoo|lotion|oil|cream|gel|sun|cleanser|ointment|liquid|bottle/.test(text)){
    const match=(p.name||'').match(/\b(\d{2,4})\s?(ml|l)\b/i);
    return match ? `Size: ${match[1]} ${match[2].toLowerCase()}` : 'Size options · View details';
  }
  if(/diaper|wipe|tissue|pack/.test(text)) return 'Pack sizes · View details';
  if(/clothing|romper|bodysuit|wear|sleepwear/.test(text)) return 'Size options · View details';
  return 'Sizes & details inside';
}
const babyoneStandardDiaperSizes=[
  {key:'Newborn',weight:'Up to 5 kg'},
  {key:'XS',weight:'3 – 6 kg'},
  {key:'S',weight:'4 – 8 kg'},
  {key:'M',weight:'6 – 11 kg'},
  {key:'L',weight:'9 – 14 kg'},
  {key:'XL',weight:'12 – 17 kg'},
  {key:'XXL',weight:'15 – 25 kg'}
];
function babyoneDiaperSizeIndex(label){
  const t=String(label||'').toLowerCase();
  const pick=k=>babyoneStandardDiaperSizes.findIndex(s=>s.key===k);
  if(/new ?born/.test(t)) return pick('Newborn');
  if(/extra ?small|\bxs\b/.test(t)) return pick('XS');
  if(/\bxxl\b/.test(t)) return pick('XXL');
  if(/\bxl\b/.test(t)) return pick('XL');
  if(/small|\bsm\b/.test(t)) return pick('S');
  if(/medium|\bmd\b/.test(t)) return pick('M');
  if(/large|\blg\b/.test(t)) return pick('L');
  return -1;
}
function babyoneExpandDiaperSizes(p){
  if(p.diaperSizesExpanded||!Array.isArray(p.variants)||p.variants.length!==1)return;
  const basePrice=p.variants[0].price!=null?p.variants[0].price:p.price;
  const matched=babyoneDiaperSizeIndex(p.variants[0].size+' '+(p.name||''));
  p.variants=babyoneStandardDiaperSizes.map(s=>({size:`${s.key} (${s.weight})`,price:basePrice}));
  p.selectedVariant=matched>=0?matched:0;
  p.diaperSizesExpanded=true;
}
function babyoneDiaperSizeMarkup(p){
  babyoneExpandDiaperSizes(p);
  return `<div class="babyone-size-options"><strong>Choose size</strong><div>${p.variants.map((v,i)=>`<button type="button" class="bo-variant-choice ${(p.selectedVariant||0)===i?'selected':''}" onclick="babyoneChooseVariant('${p.id}',${i})">${escapeHtml(v.size)}</button>`).join('')}</div><small>Size guide — pick the size that matches your baby's weight.</small></div>`;
}
function babyoneSizeOptionsMarkup(p){
  if(p.category==='Diapering'&&p.subcategory==='Diapers') return babyoneDiaperSizeMarkup(p);
  if(Array.isArray(p.variants)&&p.variants.length){
    return `<div class="babyone-size-options"><strong>${p.category==='Diapering'?'Choose size / pack':(p.variants.some(v=>/\bml\b|millilit/i.test(String(v.size||'')))?'Choose volume (ML)':(p.variants.some(v=>/^(red|blue|pink|green|black|white|yellow|purple|grey|gray|beige|brown|orange|navy|cream)$/i.test(String(v.size||'')))?'Choose colour':'Choose size / option'))}</strong><div>${p.variants.map((v,i)=>`<button type="button" class="bo-variant-choice ${(p.selectedVariant||0)===i?'selected':''}" onclick="babyoneChooseVariant('${p.id}',${i})">${escapeHtml(v.size)}</button>`).join('')}</div></div>`;
  }
  return ''; // No size, ml or colour variants configured for this item.
}
function babyoneChooseVariant(id,index){
  const p=productsData.find(x=>x.id===id), v=p?.variants?.[index];
  if(!v)return;
  p.selectedVariant=index;
  p.price=v.price==null?null:Number(v.price);
  p.originalPrice=v.originalPrice==null?null:Number(v.originalPrice);
  openProductModal(id);
}

function productCard(p){
  if(p.catalogHidden) return '';
  const inWish = wishlist.includes(p.id);
  return `
    <article class="product babyone-pro-card" role="button" tabindex="0" aria-label="View ${escapeHtml(p.name)} details" onclick="openProductModal('${p.id}')" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openProductModal('${p.id}')}" >
      <div class="product-media">
        <span class="product-badge">${escapeHtml(p.badge||'BabyOne Essential')}</span>
        <button class="wish-btn ${inWish?'active':''}" onclick="event.stopPropagation(); toggleWishlist('${p.id}')" aria-label="Save to wishlist">
          <i class="${inWish?'fa-solid':'fa-regular'} fa-heart"></i>
        </button>
        <button type="button" class="bo-product-share" data-product-id="${escapeHtml(String(p.id))}" onclick="event.stopPropagation();BOproductShare.share(this.dataset.productId)" aria-label="Share ${escapeHtml(p.name)}"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.closest('.product')?.classList.add('image-fallback')" />
        <span class="babyone-card-view">View product <i class="fa-solid fa-arrow-right"></i></span>
      </div>
      <div class="product-info">
        ${Number(p.rating)>0?`<div class="product-rating"><i class="fa-solid fa-star"></i> ${p.rating} <span>(${p.reviews||0})</span></div>`:''}
        <h4 class="product-name">${escapeHtml(p.name)}</h4>
        <span class="babyone-card-size">${babyoneCardSizeLabel(p)}</span>
        <div class="product-foot">
          <div>
            <span class="price">${babyonePriceLabel(p)}</span>
            ${p.originalPrice?`<span class="price-old">${p.currency==='INR'?'₹'+Number(p.originalPrice).toLocaleString('en-IN'):'₹'+Math.round(Number(p.originalPrice)*83.5).toLocaleString('en-IN')}</span>`:''}
          </div>
          <span class="babyone-card-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>
        </div>
      </div>
    </article>`;
}
function babyoneTopSellers(){
  let orders=[];try{orders=JSON.parse(localStorage.getItem('babyone-orders-v1')||'[]')}catch(e){}
  const counts=new Map();
  orders.filter(o=>!['Cancelled','Canceled','Refunded'].includes(o.status)).forEach(o=>(o.items||[]).forEach(it=>{
    const p=productsData.find(p=>String(p.id)===String(it.id||it.productId));
    if(p)counts.set(String(p.id),(counts.get(String(p.id))||0)+Math.max(0,Number(it.qty||it.quantity||1)));
  }));
  return productsData.filter(p=>!p.catalogHidden).sort((a,b)=>(counts.get(String(b.id))||0)-(counts.get(String(a.id))||0)).slice(0,10);
}
function renderProductRails(){
  document.getElementById('best-sellers').innerHTML = babyoneTopSellers().map(productCard).join('');
  document.getElementById('trending').innerHTML = productsData.filter(p=>!p.catalogHidden).slice().reverse().slice(0,10).map(productCard).join('');
  const travel = productsData.filter(p=>p.category==='Travel & Gear');
  document.getElementById('ride-mode').innerHTML = travel.filter(p=>!p.catalogHidden).slice(0,10).map(productCard).join('');
}

/* ================= LITTLE JOYS — playable ================= */
function renderReels(){
  const track = document.getElementById('reels-track');
  track.innerHTML = reelsData.map((reel, i) => {
    const product = productsData.find(p => String(p.id) === String(reel.productId));
    return `
      <article class="reel-card" data-reel-index="${i}">
        <div class="reel-video" id="reel-video-${i}" onclick="playInlineReel(${i}, event)">
          <span class="reel-tag">Play Reel</span>
          <img src="${escapeHtml(reel.cover|| ((reel.localKey||reel.videoUrl)?'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22500%22%3E%3Crect width=%22300%22 height=%22500%22 fill=%22%2326384a%22/%3E%3Ctext x=%22150%22 y=%22250%22 fill=%22white%22 text-anchor=%22middle%22%3EPLAY VIDEO%3C/text%3E%3C/svg%3E':'https://i.ytimg.com/vi/'+reel.id+'/maxresdefault.jpg'))}"
               onerror="this.onerror=null;this.src='${(reel.localKey||reel.videoUrl)?'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22500%22%3E%3Crect width=%22300%22 height=%22500%22 fill=%22%2326384a%22/%3E%3C/svg%3E':'https://i.ytimg.com/vi/'+reel.id+'/hqdefault.jpg'}'"
               alt="${escapeHtml(reel.title)}"
               style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:1;" loading="lazy" />
          <span class="reel-overlay"></span>
          <span class="reel-play"><i class="fa-solid fa-play"></i></span>
        </div>
        <div class="reel-caption">
          <div class="reel-author">${escapeHtml(reel.author)}</div>
          <h4 class="reel-title">${escapeHtml(reel.title)}</h4>
          ${product ? `
            <div class="reel-shop" onclick="event.stopPropagation(); openProductModal('${product.id}')">
              <div style="min-width:0;">
                <div class="reel-shop-name">${escapeHtml(product.name)}</div>
                <div class="reel-shop-price">${babyonePriceLabel(product)}</div>
              </div>
              <i class="fa-solid fa-arrow-right"></i>
            </div>` : ''}
        </div>
      </article>`;
  }).join('');
}

function playInlineReel(index, event){
  if(event) event.stopPropagation();
  const reel = reelsData[index];
  if(!reel) return;
  const videoBox = (event && event.currentTarget && (event.currentTarget.classList?.contains('reel-video') ? event.currentTarget : event.currentTarget.closest?.('.reel-video'))) || document.getElementById('reel-video-' + index);
  if(!videoBox) return;
  if(videoBox.dataset.playing === '1') return;
  videoBox.dataset.playing = '1';
  if(reel.localKey){boActivateVideo(videoBox,reel.localKey);return;}
  if(reel.videoUrl){
    videoBox.replaceChildren();const v=document.createElement('video');v.controls=true;v.autoplay=true;v.playsInline=true;v.preload='metadata';
    v.style.cssText='width:100%;height:100%;object-fit:contain;background:#111;border-radius:inherit;position:absolute;inset:0;z-index:4';
    v.src=reel.videoUrl;videoBox.appendChild(v);v.play().catch(()=>{});
    v.addEventListener('ended',()=>{videoBox.dataset.playing='0'},{once:true});return;
  }
  videoBox.innerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${reel.id}?autoplay=1&mute=0&controls=1&playsinline=1&rel=0&modestbranding=1"
      title="${escapeHtml(reel.title)}"
      allow="autoplay; encrypted-media; picture-in-picture; web-share"
      allowfullscreen
      style="position:absolute;inset:0;width:100%;height:100%;border:0;z-index:4;border-radius:inherit;"></iframe>
    <button onclick="stopInlineReel(${index}, event)" aria-label="Close video"
      style="position:absolute;top:10px;right:10px;z-index:5;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.55);color:#fff;font-size:14px;display:grid;place-items:center;cursor:pointer;">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
}
function stopInlineReel(index, event){
  if(event) event.stopPropagation();
  const reel = reelsData[index];
  const videoBox = (event && event.currentTarget && (event.currentTarget.classList?.contains('reel-video') ? event.currentTarget : event.currentTarget.closest?.('.reel-video'))) || document.getElementById('reel-video-' + index);
  if(!videoBox || !reel) return;
  delete videoBox.dataset.playing;
  videoBox.innerHTML = `
    <span class="reel-tag">Play Reel</span>
    <img src="https://i.ytimg.com/vi/${reel.id}/maxresdefault.jpg"
         onerror="this.src='https://i.ytimg.com/vi/${reel.id}/hqdefault.jpg'"
         alt="${escapeHtml(reel.title)}"
         style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:1;" loading="lazy" />
    <span class="reel-overlay"></span>
    <span class="reel-play"><i class="fa-solid fa-play"></i></span>`;
}

/* ================= REVIEWS ================= */
function renderReviews(){
  const all=window.BOpublishedReviews||[];
  const track=document.getElementById('reviews-track');if(!track)return;
  track.innerHTML=all.map(r=>`<article class="review-card"><div class="review-stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p class="review-text">“${escapeHtml(r.message)}”</p><div class="review-name">— ${escapeHtml(r.name)}</div></article>`).join('')||'<p class="bo-review-empty">Parent stories will appear here as they are shared.</p>';
}

/* ================= NAV ================= */
function showSection(id){
  document.getElementById('home-page').classList.toggle('hidden', id!=='home-page');
  document.getElementById('explorer-page').classList.toggle('hidden', id!=='explorer-page');
  document.getElementById('reviews-section').classList.toggle('hidden', id!=='home-page' && id!=='reviews-section');
  window.scrollTo({ top:0, behavior:'smooth' });
  if(id==='explorer-page' && typeof restartCategoryHero==='function') restartCategoryHero();
}

/* ================= CATEGORY HERO SLIDER ================= */
const categoryHeroSlides = [
 {category:'New Born',title:'A beautiful beginning.',subtitle:'Soft newborn essentials for life’s earliest and sweetest days.',img:'https://images.unsplash.com/photo-1555252335-9f8e9a6b0c9f?auto=format&fit=crop&w=1800&q=90'},
 {category:'Feeding',title:'Made for every little feed.',subtitle:'Comfortable feeding essentials for bonding moments, day after day.',img:'https://cdn1.healthians.com/blog/wp-content/uploads/2021/08/breastfeeding-mother-baby-1-1200x500.jpg'},
 {category:'Diapering',title:'Gentle care, all day long.',subtitle:'Everyday changing essentials designed around little comforts.',img:'https://www.mamypoko.co.in/_next/image?q=75&url=%2Fimg%2Fnew-born.webp&w=1080'},
 {category:'Clothing',title:'Softness for every stage.',subtitle:'Easy, breathable pieces for little movers and dreamers.',img:'assets/photo-0b02ae5543c03240.webp'},
 {category:'Toys & Learning',title:'Little hands, big discoveries.',subtitle:'Playful pieces to encourage curiosity and early learning.',img:'assets/photo-95c48577a361da91.webp'},
 {category:'Hospital Kit',title:'A calm corner to grow.',subtitle:'Thoughtfully chosen pieces for your baby’s first little world.',img:'assets/photo-dd89eea845f83f44.webp'},
 {category:'Cradles & Rockers',title:'Comfort for quieter moments.',subtitle:'Gentle soothing essentials for rest and reassurance.',img:'https://images.unsplash.com/photo-1544923246-77307dd658cb?auto=format&fit=crop&w=1800&q=90'},
 {category:'Bath & Skincare',title:'A softer kind of care.',subtitle:'Bath-time and skincare essentials for delicate little ones.',img:'assets/photo-b27aacefc6eb2cbd.webp'},
 {category:'Travel & Gear',title:'Little adventures, big smiles.',subtitle:'Discover ride-ons, strollers and travel essentials for every family journey.',img:'assets/photo-b00701b131d8c0a4.webp'},
 {category:'Mom Care',title:'Care for the one who cares.',subtitle:'Comfort-led essentials for pregnancy, feeding and recovery.',img:'assets/photo-ecbf52c98b83501a.webp'}
];
let categoryHeroIndex=0, categoryHeroTimer=null;
function paintCategoryHero(index){
 const banner=document.getElementById('category-hero-banner'); if(!banner)return;
 const selected = selectedCategory && selectedCategory!=='All' ? selectedCategory : 'New Born';
 let idx = categoryHeroSlides.findIndex(x=>x.category===selected);
 if(idx<0) idx=0;
 categoryHeroIndex=idx;
 const slide=categoryHeroSlides[idx];
 banner.style.backgroundImage=`url("${slide.img}")`;
 const title=document.getElementById('category-hero-title');
 const subtitle=document.getElementById('category-hero-subtitle');
 const cta=document.getElementById('category-hero-cta');
 if(title) title.textContent=slide.title;
 if(subtitle) subtitle.textContent=slide.subtitle;
 if(cta){cta.textContent='Explore '+slide.category;cta.onclick=()=>filterByCategory(slide.category);}
 const dots=document.getElementById('category-hero-dots');
 if(dots) dots.innerHTML='';
}
function stepCategoryHero(delta){ /* Category banners are intentionally fixed, not a slideshow. */ }
function restartCategoryHero(){ clearInterval(categoryHeroTimer); categoryHeroTimer=null; }
function openAllProducts(){
  selectedCategory = 'All';
  selectedSub = 'All';
  navState = { view:'plp', category:'All', subcategory:'All', subfilter:'All' };
  document.getElementById('subcat-landing').classList.add('hidden');
  document.getElementById('plp-view').classList.remove('hidden');
  document.getElementById('plp-breadcrumb').innerHTML =
    `<a onclick="showSection('home-page')">Home</a><span class="sep">›</span><span>All Products</span>`;
  document.getElementById('plp-eyebrow').textContent = 'BabyOne';
  document.getElementById('plp-title').textContent = 'All Products';
  const catTabs = categoriesData.map(c =>
    `<button class="plp-filter-tab" onclick="showSubcatLanding('${escapeHtml(c.name)}')">${escapeHtml(c.name)}</button>`
  ).join('');
  document.getElementById('plp-filter-nav').innerHTML =
    `<button class="plp-filter-tab active" data-filter="All" onclick="applyPLPFilter('All')">All</button>` + catTabs;
  renderPLPGrid();
  showSection('explorer-page');
}

/* ================= FILTER ================= */
function filterByCategory(catName, subName='All'){
  if(subName && subName !== 'All'){
    selectSubcategoryTile(catName, subName);
  } else {
    showSubcatLanding(catName);
  }
  showSection('explorer-page');
}
function renderExplorerPills(){
  const pills = document.getElementById('explorer-pills');
  let html = `<button class="btn btn-outline" style="font-size:10px;padding:11px 20px;${selectedCategory==='All'?'background:var(--ink);color:#fff;border-color:var(--ink);':''}" onclick="filterByCategory('All')">All</button>`;
  categoriesData.forEach(c=>{
    const on = selectedCategory===c.name;
    html += `<button class="btn btn-outline" style="font-size:10px;padding:11px 20px;${on?'background:var(--pink-500);color:#fff;border-color:var(--pink-500);':''}" onclick="filterByCategory('${c.name}')">${c.name}</button>`;
  });
  pills.innerHTML = html;

  if(selectedCategory==='All'){ paintCategoryHero(categoryHeroIndex||0); } else { const slideIndex=categoryHeroSlides.findIndex(x=>x.category===selectedCategory); if(slideIndex>=0) paintCategoryHero(slideIndex); }
  const subPills = document.getElementById('explorer-sub-pills');
  const current = categoriesData.find(c=>c.name===selectedCategory);
  if(current){
    let s = `<button class="btn btn-outline" style="font-size:10px;padding:10px 18px;${selectedSub==='All'?'background:var(--blue-500);color:#fff;border-color:var(--blue-500);':''}" onclick="filterByCategory('${selectedCategory}','All')">All</button>`;
    current.subcategories.forEach(sub=>{
      const on = selectedSub===sub;
      s += `<button class="btn btn-outline" style="font-size:10px;padding:10px 18px;${on?'background:var(--blue-500);color:#fff;border-color:var(--blue-500);':''}" onclick="filterByCategory('${selectedCategory}','${sub}')">${sub}</button>`;
    });
    subPills.innerHTML = s;
    subPills.classList.remove('hidden');
  } else {
    subPills.classList.add('hidden');
  }
}
// Ensure every subcategory has six distinctly named, niche-specific catalogue items.
(function expandSubcategoryCatalogue(){
  const original = productsData.slice();
  const byCategory = {
    'New Born': {'Swaddles':['Organic Cotton Swaddle Wrap','Muslin Swaddle Blanket','Newborn Swaddle Set','Soft Jersey Swaddle','Breathable Swaddle Wrap','Printed Muslin Wrap'],'Sleeping Bags':['Newborn Sleep Sack','Sleeveless Cotton Sleep Bag','Quilted Baby Sleep Sack','Lightweight Summer Sleep Bag','Zip-Up Sleep Sack','Soft Lining Sleep Bag'],'Diapers & Wipes':['Newborn Diaper Pack','Sensitive Baby Wipes','Travel Wipes Pack','Overnight Diapers','Reusable Changing Pads','Diaper Starter Bundle'],'Feeding Bottles & Sterilizers':['Anti-Colic Feeding Bottle','Wide-Neck Bottle Set','Bottle Sterilizer','Bottle Drying Rack','Newborn Bottle Kit','Bottle Cleaning Brush Set'],'Bedding':['Baby Cot Sheet Set','Soft Bassinet Sheet','Muslin Burp Cloths','Baby Blanket Set','Waterproof Mattress Protector','Newborn Bedding Bundle']},
    'Feeding': {'Bottles & Nipples':['Anti-Colic Bottle','Slow-Flow Newborn Nipples','Wide-Neck Bottle Set','Glass Feeding Bottle','Replacement Nipple Set','Travel Bottle Set'],'Breast Pumps':['Wearable Breast Pump','Manual Breast Pump','Electric Breast Pump','Pump Flange Set','Milk Storage Bags','Pump Cleaning Kit'],'High Chairs':['Adjustable Baby High Chair','Compact Foldable High Chair','Wooden Feeding Chair','Clip-On Travel Seat','Silicone Seat Cushion','High Chair Tray Set'],'Formula & Food':['Formula Dispenser','Baby Food Storage Pots','Silicone Freezer Tray','Snack Cup Set','Baby Food Spoon Set','Insulated Food Jar'],'Sippy Cups & Utensils':['Spill-Proof Sippy Cup','Silicone Training Cup','Toddler Spoon Set','Suction Bowl Set','Soft-Tip Fork Set','Straw Cup']},
    'Diapering': {'Diapers by Size':['Newborn Diapers','Size 1 Diapers','Size 2 Diapers','Size 3 Diapers','Overnight Diapers','Travel Diaper Pack'],'Wipes':['Sensitive Skin Wipes','Water-Based Baby Wipes','Travel Wipes Pack','Reusable Cotton Wipes','Wipes Dispenser','Fragrance-Free Wipes'],'Changing Mats':['Portable Changing Mat','Waterproof Changing Pad','Foldable Travel Mat','Padded Changing Mat','Disposable Changing Liners','Changing Mat Cover'],'Diaper Bags':['Everyday Diaper Backpack','Compact Changing Bag','Stroller Organizer Bag','Insulated Bottle Pocket Bag','Travel Diaper Tote','Water-Resistant Diaper Bag']},
    'Clothing': {'Newborn':['Newborn Cotton Bodysuit','Soft Knot Hat Set','Newborn Sleepsuit','Footed Cotton Romper','Newborn Mitten Set','Coming-Home Outfit'],'0–1 Years':['Infant Cotton Romper','Zip-Up Sleepsuit','Soft Bodysuit Multipack','Baby Leggings Set','Everyday Playsuit','Cotton Cardigan'],'1–3 Years':['Toddler Daywear Set','Cotton T-Shirt Set','Soft Jogger Pants','Playtime Romper','Lightweight Hoodie','Everyday Shorts Set'],'3+ Years':['Kids Cotton Tee','Comfy Lounge Set','Printed Pajama Set','Playtime Shorts','Lightweight Sweatshirt','Everyday Dress'],'Daywear':['Everyday Cotton Romper','Short-Sleeve Bodysuit','Baby Leggings','Soft Cotton Tee','Printed Playsuit','Summer Day Set'],'Sleepwear':['Zip Sleepsuit','Two-Piece Pajama Set','Footed Sleepwear','Lightweight Sleep Sack','Cotton Night Suit','Soft Bedtime Set'],'Rompers':['Ribbed Cotton Romper','Sleeveless Playsuit','Long-Sleeve Romper','Printed Baby Romper','Knit Romper','Everyday Snap Romper']},
    'Toys & Learning': {'STEM Toys':['First Shape Sorter','Baby Sensory Blocks','Stacking Rings','Wooden Counting Toy','Color Match Puzzle','Activity Cube'],'Soft Toys':['Plush Teddy Bear','Soft Bunny Toy','Musical Comfort Toy','Mini Cuddle Bear','Soft Sensory Rattle','Washable Plush Friend'],'Ride-Ons':['Mini Ride-On Car','Push-Along Ride-On','Toddler Balance Ride-On','Foot-to-Floor Car','Ride-On Truck','Parent-Controlled Ride-On'],'Art & Craft':['Washable Crayon Set','Toddler Finger Paint Kit','Chunky Pencil Set','Reusable Drawing Board','First Craft Kit','Large Paper Pad'],'Rattles & Teethers':['Silicone Teether','Wooden Baby Rattle','Textured Teether Set','Soft Rattle Toy','Cooling Teether Ring','Sensory Teether']},
    'Hospital Kit': {'Cribs':['Convertible Wooden Crib','Compact Baby Cot','Mini Crib','Cot Mattress','Crib Rail Cover','Crib Bedding Bundle'],'Wardrobes':['Compact Nursery Wardrobe','Baby Clothes Rail','Drawer Storage Unit','Nursery Shelf','Hanging Organizer','Wardrobe Divider Set'],'Bedding Sets':['Cot Bedding Set','Muslin Blanket Set','Fitted Cot Sheets','Quilted Baby Blanket','Bassinet Bedding Set','Waterproof Mattress Cover'],'Night Lights':['Silicone Night Light','Rechargeable Nursery Lamp','Moon Night Light','Soft Glow Lamp','Portable Night Light','Dimmable Bedside Light'],'Storage':['Woven Toy Basket','Nursery Storage Bins','Diaper Caddy','Clothes Organizer Set','Cot-Side Organizer','Soft Laundry Hamper']},
    'Cradles & Rockers': {'Electric Cradles':['Electric Baby Cradle','Automatic Rocking Bassinet','Compact Electric Cradle','Remote-Control Cradle','Gentle-Sway Bassinet','Electric Cradle Mattress'],'Manual Cradles':['Wooden Rocking Cradle','Traditional Baby Cradle','Compact Manual Cradle','Portable Rocking Bassinet','Cotton Cradle Mattress','Cradle Bedding Set'],'Cradle Swings':['Baby Swing Seat','Compact Cradle Swing','Indoor Baby Swing','Adjustable Swing Seat','Swing Seat Insert','Portable Baby Swing'],'Accessories':['Cradle Mosquito Net','Cradle Mattress Cover','Soft Cradle Sheet','Cradle Hanging Mobile','Cradle Storage Basket','Replacement Rocker Pads']},
    'Bath & Skincare': {'Tubs':['Foldable Baby Bathtub','Newborn Bath Support','Non-Slip Bath Mat','Compact Bath Tub','Bath Rinse Cup','Baby Bath Thermometer'],'Soaps & Shampoos':['Gentle Baby Shampoo','Tear-Free Baby Wash','Mild Baby Soap Bar','Head-to-Toe Wash','Foaming Baby Cleanser','Travel Baby Wash'],'Lotions & Oils':['Daily Baby Lotion','Gentle Massage Oil','Moisturizing Baby Cream','Sensitive Skin Balm','Baby Body Oil','After-Bath Lotion'],'Grooming Kits':['Baby Nail Care Kit','Soft Hair Brush Set','Digital Bath Thermometer','Nasal Care Kit','Baby Grooming Set','Soft Cotton Washcloths']},
    'Travel & Gear': {'Strollers':['Compact Travel Stroller','Lightweight Cabin Stroller','Reversible Seat Stroller','All-Terrain Stroller','Stroller Rain Cover','Stroller Organizer'],'Car Seats':['Rear-Facing Infant Seat','Convertible Car Seat','Infant Car Seat Base','Car Seat Sun Shade','Padded Head Support','Car Seat Protector'],'Baby Carriers':['Ergonomic Baby Carrier','Cotton Baby Wrap','Adjustable Hip Seat Carrier','Breathable Mesh Carrier','Newborn Carrier Insert','Carrier Drool Pads'],'Travel Bags':['Travel Diaper Backpack','Stroller Travel Bag','Insulated Bottle Bag','Compact Parent Tote','Baby Packing Cubes','Waterproof Travel Pouch']},
    'Mom Care': {'Maternity Wear':['Maternity Lounge Dress','Soft Maternity Leggings','Nursing-Friendly Top','Maternity Sleepwear','Stretch Cotton Dress','Postpartum Lounge Set'],'Postpartum Essentials':['Postpartum Recovery Kit','Perineal Care Bottle','Comfort Sitz Bath Kit','Reusable Nursing Pads','Postpartum Support Belt','Recovery Essentials Bag'],'Nursing Covers':['Breathable Nursing Cover','Cotton Nursing Shawl','Multi-Use Feeding Cover','Lightweight Nursing Scarf','Nursing Cover Poncho','Compact Nursing Wrap']}
  };
  const categoryNames = Object.keys(byCategory);
  categoryNames.forEach(catName=>{
    const cat = categoriesData.find(c=>c.name===catName); if(!cat) return;
    Object.entries(byCategory[catName]).forEach(([sub,names])=>{
      // match the actual subcategory label when present; otherwise still add this niche's products.
      names.slice(0,6).forEach((name,i)=>{
        if(productsData.some(p=>p.name.toLowerCase()===name.toLowerCase())) return;
        const base = original.find(p=>p.category===catName) || original[0];
        productsData.push({...base,id:`sub-${cat.id}-${sub.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${i+1}`,name,category:catName,subcategory:sub,price:Math.max(8,Math.round((base.price*(0.72+i*0.09))*100)/100),originalPrice:null,badge:i===0?'Popular':'Everyday Essential',description:`A thoughtfully selected ${name.toLowerCase()} for everyday family routines. Check product specifications and age suitability before use.`});
      });
    });
  });
  // Guarantee six visible items for every subcategory label configured in the site data.
  categoriesData.forEach(cat=>{
    (cat.subcategories||[]).forEach(sub=>{
      const matches=productsData.filter(p=>p.category===cat.name && p.subcategory===sub);
      const base=original.find(p=>p.category===cat.name)||original[0];
      for(let i=matches.length;i<6;i++){
        const title=`${sub} ${['Everyday Essential','Comfort Set','Starter Kit','Travel Edition','Premium Pack','Daily Care'][i%6]}`;
        productsData.push({...base,id:`auto-${cat.id}-${sub.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${i+1}`,name:title,category:cat.name,subcategory:sub,price:Math.max(8,Math.round((base.price*(0.75+i*0.08))*100)/100),originalPrice:null,badge:i===0?'Popular':'Everyday Essential',description:`A thoughtfully selected ${title.toLowerCase()} for everyday family routines. Please review age suitability and product details before use.`});
      }
    });
  });
})();

// Curated Diapering catalogue: only user-provided diaper photographs.
(function installBabyOneDiapers(){
  const category=categoriesData.find(c=>c.name==='Diapering');
  if(category)category.subcategories=['Diapers','Cloth'];
  const mainTile=categoriesData.find(c=>c.id==='diapering');
  if(mainTile)mainTile.subcategories=['Diapers','Cloth'];
  for(let i=productsData.length-1;i>=0;i--){if(productsData[i].category==='Diapering')productsData.splice(i,1);}
  productsData.push(...[{"id":"babyone-diapers-001","name":"Diaper Pants Small (Sm) 4 To 8Kg, 78 Count","brand":"LuvLap","category":"Diapering","subcategory":"Diapers","price":699,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Baby Diapers","image":"https://www.luvlap.com/cdn/shop/files/19236Diaper_S-78sE-com-1.jpg?v=1765757925&width=713","galleryImages":["https://www.luvlap.com/cdn/shop/files/Frame_2_67da7eb2-4bd2-4a8a-b73a-db5e0b06d3ec.jpg?v=1786538601&width=1920","https://www.luvlap.com/cdn/shop/files/Frame_3_9f1f9e87-45c3-45d0-9ebc-28c4130d2d46.jpg?v=1786538612&width=1920","https://www.luvlap.com/cdn/shop/files/Frame_5_5d358efc-95fa-42fb-9f8c-6e409504ecbd.jpg?v=1786538629&width=1920","https://www.luvlap.com/cdn/shop/files/Frame_5_5d358efc-95fa-42fb-9f8c-6e409504ecbd.jpg?v=1786538629&width=713","https://www.luvlap.com/cdn/shop/files/Frame_4_a82c8dc7-ee04-4f17-b663-04c7518d2657.jpg?v=1786538641&width=713"],"description":"Small diaper pants for babies weighing 4–8 kg. Pack of 78.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"Small (4–8 kg) · 78 count","price":699}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-002","name":"Teddyy Easy Diaper Pants with Rash Protection and 3x Faster absorption Technology - XL (54 Pieces)","brand":"Teddyy","category":"Diapering","subcategory":"Diapers","price":649,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Baby Diapers","image":"https://cdn.fcglcdn.com/brainbees/images/products/583x720/11266635a.webp","galleryImages":["https://cdn.fcglcdn.com/brainbees/images/products/583x720/11266635b.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/11266635c.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/11266635d.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/11266635f.webp"],"description":"XL diaper pants with rash protection and 3× faster absorption technology; 54 pieces.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"XL · 54 pieces","price":649}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-003","name":"Teddyy Baby Premium Taped Style Diapers Extra Small - 66 Pieces(Pack of 2)","brand":"Teddyy","category":"Diapering","subcategory":"Diapers","price":799,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Baby Diapers","image":"https://cdn.fcglcdn.com/brainbees/images/products/438x531/cc26379a.webp","galleryImages":["https://cdn.fcglcdn.com/brainbees/images/products/438x531/2393444a.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/2393444c.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/2393444d.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/teddyy_snuggy.webp"],"description":"Extra-small premium taped-style diapers, 66 pieces, pack of 2.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"Extra Small · 66 pieces (Pack of 2)","price":799}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-004","name":"Teddyy Baby Premium Taped Style Diapers New Born","brand":"Teddyy","category":"Diapering","subcategory":"Diapers","price":399,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Baby Diapers","image":"https://teddyydiaper.in/wp-content/uploads/2022/06/1.jpg","galleryImages":["https://tse3.mm.bing.net/th/id/OIP.nTEO7nEVaCue_qGcR9YFEwHaHa?r=0&pid=ImgDet&w=474&h=474&rs=1&o=7&rm=3","https://tse3.mm.bing.net/th/id/OIP.yjuoFOjbdAT2XtopGLwCtgHaHa?r=0&pid=ImgDet&w=474&h=474&rs=1&o=7&rm=3","https://tse3.mm.bing.net/th/id/OIP.O9Lo-t-4kaTt9ZqD3QUB3gHaHa?r=0&pid=ImgDet&w=474&h=474&rs=1&o=7&rm=3","https://tse3.mm.bing.net/th/id/OIP.mIspMONjd6ZiB6LT10UU2wHaHa?r=0&pid=ImgDet&w=474&h=474&rs=1&o=7&rm=3"],"description":"Premium taped-style diapers for newborns. Check package for exact count.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"Newborn · pack size to confirm","price":399}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-005","name":"Teddyy Baby Easy Pant Diapers New Born 66 Diapers (Pack of 1) 2-5 kgs","brand":"Teddyy","category":"Diapering","subcategory":"Diapers","price":649,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Baby Diapers","image":"https://cdn.fcglcdn.com/brainbees/images/products/583x720/13013640a.webp","galleryImages":["https://cdn.fcglcdn.com/brainbees/images/products/583x720/13013640b.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/13013640e.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/13013640f.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/13013640j.webp"],"description":"Newborn easy pant diapers for 2–5 kg babies, 66 pieces.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"Newborn (2–5 kg) · 66 pieces","price":649}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-006","name":"ZOE Zoe 100% Cotton for Babies - Set of 3","brand":"ZOE","category":"Diapering","subcategory":"Cloth","price":349,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cloth Diapers","image":"https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903569a.webp","galleryImages":["https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903569b.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903569c.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903569d.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903569e.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903569i.webp"],"description":"Reusable cotton baby cloth diapers, set of 3.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"Set of 3 · size to confirm","price":349}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-007","name":"ZOE cloth diapers Muslin Reusable Langot Pack of 6 for 0-3 Months","brand":"ZOE","category":"Diapering","subcategory":"Cloth","price":399,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cloth Diapers","image":"https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903574a.webp","galleryImages":["https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903574f.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903574b.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903574c.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/20903574d.webp"],"description":"Reusable muslin langot cloth diapers, pack of 6 for ages 0–3 months.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"0–3 months · pack of 6","price":399}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."},{"id":"babyone-diapers-008","name":"Bembika 3-Layer Cotton Nappy Inserts Pack of 10 - White","brand":"Bembika","category":"Diapering","subcategory":"Cloth","price":299,"currency":"INR","originalPrice":null,"rating":0,"reviews":0,"badge":"Cloth Diapers","image":"https://cdn.fcglcdn.com/brainbees/images/products/583x720/3200691a.webp","galleryImages":["https://cdn.fcglcdn.com/brainbees/images/products/583x720/3200691b.webp","https://cdn.fcglcdn.com/brainbees/images/products/583x720/3200691c.webp"],"description":"Three-layer cotton nappy inserts, pack of 10, white.","catalogHidden":false,"imageSource":"User supplied","priceEstimate":true,"variants":[{"size":"3-layer · pack of 10","price":299}],"selectedVariant":0,"sizeInfo":"Only the supplied size/pack is listed; other sizes require their own product details and photos."}]);
})();

function renderExplorerGrid(){
  let list = productsData.filter(p=>!p.catalogHidden);
  if(selectedCategory!=='All') list = list.filter(p=>p.category===selectedCategory);
  if(selectedSub!=='All') list = list.filter(p=>p.subcategory===selectedSub);
  document.getElementById('explorer-count').textContent = `Showing ${list.length} products`;
  if(!list.length){
    document.getElementById('explorer-grid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:56px 0;color:var(--ink-mute);"><i class="fa-regular fa-face-smile" style="font-size:34px;margin-bottom:14px;display:block;opacity:.4;"></i>No products found here yet.<br><button class="btn btn-outline" style="margin-top:20px;" onclick="filterByCategory('All')">Reset</button></div>`;
    return;
  }
  renderProductBatch('explorer-grid',list,'explorer-count');
}
function sortExplorerProducts(mode){
  let list = productsData.filter(p=>!p.catalogHidden);
  if(selectedCategory!=='All') list = list.filter(p=>p.category===selectedCategory);
  if(mode==='price-low') list.sort((a,b)=>a.price-b.price);
  else if(mode==='price-high') list.sort((a,b)=>b.price-a.price);
  else if(mode==='rating') list.sort((a,b)=>b.rating-a.rating);
  renderProductBatch('explorer-grid',list,'explorer-count');
}

/* ================= CART ================= */
function babyoneINRValue(p){
  const value = Number(p.price || 0);
  return p.currency === 'INR' ? value : value * 83.5;
}
function babyoneINRText(value){
  return '₹' + Number(value || 0).toLocaleString('en-IN', {maximumFractionDigits:2});
}
function buyProductNow(id){
  const p = productsData.find(x=>x.id===id);
  if(!p || p.price===null || p.price===undefined || p.price===''){ showToast('Price will be updated soon'); return; }
  const key=id+'::'+(p.variants?.[p.selectedVariant||0]?.size||'default');
  const existing = cart.find(c=>(c.cartKey||c.id)===key);
  if(existing) existing.qty++;
  else cart.push({...p,cartKey:key,name:p.name+(p.variants?.length?' — '+p.variants[p.selectedVariant||0].size:''),qty:1});
  updateCart();
  closeProductModal();
  toggleCartModal();
}
function addToCart(id){
  const p = productsData.find(x=>x.id===id);
  if(!p) return;
  if(p.price===null || p.price===undefined || p.price===''){ showToast('Price will be updated soon'); return; }
  const key=id+'::'+(p.variants?.[p.selectedVariant||0]?.size||'default');
  const ex = cart.find(c=>(c.cartKey||c.id)===key);
  if(ex) ex.qty++; else cart.push({...p,cartKey:key,name:p.name+(p.variants?.length?' — '+p.variants[p.selectedVariant||0].size:''),qty:1});
  updateCart();
  showToast('Added to bag');
}
function updateCart(){
  window.babyoneSheets?.cartUpdated();
  document.getElementById('cart-badge').textContent = cart.reduce((s,i)=>s+i.qty,0);
  const box = document.getElementById('cart-items-container');
  if(!cart.length){
    box.innerHTML = `<div class="cart-empty-state"><i class="fa-solid fa-bag-shopping"></i><p>Your bag is empty</p><span>Discover thoughtful essentials for little ones.</span></div>`;
    document.getElementById('cart-subtotal').textContent = '₹0';
    return;
  }
  let sub = 0;
  box.innerHTML = cart.map(i=>{
    const unit = babyoneINRValue(i);
    sub += unit*i.qty;
    return `
      <article class="cart-line-item">
        <img src="${i.image}" alt="${escapeHtml(i.name)}" loading="lazy" />
        <div class="cart-line-details">
          <p class="cart-line-name">${escapeHtml(i.name)}</p>
          <p class="cart-line-price">${babyoneINRText(unit)}</p>
          <div class="cart-qty-control">
            <button onclick="changeQty('${i.cartKey||i.id}',-1)" aria-label="Decrease quantity">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty('${i.cartKey||i.id}',1)" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="cart-remove" onclick="removeFromCart('${i.cartKey||i.id}')" aria-label="Remove ${escapeHtml(i.name)}"><i class="fa-regular fa-trash-can"></i></button>
      </article>`;
  }).join('');
  document.getElementById('cart-subtotal').textContent = babyoneINRText(sub);
}
function changeQty(id,d){
  const it = cart.find(c=>(c.cartKey||c.id)===id);
  if(it){ it.qty += d; if(it.qty<=0) cart = cart.filter(c=>(c.cartKey||c.id)!==id); }
  updateCart();
}
function removeFromCart(id){ cart = cart.filter(c=>(c.cartKey||c.id)!==id); updateCart(); }
function toggleCartModal(){ document.getElementById('cart-drawer').classList.toggle('hidden'); }

/* ================= WISHLIST ================= */
function toggleWishlist(id){
  if(wishlist.includes(id)){
    wishlist = wishlist.filter(x=>x!==id);
    showToast('Removed from wishlist');
  } else {
    wishlist.push(id);
    showToast('Saved to wishlist');
  }
  const badge = document.getElementById('wishlist-badge');
  badge.textContent = wishlist.length;
  badge.classList.toggle('hidden', wishlist.length===0);
  renderProductRails();
  if(!document.getElementById('explorer-page').classList.contains('hidden')) renderExplorerGrid();
  if(!document.getElementById('wishlist-drawer').classList.contains('hidden')) renderWishlistDrawer();
}
function renderWishlistDrawer(){
  const box = document.getElementById('wishlist-items-container');
  const items = productsData.filter(p=>!p.catalogHidden && wishlist.includes(p.id));
  if(!items.length){
    box.innerHTML = `<div style="text-align:center;padding:56px 0;color:var(--ink-mute);"><i class="fa-regular fa-heart" style="font-size:38px;opacity:.3;display:block;margin-bottom:16px;"></i><p style="font-size:13px;">Your wishlist is empty</p></div>`;
    return;
  }
  box.innerHTML = items.map(i=>`
    <div style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--line);">
      <img src="${i.image}" style="width:68px;height:78px;object-fit:cover;border-radius:14px;background:var(--cream);" />
      <div style="flex:1;min-width:0;">
        <p style="font-size:13px;font-weight:600;margin:0 0 6px;line-height:1.35;">${i.name}</p>
        <p style="font-family:'Nunito','Quicksand',sans-serif;font-size:16px;margin:0 0 10px;">${babyoneModalPriceLabel(i)}</p>
        <button class="btn btn-outline" style="font-size:9px;padding:9px 18px;" ${i.price===null||i.price===undefined? 'disabled title="Price will be updated soon"' : `onclick="addToCart('${i.id}')"`}>Add to Bag</button>
      </div>
      <button onclick="toggleWishlist('${i.id}')" style="background:none;border:0;color:var(--ink-mute);font-size:14px;align-self:flex-start;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
}
function toggleWishlistModal(){
  document.getElementById('wishlist-drawer').classList.toggle('hidden');
  renderWishlistDrawer();
}

/* ================= SEARCH ================= */
function handleSearch(q){
  q = (q||'').trim().toLowerCase();
  const boxes = [document.getElementById('search-results'), document.getElementById('search-results-mobile')];
  if(!q){ boxes.forEach(b=>b && b.classList.add('hidden')); return; }
  const matches = productsData.filter(p=>!p.catalogHidden && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))).slice(0,6);
  const html = matches.length
    ? matches.map(p=>`
        <button type="button" class="bo-search-result" onclick="openProductModal('${p.id}'); document.querySelectorAll('#search-results,#search-results-mobile').forEach(b=>b&&b.classList.add('hidden'));" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:16px;cursor:pointer;" onmouseover="this.style.background='var(--pink-50)'" onmouseout="this.style.background='transparent'">
          <img src="${p.image}" style="width:44px;height:52px;object-fit:cover;border-radius:12px;background:var(--cream);" />
          <div>
            <p style="font-size:12px;font-weight:600;margin:0;">${p.name}</p>
            <p style="font-family:'Nunito','Quicksand',sans-serif;font-size:14px;color:var(--blue-600);margin:3px 0 0;">${babyoneModalPriceLabel(p)}</p>
          </div>
        </button>`).join('')
    : `<p style="font-size:12px;color:var(--ink-mute);padding:16px;">No matches for "${escapeHtml(q)}"</p>`;
  boxes.forEach(b=>{ if(b){ b.innerHTML = html; b.classList.remove('hidden'); } });
}

function selectProductImage(id,index,url){
  const main=document.getElementById('main-product-image-'+id);
  if(main) main.src=url;
  const thumbs=document.getElementById('product-detail-thumbs-'+id);
  if(thumbs) thumbs.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===index));
}

/* ================= PRODUCT MODAL ================= */
function productVideoSection(p){
  // Every product video is connected to its own catalogue record; never display an unrelated product's price.
  const available=(Array.isArray(reelsData)?reelsData:[]).filter(r=>r && (r.id || r.localKey || r.videoUrl));
  if(!available.length) return '';
  const related=available.filter(r=>String(r.productId)===String(p.id));
  const other=available.filter(r=>String(r.productId)!==String(p.id));
  const picks=[...related,...other].slice(0,7);
  return `
    <div class="pv-wrap bo-product-videos">
      <div class="pv-head">
        <div>
          <span class="eyebrow">Real Life, Little Joys</span>
          <h3>See it in real life</h3>
          <p>Short product videos — swipe, or tap to watch.</p>
        </div>
      </div>
      <div class="pv-rail" id="bo-product-video-rail" aria-label="Related product videos">
        ${picks.map((reel,i)=>{
          const linked=productsData.find(item=>String(item.id)===String(reel.productId));
          const ridx=reelsData.indexOf(reel);
          const fallback='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22360%22 height=%22640%22%3E%3Crect width=%22360%22 height=%22640%22 fill=%22%23eff4f8%22/%3E%3Cpath d=%22M144 275h72v90h-72z%22 fill=%22%23b9cbd8%22/%3E%3C/svg%3E';
          const cover=reel.cover||(reel.id?'https://i.ytimg.com/vi/'+encodeURIComponent(reel.id)+'/hqdefault.jpg':fallback);
          return `<div class="pv-card" onclick="openReel(${ridx})" tabindex="0" role="button" aria-label="Watch ${escapeHtml(reel.title||'product video')}" onkeydown="if(event.key==='Enter'){openReel(${ridx})}">
            <div class="pv-video">
              <img src="${escapeHtml(cover)}" onerror="this.onerror=null;this.src='${fallback}'" alt="${escapeHtml(reel.title||'BabyOne video')}" loading="lazy" />
              <span class="pv-play"><i class="fa-solid fa-play"></i></span>
            </div>
            <div class="pv-caption">
              <h4>${escapeHtml(reel.title||'BabyOne product video')}</h4>
              ${linked ? `<div class="pv-shop" onclick="event.stopPropagation();openProductModal('${escapeHtml(String(linked.id))}')" role="button" tabindex="0">
                <div style="min-width:0"><div class="pv-shop-name">${escapeHtml(linked.name)}</div><div class="pv-shop-price">${babyonePriceLabel(linked)}</div></div>
                <i class="fa-solid fa-arrow-right"></i></div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}
function productReviewStorageKey(id){return 'babyone-product-reviews-'+id;}
function renderProductReviewCards(id){
  let saved=[]; try{saved=JSON.parse(localStorage.getItem(productReviewStorageKey(id))||'[]')}catch(e){}
  const examples=[
    {name:'A happy parent',rating:5,text:'Lovely everyday essential. The details and finish feel thoughtful.'},
    {name:'BabyOne customer',rating:5,text:'Easy to use and a lovely addition to our family routine.'},
    {name:'Verified-style sample',rating:4,text:'Nice design and practical for everyday use.'}
  ];
  const all=saved;
  const card=r=>`<article class="product-review-card"><div style="color:var(--pink-500);letter-spacing:2px;font-size:13px">${'★'.repeat(Math.max(1,Math.min(5,Number(r.rating)||5)))}${'☆'.repeat(5-Math.max(1,Math.min(5,Number(r.rating)||5)))}</div><p>${escapeHtml(r.text)}</p><strong style="font-size:12px;color:var(--ink)">${escapeHtml(r.name)}</strong></article>`;
  return all.length ? all.map(card).join('') : '<p style="font-size:13px;color:var(--ink-soft);padding:18px">No customer reviews yet.</p>';
}
function toggleProductReviewForm(id){const f=document.getElementById('product-review-form-'+id);if(f)f.classList.toggle('open');}
function submitProductReview(event,id){
  event.preventDefault();
  const name=document.getElementById('review-name-'+id).value.trim();
  const rating=Number(document.getElementById('review-rating-'+id).value);
  const textValue=document.getElementById('review-text-'+id).value.trim();
  if(!name||!textValue)return;
  let saved=[];try{saved=JSON.parse(localStorage.getItem(productReviewStorageKey(id))||'[]')}catch(e){}
  saved.unshift({name,rating,text:textValue,date:new Date().toISOString()});
  try{localStorage.setItem(productReviewStorageKey(id),JSON.stringify(saved));}catch(e){}
  const track=document.getElementById('product-review-track-'+id);if(track)track.innerHTML=renderProductReviewCards(id);
  event.target.reset();event.target.classList.remove('open');
  if(typeof showToast==='function')showToast('Review added on this device');
}

function openProductModal(id){
  const p = productsData.find(x=>x.id===id);
  if(!p) return;
  const related = productsData.filter(x=>!x.catalogHidden && x.id!==id && x.category===p.category).concat(productsData.filter(x=>!x.catalogHidden && x.id!==id && x.category!==p.category)).slice(0,4);
  const hasPrice = p.price!==null && p.price!==undefined && p.price!=='';
  const canBuy = hasPrice && (!p.serverProduct || (p.sale_enabled && p.variants?.some(v=>v.available)));
  const save = p.originalPrice && hasPrice ? Math.round((1-p.price/p.originalPrice)*100) : 0;
  const inWish = wishlist.includes(p.id);
  document.getElementById('modal-product-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr;gap:clamp(24px,4vw,52px);" class="modal-grid">
      <div>
        <div style="aspect-ratio:4/5;border-radius:var(--r-lg);overflow:hidden;background:var(--cream);position:relative;">
          <img id="main-product-image-${p.id}" src="${p.image}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:contain;" />
          <span style="position:absolute;top:14px;left:14px;background:rgba(253,250,247,.94);color:var(--pink-600);font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:7px 15px;border-radius:var(--r-pill);">${escapeHtml(p.badge)}</span>
        </div>
        <div class="product-gallery-label">Product gallery <span>Main photo + available product photos</span></div>
        <div class="product-detail-thumbs" id="product-detail-thumbs-${p.id}">
          ${babyoneProductGallery(p).map((img,i)=>`<button type="button" class="${i===0?'active':''} ${babyoneIsDemoGallerySlot(p,i)?'bo-demo-thumb':''}" aria-label="View ${babyoneIsDemoGallerySlot(p,i)?'temporary sample':'product'} image ${i+1}" onclick="babyoneSelectGallerySlot('${p.id}',${i})"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)} ${babyoneIsDemoGallerySlot(p,i)?'temporary sample image':'image'} ${i+1}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(p.image)}'"><span class="bo-thumb-label">${babyoneIsDemoGallerySlot(p,i)?'Sample':'Photo '+(i+1)}</span></button>`).join('')}
        </div>
        ${babyoneProductGallery(p).length>1?`<p class="bo-gallery-hint">Swipe the photo or tap a thumbnail to view every available image.</p>`:''}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;">
          <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--ink-mute);text-align:center;padding:12px 6px;border:1px solid var(--line);border-radius:var(--r-pill);">Carefully Packed</span>
          <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--ink-mute);text-align:center;padding:12px 6px;border:1px solid var(--line);border-radius:var(--r-pill);">Parent-Approved</span>
          <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--ink-mute);text-align:center;padding:12px 6px;border:1px solid var(--line);border-radius:var(--r-pill);">Delivery Updates</span>
        </div>
      </div>
      <div>
        <span class="eyebrow" style="color:var(--pink-500);">${escapeHtml(p.category)}</span>
        <h2 style="font-family:'Nunito','Quicksand',sans-serif;font-size:clamp(28px,3.8vw,42px);font-weight:400;margin:14px 0;color:var(--ink);letter-spacing:-.02em;line-height:1.1;">${escapeHtml(p.name)}</h2>
        ${Number(p.rating)>0?`<div style="display:flex;align-items:center;gap:10px;font-size:12px;margin-bottom:22px;"><span style="color:var(--pink-400);">★★★★★</span><strong>${p.rating}</strong><span style="color:var(--ink-mute);">(${p.reviews||0} ratings)</span></div>`:''}
        <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:30px;padding-bottom:26px;border-bottom:1px solid var(--line);">
          <span style="font-family:'Nunito','Quicksand',sans-serif;font-size:34px;font-weight:700;color:var(--ink);">${babyonePriceLabel(p)}</span>
          ${p.originalPrice?`<span style="font-size:14px;color:var(--ink-mute);text-decoration:line-through;">${p.currency==='INR'?'₹'+Number(p.originalPrice).toLocaleString('en-IN'):'₹'+Math.round(Number(p.originalPrice)*83.5).toLocaleString('en-IN')}</span><span style="font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pink-500);">Save ${save}%</span>`:''}
        </div>
        <p style="font-size:14px;line-height:1.8;color:var(--ink-soft);margin:0 0 18px;">${escapeHtml(p.description||'Thoughtfully selected for everyday care and comfort. Please review product specifications before purchase.')}</p>
        ${babyoneSizeOptionsMarkup(p)}
        ${p.serverProduct&&!canBuy?'<p role="status" style="font-size:13px;line-height:1.6;color:var(--ink-soft);">This product is not available for sale yet. To test Razorpay, use “Try test payment” at the top of the store.</p>':''}
        ${p.priceEstimate?`<p style="font-size:11px;color:#a36b34;margin:8px 0 16px">Estimated prices and size options — confirm before selling.</p>`:""}
        <div class="bo-detail-inline-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <button class="btn btn-pink product-detail-add" ${canBuy?`onclick="addToCart('${p.id}')"`:'disabled title="Product is not available for sale"'}><i class="fa-solid fa-bag-shopping"></i> Add to Cart</button>
          <button class="btn btn-outline product-detail-buy" ${canBuy?`onclick="buyProductNow('${p.id}')"`:'disabled title="Product is not available for sale"'}>Buy Now <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <button type="button" class="btn btn-outline bo-detail-share" data-product-id="${escapeHtml(String(p.id))}" onclick="BOproductShare.share(this.dataset.productId)"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" stroke-linecap="round" stroke-linejoin="round"/></svg> Share product</button>
        <button class="btn btn-outline" style="width:100%;margin-top:12px;font-size:10px;padding:14px;" onclick="toggleWishlist('${p.id}'); openProductModal('${p.id}');">
          <i class="fa-${inWish?'solid':'regular'} fa-heart" style="color:${inWish?'var(--pink-500)':'inherit'};"></i>
          ${inWish ? 'Saved to Wishlist' : 'Save to Wishlist'}
        </button>
      </div>
    </div>
    ${productVideoSection(p)}
    <section class="product-review-section" aria-label="Product reviews">
      <div class="product-review-head">
        <div><span class="eyebrow" style="color:var(--pink-500);">Little notes from families</span><h3 style="margin:7px 0 0;font-size:clamp(22px,3vw,30px);">Reviews for ${escapeHtml(p.name)}</h3></div>
        <button class="btn btn-outline" type="button" onclick="toggleProductReviewForm('${p.id}')" style="white-space:nowrap;"><i class="fa-solid fa-plus"></i> Add Review</button>
      </div>
      <div class="product-review-rail"><div class="product-review-track" id="product-review-track-${p.id}">${renderProductReviewCards(p.id)}</div></div>
      <form class="product-review-form" id="product-review-form-${p.id}" onsubmit="submitProductReview(event,'${p.id}')">
        <label for="review-name-${p.id}">Your name</label><input id="review-name-${p.id}" required maxlength="60" placeholder="Name">
        <label for="review-rating-${p.id}">Rating</label><select id="review-rating-${p.id}"><option value="5">★★★★★ — Loved it</option><option value="4">★★★★☆ — Great</option><option value="3">★★★☆☆ — Good</option><option value="2">★★☆☆☆ — Could be better</option><option value="1">★☆☆☆☆ — Not for me</option></select>
        <label for="review-text-${p.id}">Your review</label><textarea id="review-text-${p.id}" required maxlength="500" placeholder="Share your experience…"></textarea>
        <button class="btn btn-pink" type="submit">Post Review</button>
      </form>
      <p style="font-size:11px;color:var(--ink-mute);margin-top:10px;">Reviews added here are saved in this browser on this device. Connect a backend to share them with all customers.</p>
    </section>
    <div style="margin-top:clamp(36px,6vw,60px);padding-top:clamp(36px,6vw,60px);border-top:1px solid var(--line);">
      <div style="text-align:center;margin-bottom:30px;">
        <span class="eyebrow" style="color:var(--pink-500);">You May Also Love</span>
        <h3 style="font-family:'Nunito','Quicksand',sans-serif;font-size:clamp(24px,3vw,34px);font-weight:400;margin:12px 0 0;">More From BabyOne</h3>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:clamp(12px,2.2vw,22px);" class="related-grid">
        ${related.map(r=>`
          <div onclick="openProductModal('${r.id}')" style="cursor:pointer;">
            <div style="aspect-ratio:4/5;border-radius:var(--r-md);overflow:hidden;background:var(--cream);">
              <img src="${r.image}" alt="${escapeHtml(r.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
            </div>
            <div style="padding:14px 2px;">
              <p style="font-size:12px;font-weight:600;margin:0 0 8px;line-height:1.5;">${escapeHtml(r.name)}</p>
              <span style="font-family:'Nunito','Quicksand',sans-serif;font-size:16px;">${babyoneModalPriceLabel(r)}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <style>
      @media(min-width:768px){
        .modal-grid{ grid-template-columns:1fr 1fr !important; }
        .related-grid{ grid-template-columns:repeat(4,1fr) !important; }
      }
    
/* Full-bleed collection hero and mobile-first category catalogue */
.category-hero-banner{min-height:clamp(210px,32vw,360px);margin:0 0 24px;border-radius:24px;background-size:cover;background-position:center;display:flex;align-items:center;padding:clamp(22px,5vw,58px);overflow:hidden;color:#fff;}
.category-hero-copy{max-width:560px;text-shadow:0 2px 18px rgba(0,0,0,.16)}
.category-hero-copy h3{font-size:clamp(28px,5vw,54px);line-height:1.06;margin:12px 0;font-weight:800;letter-spacing:-.03em}
.category-hero-copy p{font-size:clamp(13px,1.5vw,16px);line-height:1.6;max-width:430px;margin:0}
/* Responsive polish: no horizontal zoom/overflow, clear category avatars and non-overlapping product details */
html,body{width:100%;max-width:100%;overflow-x:hidden; -webkit-text-size-adjust:100%;}
*,*::before,*::after{box-sizing:border-box;}
img{max-width:100%;}
#explorer-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(12px,2vw,24px);width:100%;}
#explorer-grid .product{width:100%;min-width:0;}
.product-name{font-size:clamp(12px,1vw,15px);line-height:1.4;overflow-wrap:anywhere;}
.product-subcategory{display:block;font-size:12px;line-height:1.35;color:var(--blue-600);font-weight:800;margin:5px 0 7px;}
.product-media img{object-fit:contain;background:#f7f9fc;}
#product-modal{position:fixed;inset:0;z-index:100;overflow:hidden;}
#product-modal > .overlay{display:none!important;}
#product-modal > div[style*="position:fixed"]{inset:0!important;padding:0!important;align-items:stretch!important;}
#product-modal-shell{width:100%!important;max-width:none!important;height:100dvh;max-height:100dvh!important;overflow-y:auto;border-radius:0!important;padding:clamp(22px,4vw,56px)!important;box-shadow:none!important;}
@media(max-width:900px){#explorer-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media(max-width:640px){
  .cat-scroll{gap:12px;padding:8px 4px 18px;justify-content:flex-start;}
  .cat-tile{width:clamp(130px,38vw,158px);gap:9px;}
  .cat-tile img{width:clamp(118px,34vw,142px);height:clamp(118px,34vw,142px);padding:0!important;object-fit:cover!important;object-position:center;border-radius:50%;}
  .cat-tile span{font-size:13px;line-height:1.3;max-width:150px;}
  #explorer-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
  #explorer-grid .product{width:100%;min-width:0;}
  .product-media{aspect-ratio:4/5;border-radius:14px;}
  .product-info{min-width:0;padding-top:9px;}
  .product-name{font-size:12px;line-height:1.35;}
  #product-modal-shell{width:100%!important;height:100dvh;max-height:100dvh!important;border-radius:0!important;padding:64px 14px 24px!important;}
  .modal-grid{grid-template-columns:minmax(0,1fr)!important;}
  .hero,.section,.section-inner{max-width:100%;}
}

/* Product gallery thumbnails + customer reviews rail */
.product-detail-thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.product-detail-thumbs button{border:1px solid var(--line);border-radius:12px;overflow:hidden;padding:0;background:#f5f8fb;aspect-ratio:1;cursor:pointer}
.product-detail-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.product-review-section{margin-top:44px;padding-top:32px;border-top:1px solid var(--line)}
.product-review-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.product-review-rail{overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)}
.product-review-track{display:flex;gap:14px;width:max-content;animation:productReviewScroll 38s linear infinite}
.product-review-rail:hover .product-review-track{animation-play-state:paused}
@keyframes productReviewScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.product-review-card{flex:0 0 260px;max-width:260px;background:#f7faff;border:1px solid var(--line);border-radius:16px;padding:18px}
.product-review-card p{font-size:13px;line-height:1.55;color:var(--ink-soft);margin:9px 0}
.product-review-form{display:none;margin-top:18px;padding:18px;border:1px solid var(--line);border-radius:16px;background:#fbfdff}
.product-review-form.open{display:block}
.product-review-form input,.product-review-form textarea,.product-review-form select{width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;margin:6px 0 12px;font:inherit;background:#fff;color:var(--ink)}
.product-review-form textarea{min-height:86px;resize:vertical}
@media(max-width:640px){.product-review-card{flex-basis:230px}.product-review-head{align-items:flex-start}.product-detail-thumbs{gap:7px}}
</style>`;
  document.getElementById('product-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeProductModal(){
  document.getElementById('product-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ================= MOBILE MENU ================= */
function toggleMobileDrawer(){
  const d = document.getElementById('mobile-drawer');
  const open=d.classList.toggle('hidden')===false;
  const toggle=document.getElementById('bo-header-menu-toggle');
  if(toggle){toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');}
  if(open)renderMobileMenu();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('mobile-drawer')?.classList.contains('hidden'))toggleMobileDrawer();});
function renderMobileMenu(){
  const list = document.getElementById('mobile-menu-list');
  list.innerHTML = `
    <a href="#" onclick="showSection('home-page'); toggleMobileDrawer(); return false;" style="display:block;padding:16px 0;font-size:14px;font-weight:600;color:var(--ink);border-bottom:1px solid var(--line);text-decoration:none;">Home</a>
    <a href="#" onclick="showSection('explorer-page'); toggleMobileDrawer(); return false;" style="display:block;padding:16px 0;font-size:14px;font-weight:600;color:var(--ink);border-bottom:1px solid var(--line);text-decoration:none;">All Categories</a>
    <a href="#" onclick="boU.home(); toggleMobileDrawer(); return false;" style="display:block;padding:16px 0;font-size:14px;font-weight:600;color:var(--ink);border-bottom:1px solid var(--line);text-decoration:none;">My Account</a>
    <a href="#" onclick="boU.orders(); toggleMobileDrawer(); return false;" style="display:block;padding:16px 0;font-size:14px;font-weight:600;color:var(--ink);border-bottom:1px solid var(--line);text-decoration:none;">My Orders</a>
    ${categoriesData.map(c=>`<a href="#" onclick="filterByCategory('${c.name}'); toggleMobileDrawer(); return false;" style="display:block;padding:13px 0;font-size:13px;color:var(--ink-soft);border-bottom:1px solid var(--line);text-decoration:none;">${c.name}</a>`).join('')}
  `;
}

/* ================= REEL VIEWER ================= */
function openReel(startIdx){
 const list=document.getElementById('reel-list');list.replaceChildren();
 reelsData.forEach((reel,i)=>{
  const section=document.createElement('section');section.className='reel-item';section.dataset.idx=i;
  if(reel.localKey){const box=document.createElement('div');box.style.cssText='width:min(100vw,460px);height:100dvh;background:#111;display:flex;align-items:center';section.appendChild(box);if(i===startIdx)boActivateVideo(box,reel.localKey);else box.textContent='Scroll here to play the video';}
  else if(reel.videoUrl){const v=document.createElement('video');v.controls=true;v.playsInline=true;v.preload='metadata';v.style.cssText='height:100%;max-width:100%;object-fit:contain';v.src=reel.videoUrl;section.appendChild(v);if(i===startIdx)v.play().catch(()=>{});}
  else {const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(reel.id)+'?autoplay='+(i===startIdx?1:0)+'&mute=0&controls=1&playsinline=1&rel=0';f.title=reel.title||'BabyOne video';f.allow='autoplay; encrypted-media; picture-in-picture';f.allowFullscreen=true;section.appendChild(f)}
  list.appendChild(section);
 });
 document.getElementById('reel-viewer').classList.remove('hidden');document.body.style.overflow='hidden';
 requestAnimationFrame(()=>list.querySelector('[data-idx="'+startIdx+'"]')?.scrollIntoView({block:'start'}));
}
function closeReelViewer(){
  document.getElementById('reel-viewer').classList.add('hidden');
  document.getElementById('reel-list').innerHTML = '';
  document.body.style.overflow = '';
}

/* ================= TOAST ================= */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2800);
}

/* ================= REVIEWS FORM ================= */
function toggleSiteReviewForm(){
  const w = document.getElementById('site-review-form-wrap');
  w.style.display = w.style.display==='none' ? 'block' : 'none';
  if(w.style.display==='block') w.scrollIntoView({behavior:'smooth', block:'center'});
}
function submitSiteReview(e){
  e.preventDefault();
  const name = document.getElementById('review-name').value.trim();
  const rating = Number(document.getElementById('review-rating').value);
  const message = document.getElementById('review-message').value.trim();
  if(!name || !message) return;
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem('babyone-site-reviews')||'[]'); } catch(err){}
  stored.unshift({name, rating, message});
  localStorage.setItem('babyone-site-reviews', JSON.stringify(stored.slice(0,30)));
  renderReviews();
  e.target.reset();
  document.getElementById('site-review-form-wrap').style.display='none';
  showToast('Thank you for your review');
}

/* ================= HELPERS ================= */
function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function checkout(){ if(window.boU && boU.checkout) boU.checkout(); else showToast('Checkout ready'); }
function openAuthModal(){ if(window.boU && boU.login) boU.login(); else showToast('Account'); }

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', ()=>{
  renderHero();
  renderCategories();
  renderPromos();
  renderProductRails();
  renderReels();
  renderReviews();
  renderExplorerPills();
  renderExplorerGrid();
  updateCart();

  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.search-wrap') && !e.target.closest('.mobile-search-inner')){
      document.getElementById('search-results')?.classList.add('hidden');
      document.getElementById('search-results-mobile')?.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      if(!document.getElementById('product-modal').classList.contains('hidden')) closeProductModal();
      if(!document.getElementById('cart-drawer').classList.contains('hidden')) toggleCartModal();
      if(!document.getElementById('wishlist-drawer').classList.contains('hidden')) toggleWishlistModal();
      if(!document.getElementById('mobile-drawer').classList.contains('hidden')) toggleMobileDrawer();
      if(!document.getElementById('reel-viewer').classList.contains('hidden')) closeReelViewer();
    }
  });
});
