import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useGetSupplierOperations,
  useGetSuppliers,
  getGetSuppliersQueryKey,
  getGetSupplierOperationsQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Card, Button, LoadingView, SectionTitle, Divider, ErrorState } from "@/components/ui";
import { colors } from "@/lib/colors";
import { getContactBalance } from "@/lib/contact-balance";
import { ContactHistoryRow } from "@/components/ContactHistoryRow";

export default function SupplierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "suppliers" });
  const { t, lang } = useLang();
  const currency = lang === "ar" ? "دج" : "DA";
  const supplierId = Number(id);

  // No single-supplier GET endpoint is generated; look it up from the list.
  const { data: list, isLoading } = useGetSuppliers({
    query: { enabled: ready, queryKey: getGetSuppliersQueryKey() },
  });
  const supplier = ((list as unknown as { data?: any[] })?.data ?? []).find((s: any) => s.id === supplierId);
  const { data: ops, isLoading: operationsLoading } = useGetSupplierOperations(supplierId, {
    query: { enabled: ready && !!supplierId, queryKey: getGetSupplierOperationsQueryKey(supplierId) },
  });

  if (!ready) return null;
  if (isLoading) return <LoadingView />;
  if (!supplier) return <ErrorState title={t("Fournisseur introuvable", "المورد غير موجود")} />;

  const canEdit = isAdmin || can("suppliers", "edit");
  const canViewPurchases = isAdmin || can("purchases", "view");
  const operations = Array.isArray((ops as any)?.operations) ? (ops as any).operations : [];
  const balance = Number((ops as any)?.contactBalance ?? getContactBalance(supplier));
  const purchases = operations.filter((operation: any) => operation.type === "purchase" && operation.source !== "customer");
  const financialOperations = operations.filter((operation: any) => operation.type !== "purchase" || operation.source === "customer");

  return (
    <Screen>
      <Card>
        <SectionTitle>{supplier.name}</SectionTitle>
        <Row label={t("Téléphone", "الهاتف")} value={supplier.phone ?? "—"} />
        <Row label={t("Email", "البريد الإلكتروني")} value={supplier.email ?? "—"} />
        <Row label={t("Adresse", "العنوان")} value={supplier.address ?? "—"} />
      </Card>

      {canEdit ? (
        <Button
          label={t("Modifier le fournisseur", "تعديل المورد")}
          variant="secondary"
          onPress={() => router.push(`/suppliers/${supplierId}/edit` as never)}
          testID="button-edit-supplier"
        />
      ) : null}

      <Card>
        <SectionTitle>{t("Solde dû", "الرصيد المستحق")}</SectionTitle>
        <Text style={[styles.balance, { color: balance > 0 ? colors.danger : colors.primary }]}>
          {balance.toLocaleString("fr-FR")} {currency}
        </Text>
      </Card>

      <Card>
        <SectionTitle>{t("Historique des achats", "سجل المشتريات")}</SectionTitle>
        {operationsLoading ? (
          <Text style={styles.muted}>{t("Chargement...", "جار التحميل...")}</Text>
        ) : purchases.length === 0 ? (
          <Text style={styles.muted}>{t("Aucun achat", "لا توجد مشتريات")}</Text>
        ) : (
          purchases.slice(0, 50).map((operation: any, index: number) => (
            <View key={`${operation.source ?? "supplier"}-${operation.id ?? index}`}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={`${t("Achat", "شراء")} ${operation.poId ? `#${operation.poId}` : `#${operation.id}`}`}
                subtitle={[
                  formatDate(operation.date ?? operation.createdAt, lang),
                  operation.reference ? `${t("Réf.", "المرجع")} ${operation.reference}` : null,
                  operation.note,
                  operation.balanceAfter != null
                    ? `${t("Solde après", "الرصيد بعد العملية")}: ${Number(operation.balanceAfter).toLocaleString("fr-FR")} ${currency}`
                    : null,
                ].filter(Boolean).join(" · ")}
                amount={`+${Number(operation.amount ?? 0).toLocaleString("fr-FR")} ${currency}`}
                onPress={canViewPurchases && operation.poId
                  ? () => router.push(`/purchase-orders/${operation.poId}` as never)
                  : undefined}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>{t("Paiements et opérations", "الدفعات والعمليات")}</SectionTitle>
        {operationsLoading ? (
          <Text style={styles.muted}>{t("Chargement...", "جار التحميل...")}</Text>
        ) : financialOperations.length === 0 ? (
          <Text style={styles.muted}>{t("Aucune opération", "لا توجد عمليات")}</Text>
        ) : (
          financialOperations.slice(0, 50).map((operation: any, index: number) => (
            <View key={`${operation.source ?? "supplier"}-${operation.id ?? index}`}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={supplierOperationLabel(operation, t)}
                subtitle={[
                  formatDate(operation.date ?? operation.createdAt, lang),
                  operation.reference ? `${t("Réf.", "المرجع")} ${operation.reference}` : null,
                  operation.note,
                  operation.balanceAfter != null
                    ? `${t("Solde après", "الرصيد بعد العملية")}: ${Number(operation.balanceAfter).toLocaleString("fr-FR")} ${currency}`
                    : null,
                ].filter(Boolean).join(" · ")}
                amount={`${supplierOperationSign(operation)}${Number(operation.amount ?? 0).toLocaleString("fr-FR")} ${currency}`}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>{t("Retours fournisseur", "مرتجعات المورد")}</SectionTitle>
        <Text style={styles.muted}>
          {t(
            "L'historique des retours fournisseur n'est pas disponible dans le service actuel.",
            "سجل مرتجعات المورد غير متاح حاليًا من الخدمة.",
          )}
        </Text>
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

function supplierOperationLabel(
  operation: { source?: string; type?: string },
  t: (fr: string, ar: string) => string,
) {
  if (operation.source === "customer") {
    switch (operation.type) {
      case "versement": return t("Versement client", "دفع الزبون");
      case "remboursement": return t("Remboursement client", "استرداد مبلغ الزبون");
      case "avoir_retour": return t("Avoir retour client", "رصيد مرتجع للزبون");
      case "vente_a_terme": return t("Vente à terme client", "بيع آجل للزبون");
      default: return operation.type ?? "—";
    }
  }
  switch (operation.type) {
    case "payment": return t("Paiement fournisseur", "دفع للمورد");
    case "ajustement": return t("Ajustement fournisseur", "تسوية المورد");
    default: return operation.type ?? "—";
  }
}

function supplierOperationSign(operation: { source?: string; type?: string }) {
  if (operation.source === "customer") {
    return operation.type === "versement" || operation.type === "avoir_retour" ? "−" : "+";
  }
  return operation.type === "purchase" ? "+" : "−";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  balance: { fontSize: 22, fontWeight: "700" },
  muted: { fontSize: 13, color: colors.textMuted },
});
