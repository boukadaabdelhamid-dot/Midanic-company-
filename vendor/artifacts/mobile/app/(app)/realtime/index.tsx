import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useGetAdminOrders, getGetAdminOrdersQueryKey, type Order } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Badge, Card, EmptyState, ErrorState, LoadingView } from "@/components/ui";
import { colors } from "@/lib/colors";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  pending: "warning",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
};

function formatDa(value: number | string, lang: "fr" | "ar") {
  const amount = Number(value);
  const formatted = amount.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: 2,
  });
  return `${formatted} ${lang === "ar" ? "دج" : "DA"}`;
}

function isToday(dateValue: string | undefined) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function relativeTime(dateValue: string | undefined, lang: "fr" | "ar") {
  if (!dateValue) return "—";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 60000));
  if (elapsedMinutes < 1) return lang === "ar" ? "الآن" : "à l'instant";
  if (elapsedMinutes < 60) {
    return lang === "ar" ? `منذ ${elapsedMinutes} د` : `il y a ${elapsedMinutes} min`;
  }
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return lang === "ar" ? `منذ ${hours} س` : `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return lang === "ar" ? `منذ ${days} يوم` : `il y a ${days} j`;
}

function statusLabel(status: string, lang: "fr" | "ar") {
  const labels: Record<string, { fr: string; ar: string }> = {
    pending: { fr: "En attente", ar: "في الانتظار" },
    processing: { fr: "En cours", ar: "قيد المعالجة" },
    shipped: { fr: "Expédiée", ar: "تم الشحن" },
    delivered: { fr: "Livrée", ar: "تم التسليم" },
    cancelled: { fr: "Annulée", ar: "ملغاة" },
  };
  return labels[status]?.[lang] ?? status;
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  tone: "blue" | "green" | "yellow" | "purple";
}) {
  return (
    <View style={[styles.metricCard, styles[`metric${tone}`]]}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Feather
          name={icon}
          size={23}
          color={tone === "blue" ? "#2563EB" : tone === "green" ? "#059669" : tone === "yellow" ? "#D97706" : "#9333EA"}
        />
      </View>
      <Text style={[styles.metricValue, { color: tone === "blue" ? "#2563EB" : tone === "green" ? "#059669" : tone === "yellow" ? "#D97706" : "#9333EA" }]}>
        {value}
      </Text>
    </View>
  );
}

function OrderRow({ order, lang, onPress }: { order: Order; lang: "fr" | "ar"; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.orderRow, pressed && styles.pressed]}>
      <View style={styles.cartCircle}>
        <Feather name="shopping-cart" size={18} color="#64748B" />
      </View>
      <View style={styles.orderMain}>
        <View style={styles.orderTitleRow}>
          <Text style={styles.orderCustomer} numberOfLines={1}>
            {order.customerName || `#${order.id}`}
          </Text>
          <Badge label={statusLabel(order.status, lang)} tone={STATUS_TONE[order.status] ?? "muted"} />
        </View>
        <Text style={styles.orderSubtitle} numberOfLines={1}>
          #{order.id} · {order.customerPhone || "—"}
        </Text>
      </View>
      <View style={styles.orderRight}>
        <Text style={styles.orderAmount}>{formatDa(order.totalAmount, lang)}</Text>
        <Text style={styles.orderTime}>{relativeTime(order.createdAt, lang)}</Text>
      </View>
    </Pressable>
  );
}

