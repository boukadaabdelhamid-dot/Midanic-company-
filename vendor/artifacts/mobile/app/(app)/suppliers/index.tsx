import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useGetSuppliers, getGetSuppliersQueryKey } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { ListScreen, SearchBar } from "@/components/ListScreen";
import { EntityRow } from "@/components/EntityRow";
import { Badge } from "@/components/ui";
import { Fab } from "@/components/Fab";
import { getContactBalance } from "@/lib/contact-balance";

export default function SuppliersList() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "suppliers" });
  const { t, lang } = useLang();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const currency = lang === "ar" ? "دج" : "DA";

  const { data, isLoading, refetch, isRefetching } = useGetSuppliers({
    query: { enabled: ready, queryKey: getGetSuppliersQueryKey() },
  });
  const suppliers = ((data as unknown as { data?: unknown[] })?.data ?? []) as any[];

  if (!ready) return null;
  const canCreate = isAdmin || can("suppliers", "create");

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={suppliers}
        isLoading={isLoading}
        onRefresh={refetch}
        refreshing={isRefetching}
        keyExtractor={(s: any) => String(s.id)}
        emptyTitle={t("Aucun fournisseur", "لا يوجد موردون")}
        header={<SearchBar value={search} onChangeText={setSearch} placeholder={t("Rechercher...", "بحث...")} />}
        renderItem={(s: any) => (
          <EntityRow
            onPress={() => router.push(`/suppliers/${s.id}` as never)}
            title={s.name}
            subtitle={s.phone ?? s.email ?? ""}
            right={
              <Badge
                label={`${getContactBalance(s).toLocaleString("fr-FR")} ${currency}`}
                tone={getContactBalance(s) > 0 ? "danger" : "success"}
              />
            }
          />
        )}
      />
      {canCreate ? <Fab onPress={() => router.push("/suppliers/new" as never)} testID="button-new-supplier" /> : null}
    </View>
  );
}
