// Synthetic display products. No real catalogue, customer information or order requests.
export type Product={id:number;nameAr:string;nameEn:string;primaryImage:string;imageUrl:string;price:number;stock:number;rating:number;reviewCount:number;categoryId:number;descriptionAr:string;descriptionEn:string};
export type CartItem={id:number;product:Product;quantity:number};
const image=(n:number)=>'/__mockup/images/store-product-'+n+'.jpg';
export const PRODUCTS:Product[]=[
{id:1,nameEn:'Radiance serum',nameAr:'سيروم إشراقة البشرة',price:3400,stock:12,categoryId:1,primaryImage:image(1),imageUrl:image(1)},
{id:2,nameEn:'Daily skincare duo',nameAr:'ثنائي العناية اليومية',price:5200,stock:8,categoryId:3,primaryImage:image(2),imageUrl:image(2)},
{id:3,nameEn:'Haircare essentials',nameAr:'مجموعة العناية بالشعر',price:2800,stock:6,categoryId:2,primaryImage:image(3),imageUrl:image(3)},
{id:4,nameEn:'Nourishing hair serum',nameAr:'سيروم مغذّي للشعر',price:1950,stock:15,categoryId:2,primaryImage:image(4),imageUrl:image(4)},
{id:5,nameEn:'Hydrating skincare set',nameAr:'مجموعة ترطيب البشرة',price:4600,stock:4,categoryId:3,primaryImage:image(2),imageUrl:image(2)},
{id:6,nameEn:'Gentle cleansing gel',nameAr:'جل تنظيف لطيف',price:1700,stock:0,categoryId:4,primaryImage:image(1),imageUrl:image(1)},
].map(p=>({...p,rating:0,reviewCount:0,descriptionAr:'منتج توضيحي لمعاينة التصميم. لا يمكن شراء هذه البيانات التجريبية.',descriptionEn:'Illustrative product for design preview only. These sample products cannot be purchased.'}));
export const CATEGORIES=[{id:1,nameFr:'Face care',nameAr:'العناية بالبشرة',imageUrl:image(1)},{id:2,nameFr:'Hair care',nameAr:'العناية بالشعر',imageUrl:image(3)},{id:3,nameFr:'Skincare sets',nameAr:'مجموعات العناية',imageUrl:image(2)},{id:4,nameFr:'Cleansers',nameAr:'منظفات البشرة',imageUrl:image(1)}];
export type StoreConfig = {
  nameAr: string; nameEn: string; logoUrl: string | null;
  showPrices: boolean; showStock: boolean; acceptOrders: boolean;
  minOrderAmount: number; bannerUrl: string | null; description: string | null;
  facebookUrl: string | null; instagramUrl: string | null; tiktokUrl: string | null;
  whatsappNumber: string | null; featuredProductIds: number[]; featuredCategoryIds: number[];
};
export const STORE: StoreConfig={nameAr:'ميدانيك',nameEn:'Midanic',logoUrl:'/__mockup/images/store-logo.jpg',showPrices:true,showStock:true,acceptOrders:true,minOrderAmount:0,bannerUrl:'/__mockup/images/store-hero.jpg',description:null,facebookUrl:null,instagramUrl:null,tiktokUrl:null,whatsappNumber:null,featuredProductIds:[],featuredCategoryIds:[]};
