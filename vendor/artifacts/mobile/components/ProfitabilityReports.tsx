import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  getGetAnalyticsQueryKey,
  getGetCustomerProfitReportQueryKey,
  getGetMonthlyReportQueryKey,
  getGetProductProfitReportQueryKey,
  getGetSupplierReportQueryKey,
  useGetAnalytics,
  useGetCustomerProfitReport,
  useGetMonthlyReport,
  useGetProductProfitReport,
  useGetSupplierReport,
  type CustomerProfitRow,
  type MonthlyReportRow,
  type ProductProfitRow,
  type SupplierReportRow,
} from "@workspace/api-client-react";
import { useLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Card, ErrorState, LoadingView, SectionTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { colors } from "@/lib/colors";

type ReportTab = "monthly" | "product" | "customer" | "supplier";
type RangeDays = 7 | 30 | 90 | 365;
type IconName = keyof typeof Feather.glyphMap;

const TABS: { key: ReportTab; icon: IconName; fr: string; ar: string }[] = [
  { key: "monthly", icon: "calendar", fr: "Par mois", ar: "حسب الشهر" },
  { key: "product", icon: "box", fr: "Par produit", ar: "حسب المنتج" },
  { key: "customer", icon: "users", fr: "Par client", ar: "حسب العميل" },
  { key: "supplier", icon: "truck", fr: "Par fournisseur", ar: "حسب المورد" },
];

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function formatAmount(value: number | null | undefined, currency: string) {
  return `${Number(value ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`;
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatDate(value: string, lang: "fr" | "ar") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR");
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function TabButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
      testID={`report-tab-${icon}`}
    >
      <Feather name={icon} size={17} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function SimpleBarList({
  title,
  rows,
  currency,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; value: number }[];
  currency: string;
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map((row) => Math.max(row.value, 0)), 0);
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <Text style={styles.muted}>{emptyLabel}</Text>
      ) : (
        <View style={styles.barList}>
          {rows.map((row) => (
            <View key={row.label} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={2}>{row.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: max > 0 ? `${Math.max(4, (Math.max(row.value, 0) / max) * 100)}%` : "4%" },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{formatAmount(row.value, currency)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function MonthlyView({
  rows,
  currency,
  lang,
  emptyLabel,
}: {
  rows: MonthlyReportRow[];
  currency: string;
  lang: "fr" | "ar";
  emptyLabel: string;
}) {
  const max = Math.max(
    ...rows.flatMap((row) => [row.totalRevenue, row.grossProfit, row.totalExpenses, row.netProfit].map((value) => Math.max(value, 0))),
    0,
  );
  return (
    <>
      <Card>
        <SectionTitle>{lang === "ar" ? "تطور رقم الأعمال والأرباح" : "Évolution mensuelle — CA vs bénéfice"}</SectionTitle>
        {rows.length === 0 ? (
          <Text style={styles.muted}>{emptyLabel}</Text>
        ) : (
          <>
            <View style={styles.monthChart}>
              {rows.map((row) => (
                <View key={row.month} style={styles.monthGroup}>
                  <Text style={styles.monthLabel}>{row.month}</Text>
                  <View style={styles.monthBars}>
                    {[
                      { value: row.totalRevenue, color: colors.primary },
                      { value: row.grossProfit, color: colors.info },
                      { value: row.totalExpenses, color: colors.danger },
                      { value: row.netProfit, color: colors.success },
                    ].map((bar, index) => (
                      <View key={`${row.month}-${index}`} style={styles.monthBarTrack}>
                        <View
                          style={[
                            styles.monthBar,
                            { height: max > 0 ? Math.max(4, (Math.max(bar.value, 0) / max) * 110) : 4, backgroundColor: bar.color },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <Legend color={colors.primary} label={lang === "ar" ? "رقم الأعمال" : "CA"} />
              <Legend color={colors.info} label={lang === "ar" ? "الربح الإجمالي" : "Bénéf. brut"} />
              <Legend color={colors.danger} label={lang === "ar" ? "المصاريف" : "Charges"} />
              <Legend color={colors.success} label={lang === "ar" ? "الربح الصافي" : "Bénéf. net"} />
            </View>
          </>
        )}
      </Card>
      <Card>
        <SectionTitle>{lang === "ar" ? "التفصيل الشهري" : "Détail mensuel"}</SectionTitle>
        {rows.map((row) => (
          <View key={row.month} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{row.month}</Text>
            <View style={styles.metricsGrid}>
              <Metric label={lang === "ar" ? "رقم الأعمال" : "Chiffre d'affaires"} value={formatAmount(row.totalRevenue, currency)} />
              <Metric label="COGS" value={formatAmount(row.totalCogs, currency)} />
              <Metric label={lang === "ar" ? "المرتجعات" : "Retours"} value={formatAmount(row.totalRetours, currency)} color={colors.warning} />
              <Metric label={lang === "ar" ? "المصاريف" : "Charges"} value={formatAmount(row.totalExpenses, currency)} color={colors.danger} />
              <Metric label={lang === "ar" ? "الربح الإجمالي" : "Bénéfice brut"} value={formatAmount(row.grossProfit, currency)} color={colors.success} />
              <Metric label={lang === "ar" ? "الهامش" : "Marge"} value={formatPercent(row.grossMargin)} color={colors.success} />
              <Metric label={lang === "ar" ? "الربح الصافي" : "Bénéfice net"} value={formatAmount(row.netProfit, currency)} color={colors.primary} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function ProductView({ rows, currency, lang, emptyLabel }: { rows: ProductProfitRow[]; currency: string; lang: "fr" | "ar"; emptyLabel: string }) {
  return (
    <>
      <SimpleBarList
        title={lang === "ar" ? "أفضل 10 — الربح الإجمالي" : "Top 10 — Bénéfice brut"}
        rows={rows.slice(0, 10).map((row) => ({ label: lang === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr, value: row.grossProfit }))}
        currency={currency}
        emptyLabel={emptyLabel}
      />
      <Card>
        <SectionTitle>{lang === "ar" ? "تفصيل المنتجات" : "Détail par produit"}</SectionTitle>
        {rows.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
        {rows.slice(0, 50).map((row) => (
          <View key={row.id} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{lang === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr}</Text>
            {row.reference ? <Text style={styles.detailSubtitle}>{row.reference}</Text> : null}
            <View style={styles.metricsGrid}>
              <Metric label={lang === "ar" ? "المباع" : "Vendu"} value={String(row.totalSold)} />
              <Metric label={lang === "ar" ? "رقم الأعمال" : "CA"} value={formatAmount(row.totalRevenue, currency)} />
              <Metric label="COGS" value={formatAmount(row.totalCogs, currency)} />
              <Metric label={lang === "ar" ? "الربح الإجمالي" : "Bénéfice brut"} value={formatAmount(row.grossProfit, currency)} color={colors.success} />
              <Metric label={lang === "ar" ? "الهامش" : "Marge"} value={formatPercent(row.grossMargin)} color={colors.success} />
              <Metric label={lang === "ar" ? "المخزون" : "Stock"} value={String(row.stock)} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function CustomerView({ rows, currency, lang, emptyLabel }: { rows: CustomerProfitRow[]; currency: string; lang: "fr" | "ar"; emptyLabel: string }) {
  return (
    <>
      <SimpleBarList
        title={lang === "ar" ? "أفضل 10 — ربح العملاء" : "Top 10 — Bénéfice client"}
        rows={rows.slice(0, 10).map((row) => ({ label: row.name, value: row.grossProfit }))}
        currency={currency}
        emptyLabel={emptyLabel}
      />
      <Card>
        <SectionTitle>{lang === "ar" ? "تفصيل العملاء" : "Détail par client"}</SectionTitle>
        {rows.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
        {rows.slice(0, 50).map((row) => (
          <View key={row.id} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{row.name}</Text>
            {row.wilaya ? <Text style={styles.detailSubtitle}>{row.wilaya}</Text> : null}
            <View style={styles.metricsGrid}>
              <Metric label={lang === "ar" ? "الطلبات" : "Commandes"} value={String(row.totalOrders)} />
              <Metric label={lang === "ar" ? "رقم الأعمال" : "CA"} value={formatAmount(row.totalRevenue, currency)} />
              <Metric label="COGS" value={formatAmount(row.totalCogs, currency)} />
              <Metric label={lang === "ar" ? "الربح الإجمالي" : "Bénéfice brut"} value={formatAmount(row.grossProfit, currency)} color={colors.success} />
              <Metric label={lang === "ar" ? "الهامش" : "Marge"} value={formatPercent(row.grossMargin)} color={colors.success} />
              <Metric label={lang === "ar" ? "الرصيد" : "Solde"} value={formatAmount(row.currentBalance, currency)} color={row.currentBalance > 0 ? colors.danger : colors.success} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function SupplierView({ rows, currency, lang, emptyLabel }: { rows: SupplierReportRow[]; currency: string; lang: "fr" | "ar"; emptyLabel: string }) {
  return (
    <>
      <SimpleBarList
        title={lang === "ar" ? "أفضل 10 — المشتريات حسب المورد" : "Top 10 — Achats par fournisseur"}
        rows={rows.slice(0, 10).map((row) => ({ label: row.name, value: row.totalPurchased }))}
        currency={currency}
        emptyLabel={emptyLabel}
      />
      <Card>
        <SectionTitle>{lang === "ar" ? "تفصيل الموردين" : "Détail par fournisseur"}</SectionTitle>
        {rows.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
        {rows.slice(0, 50).map((row) => (
          <View key={row.id} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{row.name}</Text>
            {row.contactName ? <Text style={styles.detailSubtitle}>{row.contactName}</Text> : null}
            <View style={styles.metricsGrid}>
              <Metric label={lang === "ar" ? "أوامر الشراء" : "Bons"} value={String(row.totalPos)} />
              <Metric label={lang === "ar" ? "المشتريات" : "Acheté"} value={formatAmount(row.totalPurchased, currency)} />
              <Metric label={lang === "ar" ? "المستلم" : "Reçu"} value={formatAmount(row.totalReceived, currency)} />
              <Metric label={lang === "ar" ? "المنتجات" : "Produits"} value={String(row.distinctProducts)} />
              <Metric label={lang === "ar" ? "متوسط التكلفة" : "Coût moyen"} value={formatAmount(row.avgUnitCost, currency)} />
              <Metric label={lang === "ar" ? "المستحق" : "À payer"} value={formatAmount(row.currentBalance, currency)} color={row.currentBalance > 0 ? colors.danger : colors.success} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

export default function ProfitabilityReports({ ready }: { ready: boolean }) {
  const { t, lang } = useLang();
  const currency = lang === "ar" ? "دج" : "DA";
  const today = new Date();
  const [fromDate, setFromDate] = useState<Date>(subtractDays(today, 29));
  const [toDate, setToDate] = useState<Date>(today);
  const [range, setRange] = useState<RangeDays | null>(30);
  const [tab, setTab] = useState<ReportTab>("monthly");

  const params = useMemo(() => ({ from: dateOnly(fromDate), to: dateOnly(toDate) }), [fromDate, toDate]);
  const invalidPeriod = toDate < fromDate;
  const queryEnabled = ready && !invalidPeriod;

  const analyticsQuery = useGetAnalytics({
    query: { enabled: ready, queryKey: getGetAnalyticsQueryKey() },
  });
  const monthlyQuery = useGetMonthlyReport(params, {
    query: { enabled: queryEnabled, queryKey: getGetMonthlyReportQueryKey(params) },
  });
  const productQuery = useGetProductProfitReport(params, {
    query: { enabled: queryEnabled && tab === "product", queryKey: getGetProductProfitReportQueryKey(params) },
  });
  const customerQuery = useGetCustomerProfitReport(params, {
    query: { enabled: queryEnabled && tab === "customer", queryKey: getGetCustomerProfitReportQueryKey(params) },
  });
  const supplierQuery = useGetSupplierReport(params, {
    query: { enabled: queryEnabled && tab === "supplier", queryKey: getGetSupplierReportQueryKey(params) },
  });

  const setQuickRange = (days: RangeDays) => {
    const end = new Date();
    setRange(days);
    setToDate(end);
    setFromDate(subtractDays(end, days - 1));
  };

  const refresh = () => {
    analyticsQuery.refetch();
    monthlyQuery.refetch();
    if (tab === "product") productQuery.refetch();
    if (tab === "customer") customerQuery.refetch();
    if (tab === "supplier") supplierQuery.refetch();
  };

  const analytics = analyticsQuery.data;
  const stats = analytics
    ? [
        { label: t("Commandes", "الطلبات"), value: String(analytics.totalOrders) },
        { label: t("Chiffre d'affaires", "رقم الأعمال"), value: formatAmount(analytics.totalRevenue, currency) },
        { label: t("Coût des ventes", "تكلفة المبيعات"), value: formatAmount(analytics.totalCogs, currency) },
        { label: t("Retours", "المرتجعات"), value: formatAmount(analytics.totalRetours, currency), color: colors.warning },
        { label: t("Charges", "المصاريف"), value: formatAmount(analytics.totalExpenses, currency), color: colors.danger },
        { label: t("Bénéfice brut", "الربح الإجمالي"), value: formatAmount(analytics.grossProfit, currency), color: colors.success },
        { label: t("Marge brute", "الهامش الإجمالي"), value: formatPercent(analytics.grossMargin) },
        { label: t("Bénéfice net", "صافي الربح"), value: formatAmount(analytics.netProfit, currency), color: colors.primary },
        { label: t("Valeur du stock", "قيمة المخزون"), value: formatAmount(analytics.inventoryValue, currency) },
        { label: t("Dette clients", "ديون العملاء"), value: formatAmount(analytics.customerDebt, currency), color: colors.danger },
        { label: t("Dettes fournisseurs", "ديون الموردين"), value: formatAmount(analytics.supplierPayables, currency), color: colors.danger },
        { label: t("Commandes en attente", "الطلبات المعلقة"), value: String(analytics.pendingOrders) },
      ]
    : [];

  const activeQuery =
    tab === "monthly" ? monthlyQuery :
    tab === "product" ? productQuery :
    tab === "customer" ? customerQuery : supplierQuery;

  return (
    <Screen onRefresh={refresh} refreshing={analyticsQuery.isRefetching || activeQuery.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Rapports de rentabilité", "تقارير الربحية")}</Text>
        <Text style={styles.subtitle}>{t("Analyse des marges et des flux par période", "تحليل الهوامش والتدفقات حسب الفترة")}</Text>
      </View>

      <Card>
        <View style={styles.rangeButtons}>
          {([7, 30, 90, 365] as RangeDays[]).map((days) => (
            <Pressable
              key={days}
              onPress={() => setQuickRange(days)}
              style={[styles.rangeButton, range === days && styles.rangeButtonActive]}
              testID={`button-report-range-${days}`}
            >
              <Text style={[styles.rangeButtonText, range === days && styles.rangeButtonTextActive]}>
                {days}{"\n"}{t("jours", "يومًا")}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <DateField label={t("Du", "من")} value={fromDate} onChange={(date) => { setRange(null); setFromDate(date); }} maximumDate={toDate} />
          </View>
          <View style={styles.dateColumn}>
            <DateField label={t("Au", "إلى")} value={toDate} onChange={(date) => { setRange(null); setToDate(date); }} minimumDate={fromDate} />
          </View>
        </View>
        {invalidPeriod ? <Text style={styles.errorText}>{t("La période est invalide", "الفترة غير صحيحة")}</Text> : null}
      </Card>

      <Card>
        <SectionTitle>{t("Analyse (30 derniers jours)", "التحليلات (آخر 30 يومًا)")}</SectionTitle>
        {analyticsQuery.isLoading ? (
          <LoadingView />
        ) : (
          <View style={styles.summaryList}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{stat.label}</Text>
                <Text style={[styles.summaryValue, stat.color ? { color: stat.color } : null]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((item) => (
          <TabButton key={item.key} active={tab === item.key} icon={item.icon} label={t(item.fr, item.ar)} onPress={() => setTab(item.key)} />
        ))}
      </ScrollView>

      {!queryEnabled ? (
        <ErrorState title={t("Période invalide", "الفترة غير صحيحة")} />
      ) : activeQuery.isLoading ? (
        <LoadingView />
      ) : tab === "monthly" ? (
        <MonthlyView rows={monthlyQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucune donnée pour cette période", "لا توجد بيانات لهذه الفترة")} />
      ) : tab === "product" ? (
        <ProductView rows={productQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucun produit pour cette période", "لا توجد منتجات لهذه الفترة")} />
      ) : tab === "customer" ? (
        <CustomerView rows={customerQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucun client pour cette période", "لا يوجد عملاء لهذه الفترة")} />
      ) : (
        <SupplierView rows={supplierQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucun fournisseur pour cette période", "لا يوجد موردون لهذه الفترة")} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  rangeButtons: { flexDirection: "row", gap: 8, marginBottom: 12 },
  rangeButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 58, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  rangeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeButtonText: { color: colors.primary, fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 19 },
  rangeButtonTextActive: { color: colors.surface },
  dateRow: { flexDirection: "row", gap: 10 },
  dateColumn: { flex: 1, minWidth: 0 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 4 },
  summaryList: { gap: 0 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  summaryLabel: { flex: 1, color: colors.textMuted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: "800", textAlign: "right" },
  tabs: { gap: 8, paddingVertical: 2 },
  tabButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  tabButtonActive: { backgroundColor: colors.surface, borderColor: colors.primary, shadowColor: colors.text, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: colors.primary },
  metric: { width: "48%", marginBottom: 12 },
  metricLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 3 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 14, paddingVertical: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 11, height: 11, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  monthChart: { flexDirection: "row", alignItems: "flex-end", minHeight: 150, gap: 12, paddingTop: 12 },
  monthGroup: { flex: 1, alignItems: "center", gap: 7 },
  monthBars: { height: 120, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  monthBarTrack: { width: 9, height: 115, justifyContent: "flex-end" },
  monthBar: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  monthLabel: { color: colors.textMuted, fontSize: 11 },
  detailCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 13 },
  detailTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  detailSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10 },
  barList: { gap: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 92, color: colors.text, fontSize: 11, fontWeight: "600" },
  barTrack: { flex: 1, height: 14, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5, backgroundColor: colors.primary },
  barValue: { width: 78, color: colors.textMuted, fontSize: 10, fontWeight: "700", textAlign: "right" },
});