export default function RealTime() {
  const { ready } = useProtectedRoute({ section: "realtime" });
  const { t, lang } = useLang();
  const router = useRouter();
  const {
    data: orders,
    isLoading,
    isError,
    refetch,
    isRefetching,
    dataUpdatedAt,
  } = useGetAdminOrders(undefined, {
    query: {
      enabled: ready,
      queryKey: getGetAdminOrdersQueryKey(),
      refetchInterval: 10_000,
      refetchOnWindowFocus: true,
    },
  });

  const stats = useMemo(() => {
    const allOrders = orders ?? [];
    const activeOrders = allOrders.filter((order) => order.status !== "cancelled");
    const todayOrders = activeOrders.filter((order) => isToday(order.createdAt));
    return {
      todayCount: todayOrders.length,
      todayRevenue: todayOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      pending: allOrders.filter((order) => order.status === "pending").length,
      inProgress: allOrders.filter((order) => order.status === "processing" || order.status === "shipped").length,
      delivered: allOrders.filter((order) => order.status === "delivered").length,
      total: allOrders.length,
    };
  }, [orders]);

  if (!ready) return null;

  return (
    <Screen onRefresh={() => { void refetch(); }} refreshing={isRefetching}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <View style={styles.titleLine}>
            <View style={styles.liveDot} />
            <Text style={styles.screenTitle}>{t("Temps Réel", "الوقت الفعلي")}</Text>
          </View>
          <Text style={styles.subtitle}>
            {t("Mise à jour automatique toutes les 10 secondes", "تحديث تلقائي كل 10 ثوانٍ")}
            {dataUpdatedAt
              ? ` · ${t("Dernière mise à jour", "آخر تحديث")} : ${new Date(dataUpdatedAt).toLocaleTimeString(lang === "ar" ? "ar-DZ" : "fr-FR")}`
              : ""}
          </Text>
        </View>
        <Pressable onPress={() => { void refetch(); }} style={styles.refreshButton} disabled={isRefetching}>
          <Feather name="refresh-cw" size={16} color={colors.textMuted} />
          <Text style={styles.refreshText}>{t("Actualiser", "تحديث")}</Text>
        </Pressable>
      </View>

      {isError ? (
        <ErrorState
          title={t("Impossible de charger les commandes", "تعذر تحميل الطلبات")}
          subtitle={t("Vérifiez votre accès aux commandes et la connexion au serveur.", "تحقق من صلاحية الطلبات واتصال الخادم.")}
        />
      ) : isLoading ? (
        <LoadingView label={t("Chargement des données...", "جار تحميل البيانات...")} />
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard label={t("Commandes aujourd'hui", "طلبات اليوم")} value={String(stats.todayCount)} icon="shopping-cart" tone="blue" />
            <MetricCard label={t("CA du jour", "رقم معاملات اليوم")} value={formatDa(stats.todayRevenue, lang)} icon="trending-up" tone="green" />
            <MetricCard label={t("En attente", "في الانتظار")} value={String(stats.pending)} icon="clock" tone="yellow" />
            <MetricCard label={t("Total commandes", "إجمالي الطلبات")} value={String(stats.total)} icon="users" tone="purple" />
          </View>

          <View style={styles.statusGrid}>
            <StatusCard label={t("En attente", "في الانتظار")} value={stats.pending} tone="pending" />
            <StatusCard label={t("En cours", "قيد المعالجة")} value={stats.inProgress} tone="progress" />
            <StatusCard label={t("Livrées", "تم التسليم")} value={stats.delivered} tone="delivered" />
          </View>

          <Card style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View style={styles.activityTitle}>
                <Feather name="activity" size={21} color="#10B981" />
                <Text style={styles.activityHeading}>{t("Activité récente", "النشاط الأخير")}</Text>
              </View>
              <Badge label={`${Math.min((orders ?? []).length, 15)} ${t("commandes", "طلبات")}`} tone="muted" />
            </View>
            {(orders ?? []).slice(0, 15).length === 0 ? (
              <EmptyState title={t("Aucune commande", "لا توجد طلبات")} />
            ) : (
              (orders ?? []).slice(0, 15).map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  lang={lang}
                  onPress={() => router.push(`/orders/${order.id}` as never)}
                />
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

function StatusCard({ label, value, tone }: { label: string; value: number; tone: "pending" | "progress" | "delivered" }) {
  const config = {
    pending: { color: "#F59E0B", background: "#FFF7E6" },
    progress: { color: "#3B82F6", background: "#EEF5FF" },
    delivered: { color: "#10B981", background: "#E8FBF3" },
  }[tone];
  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusCircle, { backgroundColor: config.color }]}>
        <Text style={styles.statusNumber}>{value}</Text>
      </View>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  headingCopy: { flex: 1 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  liveDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#10B981" },
  screenTitle: { color: colors.primary, fontSize: 25, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  refreshButton: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  refreshText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: { width: "48%", minHeight: 126, borderRadius: 13, borderWidth: 1, padding: 15, justifyContent: "space-between" },
  metricblue: { backgroundColor: "#EEF5FF", borderColor: "#D9E9FF" },
  metricgreen: { backgroundColor: "#E8FBF3", borderColor: "#C6F4DF" },
  metricyellow: { backgroundColor: "#FFFBEA", borderColor: "#FBE7A5" },
  metricpurple: { backgroundColor: "#FBF3FF", borderColor: "#EEDAFF" },
  metricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  metricLabel: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  metricValue: { fontSize: 27, fontWeight: "800", marginTop: 12 },
  statusGrid: { flexDirection: "row", gap: 12 },
  statusCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: "center", paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statusCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statusNumber: { color: "#fff", fontSize: 17, fontWeight: "800" },
  statusLabel: { color: colors.text, fontSize: 12, fontWeight: "600", textAlign: "center" },
  activityCard: { paddingHorizontal: 0, paddingVertical: 0, overflow: "hidden" },
  activityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 15 },
  activityTitle: { flexDirection: "row", alignItems: "center", gap: 9 },
  activityHeading: { color: colors.text, fontSize: 18, fontWeight: "800" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 13 },
  pressed: { backgroundColor: "#F8FAFC" },
  cartCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#E8EEF7", alignItems: "center", justifyContent: "center" },
  orderMain: { flex: 1, minWidth: 0, gap: 5 },
  orderTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderCustomer: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  orderSubtitle: { color: colors.textMuted, fontSize: 12 },
  orderRight: { alignItems: "flex-end", gap: 4, maxWidth: 105 },
  orderAmount: { color: colors.primary, fontSize: 14, fontWeight: "800", textAlign: "right" },
  orderTime: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
});