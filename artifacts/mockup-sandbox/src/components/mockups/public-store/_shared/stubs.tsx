import React,{createContext,useContext,useState,type ReactNode} from 'react';
import {PRODUCTS,CATEGORIES,STORE,type CartItem,type Product} from './fixtures';
type DemoContext={lang:'en'|'ar';toggleLang:()=>void;cart:CartItem[];add:(p:Product,q:number)=>Promise<void>;notice:string;notify:(text:string)=>void};
const Context=createContext<DemoContext|null>(null);
export function PreviewProvider({children}:{children:ReactNode}){const[lang,setLang]=useState<'en'|'ar'>('en');const[cart,setCart]=useState<CartItem[]>([]);const[notice,notify]=useState('');return <Context.Provider value={{lang,toggleLang:()=>setLang(x=>x==='en'?'ar':'en'),cart,notice,notify,add:async(product,quantity)=>{setCart(rows=>{const old=rows.find(r=>r.product.id===product.id);return old?rows.map(r=>r===old?{...r,quantity:r.quantity+quantity}:r):[...rows,{id:product.id,product,quantity}];});}}}><div className='store-prototype' dir={lang==='ar'?'rtl':'ltr'}>{children}{notice&&<div role='status' className='fixed bottom-5 left-5 z-[100] max-w-sm rounded-xl border bg-card p-4 shadow-xl'><p>{notice}</p><p className='mt-2 text-xs text-muted-foreground'>{lang==='ar'?'نموذج تصميم فقط — لا طلبات حقيقية':'Design preview only — no real orders'}</p><button className='mt-2 text-primary' onClick={()=>notify('')}>{lang==='ar'?'إغلاق':'Close'}</button></div>}</div></Context.Provider>}
const useDemo=()=>{const state=useContext(Context);if(!state)throw new Error('Missing preview provider');return state;};
export const useLang=()=>{const {lang,toggleLang}=useDemo();return{lang,toggleLang};};
export const useStoreConfig=()=>STORE;
export const useAuth=()=>({user:null as {role:string}|null,logout:()=>{}});
export const useStoreCart=()=>{const ctx=useDemo();return{data:ctx.cart,isLoading:false,isPending:false,add:ctx.add};};
export const useToast=()=>{const ctx=useDemo();return{toast:({title,description}:{title:string;description?:string;variant?:string})=>ctx.notify([title,description].filter(Boolean).join(' — '))};};
export function useGetProducts(..._args:unknown[]){return{data:{products:PRODUCTS},isLoading:false};}
export const getGetProductsQueryKey=(..._args:unknown[])=>['preview-products'];
export const resolveImg=(url:string|null|undefined)=>url??undefined;
export const useLocation=()=>['/',(_path:string)=>{}] as const;
export function Link({href,children,onClick,...rest}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){const ctx=useDemo();return <a {...rest} href={href} onClick={event=>{onClick?.(event);if(event.defaultPrevented)return;event.preventDefault();if(href.startsWith('/products')&&!/^\/products\/\d/.test(href)){document.querySelector('[data-store-products]')?.scrollIntoView({behavior:'smooth'});}else ctx.notify(ctx.lang==='ar'?'هذه معاينة للتصميم فقط، دون انتقال إلى الموقع الفعلي.':'Design preview only. No navigation to the live storefront.');}}>{children}</a>;}
