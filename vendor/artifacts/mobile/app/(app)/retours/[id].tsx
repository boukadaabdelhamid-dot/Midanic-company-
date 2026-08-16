import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useGetAdminRetour,
  getGetAdminRetourQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Card, Button, LoadingView, SectionTitle, Badge, Divider, ErrorState } from "@/components/ui";
import { colors } from "@/lib/colors";

export default function RetourDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useProtectedRoute({ section: "orders" });
  const { t, lang } = useLang();
  const currency = lang === "ar" ? "دج" : "DA";
  const retourId = Number(id);

  const { data: retour, isLoading, isError } = useGetAdminRetour(retourId, {
    query: { enabled: ready && !!retourId, queryKey: getGetAdminRetourQueryKey(retourId) },
  });

  if (!ready) return null;
  if (isLoading) return <LoadingView />;
  if (isError || !retour) return <ErrorState title={t("Retour introuvable", "المرتجع غير موجود")} />;

  const items = (retour.items ?? []) as any[];
  const typeLabel = retour.retourType === "remboursement"
    ? t("Avec remboursement", "مع استرداد المبلغ")
    : retour.retourType === "sans_remboursement"
      ? t("Sans remboursement", "بدون استرداد")
      : retour.retourType ?? "—";

  return (
    <Screen>
      <Card>
        <SectionTitle>{t("Retour", "المرتجع")} #{retour.id}</SectionTitle>
        <Badge label={typeLabel} />
        <Divider />
        <Row label={t("Date", "التاريخ")} value={formatDate(retour.createdAt, lang)} />
        <Row label={t("Client", "الزبون")} value={retour.clientName ?? retour.originalOrder?.customerName ?? "—"} />
        {retour.originalOrderId ? (
          <Row label={t("Commande d'origine", "الطلب الأصلي")} value={`#${retour.originalOrderId}`} />
        ) : null}
        {retour.reason ? <Row label={t("Motif", "السبب")} value={retour.reason} /> : null}
      </Card>

      <Card>
        <SectionTitle>{t("Articles retournés", "المنتجات المرتجعة")}</SectionTitle>
        {items.length === 0 ? (
          <Text style={styles.muted}>{t("Aucun article", "لا توجد منتجات")}</Text>
        ) : (
          items.map((item, index) => (
            <View key={item.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {(lang === "ar" ? item.product?.nameAr : item.product?.nameEn) ?? `#${item.productId ?? "?"}`}
                </Text>
                <Text style={styles.itemAmount}>
                  x{item.quantity ?? 0} · {Number(item.unitPrice ?? 0).toLocaleString("fr-FR")} {currency}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("Total", "الإجمالي")}</Text>
          <Text style={styles.totalValue}>{Number(retour.totalAmount ?? 0).toLocaleString("fr-FR")} {currency}</Text>
        </View>
      </Card>

      {retour.originalOrderId ? (
        <Button
          label={t("Voir la commande d'origine", "عرض الطلب الأصلي")}
          variant="secondary"
          onPress={() => router.push(`/orders/${retour.originalOrderId}` as never)}
          testID="button-open-original-order"
        />
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function formatDate(value: string | undefined, lang: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR");
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "right" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingVertical: 8 },
  itemName: { flex: 1, color: colors.text, fontSize: 14 },
  itemAmount: { color: colors.textMuted, fontSize: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  totalValue: { color: colors.primary, fontSize: 18, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 13 },
});