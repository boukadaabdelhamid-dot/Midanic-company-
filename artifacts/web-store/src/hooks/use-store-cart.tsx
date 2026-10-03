import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCart, useAddToCart, useUpdateCartItem, useRemoveFromCart, type CartItem, type Product } from "@workspace/erp-api-client-react";
import { useAuth } from "./use-auth";
import { getExplicitStoreSlug } from "@/lib/store-headers";

export function cartScope(): string {
  return `${window.location.hostname}:${getExplicitStoreSlug() ?? "company"}`;
}
export function orderTokenKey(id: number): string { return `midanic_order:${cartScope()}:${id}`; }

function readGuestCart(key: string): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((row): row is CartItem =>
      row && Number.isSafeInteger(row.product?.id) && Number.isFinite(row.quantity) && row.quantity > 0).slice(0, 100) : [];
  } catch { return []; }
}
type StoreCart = {
  data: CartItem[];
  isLoading: boolean;
  isPending: boolean;
  error: Error | null;
  add: (product: Product, quantity: number) => Promise<void>;
  update: (productId: number, quantity: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  clearAfterOrder: () => void;
};
const CartContext = createContext<StoreCart | null>(null);

export function StoreCartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const storageKey = `midanic_guest_cart:${cartScope()}`;
  const [guest, setGuest] = useState(() => readGuestCart(storageKey));
  const queryKey = ["store-cart", cartScope(), user?.id ?? "guest"];
  const server = useGetCart({ query: { enabled: !!user, queryKey } });
  const addItem = useAddToCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(guest)); }, [guest, storageKey]);
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === storageKey) setGuest(readGuestCart(storageKey)); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey]);
  const serverItems = user && Array.isArray(server.data) ? server.data : [];
  // A guest basket remains visible after optional sign-in. It is combined with
  // the account basket without silently duplicating it on the server.
  const merged = new Map<number, CartItem>();
  for (const item of [...serverItems, ...guest]) {
    if (!item.product?.id) continue;
    const old = merged.get(item.product.id);
    merged.set(item.product.id, old ? { ...old, quantity: old.quantity + item.quantity } : item);
  }
  const refresh = async () => { await qc.invalidateQueries({ queryKey }); };
  const removeGuest = (id: number) => setGuest(rows => rows.filter(row => row.product?.id !== id));
  const value: StoreCart = {
    data: [...merged.values()], isLoading: authLoading || (!!user && server.isLoading),
    error: user ? server.error : null,
    isPending: addItem.isPending || updateItem.isPending || removeItem.isPending,
    async add(product, quantity) {
      if (user) { await addItem.mutateAsync({ data: { productId: product.id, quantity } }); await refresh(); }
      else setGuest(rows => {
        const old = rows.find(row => row.product?.id === product.id);
        return old ? rows.map(row => row === old ? { ...row, product, quantity: row.quantity + quantity } : row)
          : [...rows, { id: product.id, product, quantity }];
      });
    },
    async update(productId, quantity) {
      if (quantity <= 0) return value.remove(productId);
      if (user) {
        if (serverItems.some(row => row.product?.id === productId)) {
          await updateItem.mutateAsync({ productId, data: { quantity } });
        } else await addItem.mutateAsync({ data: { productId, quantity } });
        removeGuest(productId); await refresh();
      } else setGuest(rows => rows.map(row => row.product?.id === productId ? { ...row, quantity } : row));
    },
    async remove(productId) {
      if (user && serverItems.some(row => row.product?.id === productId)) {
        await removeItem.mutateAsync({ productId }); await refresh();
      }
      removeGuest(productId);
    },
    clearAfterOrder() {
      setGuest([]);
      localStorage.removeItem(storageKey);
      qc.setQueryData(queryKey, []);
    },
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStoreCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("StoreCartProvider is required");
  return cart;
}