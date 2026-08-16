import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useGetErpCustomer,
  useGetCustomerOperations,
  useGetAdminRetours,
  getGetErpCustomerQueryKey,
  getGetCustomerOperationsQueryKey,
  getGetAdminRetoursQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Card, LoadingView, SectionTitle, Divider, ErrorState } from "@/components/ui";
import { colors } from "@/lib/colors";
import { getContactBalance } from "@/lib/contact-balance";
import { ContactHistoryRow } from "@/components/ContactHistoryRow";

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "customers" });
  const { t, lang } = useLang();
  const currency = lang === "ar" ? "دج" : "DA";
  const customerId = Number(id);
  const canViewOrders = isAdmin || can("orders", "view");

  const { data: customer, isLoading, isError } = useGetErpCustomer(customerId, {
    query: { enabled: ready && !!customerId, queryKey: getGetErpCustomerQueryKey(customerId) },
  });
  const { data: ops } = useGetCustomerOperations(customerId, undefined, {
    query: { enabled: ready && !!customerId, queryKey: getGetCustomerOperationsQueryKey(customerId) },
  });
  const { data: allRetours } = useGetAdminRetours({
    query: {
      enabled: ready && !!customerId && canViewOrders,
      queryKey: getGetAdminRetoursQueryKey(),
    },
  });

  if (!ready) return null;
  if (isLoading) return <LoadingView />;
  if (isError || !customer) return <ErrorState title={t("Client introuvable", "العميل غير موجود")} />;

  const c = customer as any;
  const balance = getContactBalance(c);
  const orders = Array.isArray(c.orders) ? c.orders : [];
  const orderIds = new Set(orders.map((order: any) => Number(order.id)));
  const retours = ((allRetours ?? []) as any[]).filter(
    (retour) =>
      Number(retour.clientUserId) === customerId ||
      (retour.originalOrderId != null && orderIds.has(Number(retour.originalOrderId))),
  );
  const operations = Array.isArray(ops) ? (ops as any[]) : [];

  return (
    <Screen>
      <Card>
        <SectionTitle>{c.name}</SectionTitle>
        <Text style={styles.label}>{t("Téléphone", "الهاتف")}</Text>
        <Text style={styles.value}>{c.phone ?? "—"}</Text>
        <Text style={styles.label}>{t("Email", "البريد الإلكتروني")}</Text>
        <Text style={styles.value}>{c.email ?? "—"}</Text>
        <Text style={styles.label}>{t("Adresse", "العنوان")}</Text>
        <Text style={styles.value}>{c.address ?? "—"}</Text>
      </Card>

      <Card>
        <SectionTitle>{t("Solde", "الرصيد")}</SectionTitle>
        <Text style={[styles.balance, { color: balance < 0 ? colors.danger : colors.primary }]}>
          {balance.toLocaleString("fr-FR")} {currency}
        </Text>
      </Card>

      <Card>
        <SectionTitle>{t("Historique des ventes", "سجل المبيعات")}</SectionTitle>
        {orders.length === 0 ? (
          <Text style={styles.muted}>{t("Aucune vente", "لا توجد مبيعات")}</Text>
        ) : (
          orders.map((order: any, index: number) => (
            <View key={order.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={`${t("Vente", "بيع")} #${order.id} · ${order.status ?? "—"}`}
                subtitle={formatDate(order.createdAt, lang)}
                amount={`${Number(order.totalAmount ?? 0).toLocaleString("fr-FR")} ${currency}`}
                onPress={canViewOrders ? () => router.push(`/orders/${order.id}` as never) : undefined}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>{t("Retours", "المرتجعات")}</SectionTitle>
        {!canViewOrders ? (
          <Text style={styles.muted}>{t("Permission ventes requise", "تحتاج إلى صلاحية عرض المبيعات")}</Text>
        ) : retours.length === 0 ? (
          <Text style={styles.muted}>{t("Aucun retour", "لا توجد مرتجعات")}</Text>
        ) : (
          retours.map((retour: any, index: number) => (
            <View key={retour.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={`${t("Retour", "مرتجع")} #${retour.id} · ${returnTypeLabel(retour.retourType, t)}`}
                subtitle={`${formatDate(retour.createdAt, lang)}${retour.reason ? ` · ${retour.reason}` : ""}`}
                amount={`${Number(retour.totalAmount ?? 0).toLocaleString("fr-FR")} ${currency}`}
                onPress={() => router.push(`/retours/${retour.id}` as never)}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>{t("Paiements et opérations", "الدفعات والعمليات")}</SectionTitle>
        {operations.length === 0 ? (
          <Text style={styles.muted}>{t("Aucune opération", "لا توجد عمليات")}</Text>
        ) : (
          operations.slice(0, 50).map((op: any, index: number) => (
            <View key={op.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={customerOperationLabel(op.type, t)}
                subtitle={[
                  formatDate(op.date ?? op.createdAt, lang),
                  op.reference ? `${t("Réf.", "المرجع")} ${op.reference}` : null,
                  op.note,
                  op.balanceAfter != null
                    ? `${t("Solde après", "الرصيد بعد العملية")}: ${Number(op.balanceAfter).toLocaleString("fr-FR")} ${currency}`
                    : null,
                ].filter(Boolean).join(" · ")}
                amount={`${operationSign(op.type)}${Number(op.amount ?? 0).toLocaleString("fr-FR")} ${currency}`}
              />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function formatDate(value: string | undefined, lang: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR");
}

function returnTypeLabel(type: string | null | undefined, t: (fr: string, ar: string) => string) {
  if (type === "remboursement") return t("avec remboursement", "مع استرداد");
  if (type === "sans_remboursement") return t("sans remboursement", "بدون استرداد");
  return type ?? "—";
}

function customerOperationLabel(type: string | undefined, t: (fr: string, ar: string) => string) {
  switch (type) {
    case "versement": return t("Versement client", "دفع الزبون");
    case "remboursement": return t("Remboursement", "استرداد مبلغ");
    case "vente_a_terme": return t("Vente à terme", "بيع آجل");
    case "avoir_retour": return t("Avoir retour", "رصيد مرتجع");
    case "ajustement": return t("Ajustement", "تسوية");
    default: return type ?? "—";
  }
}

function operationSign(type: string | undefined) {
  return type === "versement" || type === "avoir_retour" ? "−" : "+";
}

const styles = StyleSheet.create({
  label: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  value: { fontSize: 14, color: colors.text, fontWeight: "500" },
  muted: { fontSize: 13, color: colors.textMuted },
  balance: { fontSize: 22, fontWeight: "700" },
  opRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
});
