import { useEffect } from "react";
import { useGetErpStoresMine, type Store } from "@workspace/erp-api-client-react";
import { useStoreContext } from "./use-store";

type StoreWithKind = Store & { kind?: "store" | "factory" };

/**
 * Returns the full Store object (with profile fields like address/logoUrl/tvaRate)
 * for the user's currently active store. Uses the staff-safe `/erp/stores/mine`
 * endpoint so non-admin employees can also retrieve store profile/branding for
 * invoice printing.
 */
export function useCurrentStore(): Store | null {
  const { currentStoreId, stores: contextStores, setStores } = useStoreContext();
  const { data: stores } = useGetErpStoresMine();
  useEffect(() => {
    if (!stores) return;
    const typedStores = stores as StoreWithKind[];
    const needsHydration = typedStores.some((serverStore) =>
      serverStore.kind && contextStores.find((store) => store.id === serverStore.id)?.kind !== serverStore.kind
    );
    if (contextStores.length === 0 || needsHydration) {
      setStores(typedStores, currentStoreId);
    }
  }, [contextStores, currentStoreId, setStores, stores]);
  if (!currentStoreId || !stores) return null;
  return (stores as StoreWithKind[]).find((s) => s.id === currentStoreId) ?? null;
}
