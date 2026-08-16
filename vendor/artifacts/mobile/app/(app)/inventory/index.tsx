import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import {
  getGetInventoryCountSessionQueryKey,
  getGetInventoryCountSessionsQueryKey,
  getGetInventoryMovementsQueryKey,
  getGetInventoryStockQueryKey,
  useAdjustInventory,
  useCompleteInventoryCount,
  useGetInventoryCountSession,
  useGetInventoryCountSessions,
  useGetInventoryMovements,
  useGetInventoryStock,
  useStartInventoryCount,
  useUpdateInventoryCountItem,
  type InventoryCountItem,
  type InventoryCountSessionSummary,
  type InventoryMovement,
  type ProductStockLevel,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useConfirm } from "@/contexts/confirm-context";
import { usePermissions } from "@/contexts/permissions-context";
import { Screen } from "@/components/Screen";
import { SearchBar } from "@/components/ListScreen";
import { Card, Badge, Button, EmptyState, FormField, LoadingView, SectionTitle, Divider } from "@/components/ui";
import { SheetModal } from "@/components/SheetModal";
import { colors } from "@/lib/colors";

type InventoryTab = "stock" | "movements" | "counts";

const TYPE_TONE: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  in: "success",
  out: "danger",
  adjustment: "warning",
};

const STOCK_TONE: Record<string, "success" | "warning" | "danger"> = {
  ok: "success",
  low: "warning",
  critical: "danger",
};

export default function InventoryList() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "inventory" });
  const { t, lang } = useLang();
  const { confirm } = useConfirm();
  const feedback = useApiFeedback();
  const router = useRouter();
  const queryClient = useQueryClient();
  const permissions = usePermissions();

  const [tab, setTab] = useState<InventoryTab>("stock");
  const [search, setSearch] = useState("");
  const [selectedCountId, setSelectedCountId] = useState<number | null>(null);
  const [startCountOpen, setStartCountOpen] = useState(false);
  const [countNotes, setCountNotes] = useState("");
  const [stockProduct, setStockProduct] = useState<ProductStockLevel | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [countDrafts, setCountDrafts] = useState<Record<number, string>>({});

  const stockQ = useGetInventoryStock({
    query: { enabled: ready && tab === "stock", queryKey: getGetInventoryStockQueryKey() },
  });
  const movementsQ = useGetInventoryMovements({
    query: { enabled: ready && tab === "movements", queryKey: getGetInventoryMovementsQueryKey() },
  });
  const countsQ = useGetInventoryCountSessions({
    query: { enabled: ready && tab === "counts", queryKey: getGetInventoryCountSessionsQueryKey() },
  });
  const countDetailQ = useGetInventoryCountSession(selectedCountId ?? 0, {
    query: {
      enabled: ready && tab === "counts" && !!selectedCountId,
      queryKey: getGetInventoryCountSessionQueryKey(selectedCountId ?? 0),
    },
  });

  const adjustInventory = useAdjustInventory();
  const startCount = useStartInventoryCount();
  const updateCountItem = useUpdateInventoryCountItem();
  const completeCount = useCompleteInventoryCount();

  const canView = isAdmin || can("inventory", "view");
  const canCount = isAdmin || can("inventory", "create");
  const filteredStock = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return stockQ.data ?? [];
    return (stockQ.data ?? []).filter((item) => `${item.nameEn} ${item.nameAr} ${item.id}`.toLowerCase().includes(value));
  }, [search, stockQ.data]);
  const filteredMovements = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return movementsQ.data ?? [];
    return (movementsQ.data ?? []).filter((item) => `${item.product?.nameEn ?? ""} ${item.product?.nameAr ?? ""} ${item.reason ?? ""} ${item.reference ?? ""}`.toLowerCase().includes(value));
  }, [search, movementsQ.data]);
  const filteredCounts = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return countsQ.data ?? [];
    return (countsQ.data ?? []).filter((item) => `${item.id} ${item.status} ${item.notes ?? ""} ${item.createdByName ?? ""}`.toLowerCase().includes(value));
  }, [search, countsQ.data]);

  if (!ready || !canView) return null;

  function invalidateInventory() {
    queryClient.invalidateQueries({ queryKey: getGetInventoryStockQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInventoryMovementsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInventoryCountSessionsQueryKey() });
  }

  function openStockAdjustment(product: ProductStockLevel) {
    if (!isAdmin) {
      feedback.error(new Error(t("Seul l'administrateur peut ajuster le stock.", "يمكن للمسؤول فقط تعديل المخزون.")));
      return;
    }
    setStockProduct(product);
    setStockAdjustment("");
    setStockReason("");
  }

  function submitStockAdjustment() {
    if (!stockProduct) return;
    const quantity = Number(stockAdjustment.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity === 0 || !stockReason.trim()) {
      feedback.error(new Error(t("Saisissez une quantité non nulle et une raison.", "أدخل كمية غير صفرية وسبب التعديل.")));
      return;
    }
    adjustInventory.mutate(
      { data: { productId: stockProduct.id, quantity, reason: stockReason.trim() } },
      {
        onSuccess: () => {
          feedback.success("Stock ajusté", "تم تعديل المخزون");
          setStockProduct(null);
          invalidateInventory();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function submitStartCount() {
    startCount.mutate(
      { data: { notes: countNotes.trim() || undefined } },
      {
        onSuccess: (session) => {
          feedback.success("Jرد créé", "تم إنشاء جلسة الجرد");
          setStartCountOpen(false);
          setCountNotes("");
          setSelectedCountId(session.id);
          invalidateInventory();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  async function completeSelectedCount() {
    if (!selectedCountId) return;
    const accepted = await confirm({
      title: "Clôturer cette session de jرد ?",
      titleAr: "إغلاق جلسة الجرد؟",
      message: "Les écarts saisis seront appliqués au stock.",
      messageAr: "سيتم تطبيق الفروقات المدخلة على المخزون.",
      confirmLabel: "Clôturer",
      confirmLabelAr: "إغلاق",
      destructive: true,
    });
    if (!accepted) return;
    completeCount.mutate(
      { id: selectedCountId },
      {
        onSuccess: () => {
          feedback.success("Jرد clôturé", "تم إغلاق الجرد");
          queryClient.invalidateQueries({ queryKey: getGetInventoryCountSessionQueryKey(selectedCountId) });
          invalidateInventory();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function updateCountDraft(item: InventoryCountItem, value: string) {
    setCountDrafts((current) => ({ ...current, [item.id]: value }));
  }

  function saveCountItem(item: InventoryCountItem) {
    if (!selectedCountId || countDetailQ.data?.status !== "open") return;
    const raw = countDrafts[item.id] ?? (item.countedQuantity == null ? "" : String(item.countedQuantity));
    const countedQuantity = Number(raw.replace(",", "."));
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      feedback.error(new Error(t("Quantité comptée invalide.", "الكمية الفعلية غير صالحة.")));
      return;
    }
    updateCountItem.mutate(
      { id: selectedCountId, itemId: item.id, data: { countedQuantity } },
      {
        onSuccess: () => {
          feedback.success("Ligne enregistrée", "تم حفظ السطر");
          queryClient.invalidateQueries({ queryKey: getGetInventoryCountSessionQueryKey(selectedCountId) });
          invalidateInventory();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  const tabs: Array<{ key: InventoryTab; fr: string; ar: string }> = [
    { key: "stock", fr: "Stock", ar: "المخزون" },
    { key: "movements", fr: "Mouvements", ar: "الحركات" },
    { key: "counts", fr: "Jرد", ar: "الجرد" },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Feather name="archive" size={19} color={colors.primary} />
            <Text style={styles.title}>{t("Inventaire", "الجرد والمخزون")}</Text>
          </View>
          <Text style={styles.subtitle}>
            {tab === "stock" ? `${filteredStock.length} ${t("produit(s)", "منتج")}` : tab === "movements" ? `${filteredMovements.length} ${t("mouvement(s)", "حركة")}` : `${filteredCounts.length} ${t("session(s)", "جلسة")}`}
          </Text>
        </View>
        {tab === "counts" && canCount ? (
          <Pressable onPress={() => setStartCountOpen(true)} style={styles.iconButton} testID="button-start-inventory-count">
            <Feather name="plus-circle" size={22} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item.key} onPress={() => { setTab(item.key); setSearch(""); }} style={[styles.tab, tab === item.key && styles.tabActive]} testID={`inventory-tab-${item.key}`}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{lang === "ar" ? item.ar : item.fr}</Text>
          </Pressable>
        ))}
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder={t("Rechercher...", "بحث...")} />

      {tab === "stock" ? (
        <StockList
          data={filteredStock}
          loading={stockQ.isLoading}
          refreshing={stockQ.isRefetching}
          onRefresh={stockQ.refetch}
          onOpen={(item) => router.push(`/products/${item.id}` as never)}
          onAdjust={openStockAdjustment}
          t={t}
        />
      ) : null}
      {tab === "movements" ? (
        <MovementList
          data={filteredMovements}
          loading={movementsQ.isLoading}
          refreshing={movementsQ.isRefetching}
          onRefresh={movementsQ.refetch}
          onOpen={(item) => item.productId ? router.push(`/products/${item.productId}` as never) : undefined}
          t={t}
        />
      ) : null}
      {tab === "counts" ? (
        <CountList
          data={filteredCounts}
          loading={countsQ.isLoading}
          refreshing={countsQ.isRefetching}
          onRefresh={countsQ.refetch}
          onOpen={(item) => { setSelectedCountId(item.id); setCountDrafts({}); }}
          t={t}
        />
      ) : null}

      <SheetModal
        visible={startCountOpen}
        onClose={() => setStartCountOpen(false)}
        title={t("Nouvelle session de jرد", "جلسة جرد جديدة")}
        footer={
          <View style={styles.footerRow}>
            <Button label={t("Annuler", "إلغاء")} variant="secondary" onPress={() => setStartCountOpen(false)} style={styles.footerButton} />
            <Button label={t("Démarrer", "بدء")} onPress={submitStartCount} loading={startCount.isPending} style={styles.footerButton} />
          </View>
        }
      >
        <Text style={styles.sheetDescription}>{t("Une photo du stock actuel sera créée pour tous les produits du magasin.", "سيتم إنشاء لقطة من المخزون الحالي لجميع منتجات المتجر.")}</Text>
        <FormField label={t("Notes", "ملاحظات")} value={countNotes} onChangeText={setCountNotes} multiline placeholder={t("Ex. Inventaire mensuel", "مثال: جرد شهري")} />
      </SheetModal>

      <SheetModal
        visible={!!selectedCountId}
        onClose={() => setSelectedCountId(null)}
        title={selectedCountId ? `${t("Session de jرد", "جلسة الجرد")} #${selectedCountId}` : ""}
        footer={countDetailQ.data?.status === "open" ? (
          <Button label={t("Clôturer le jرد", "إغلاق الجرد")} onPress={() => void completeSelectedCount()} loading={completeCount.isPending} variant="primary" />
        ) : null}
      >
        {countDetailQ.isLoading ? <LoadingView /> : countDetailQ.data ? (
          <View>
            <View style={styles.countHeader}>
              <Badge label={countDetailQ.data.status === "open" ? t("Ouverte", "مفتوحة") : t("Clôturée", "مغلقة")} tone={countDetailQ.data.status === "open" ? "warning" : "success"} />
              <Text style={styles.countMeta}>{countDetailQ.data.items.length} {t("article(s)", "مقال")}</Text>
            </View>
            {countDetailQ.data.notes ? <Text style={styles.note}>{countDetailQ.data.notes}</Text> : null}
            {countDetailQ.data.items.map((item) => (
              <CountLine
                key={item.id}
                item={item}
                editable={countDetailQ.data?.status === "open"}
                value={countDrafts[item.id] ?? (item.countedQuantity == null ? "" : String(item.countedQuantity))}
                onChange={(value) => updateCountDraft(item, value)}
                onSave={() => saveCountItem(item)}
                t={t}
              />
            ))}
          </View>
        ) : <EmptyState title={t("Session introuvable", "جلسة الجرد غير موجودة")} />}
      </SheetModal>

      <SheetModal
        visible={!!stockProduct}
        onClose={() => setStockProduct(null)}
        title={t("Ajuster le stock", "تعديل المخزون")}
        footer={
          <View style={styles.footerRow}>
            <Button label={t("Annuler", "إلغاء")} variant="secondary" onPress={() => setStockProduct(null)} style={styles.footerButton} />
            <Button label={t("Enregistrer", "حفظ")} onPress={submitStockAdjustment} loading={adjustInventory.isPending} style={styles.footerButton} />
          </View>
        }
      >
        {stockProduct ? <Text style={styles.productTitle}>{lang === "ar" ? stockProduct.nameAr : stockProduct.nameEn} · {t("Stock", "المخزون")}: {stockProduct.stock}</Text> : null}
        <FormField label={t("Variation (+/-)", "التغيير (+/-)")} value={stockAdjustment} onChangeText={setStockAdjustment} keyboardType="decimal-pad" placeholder="10 ou -3" />
        <FormField label={t("Raison", "السبب")} value={stockReason} onChangeText={setStockReason} placeholder={t("Inventaire physique", "جرد فعلي")} />
      </SheetModal>
    </Screen>
  );
}

function StockList({
  data,
  loading,
  refreshing,
  onRefresh,
  onOpen,
  onAdjust,
  t,
}: {
  data: ProductStockLevel[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (item: ProductStockLevel) => void;
  onAdjust: (item: ProductStockLevel) => void;
  t: (fr: string, ar: string) => string;
}) {
  if (loading && !data.length) return <LoadingView />;
  if (!data.length) return <EmptyState title={t("Aucun stock", "لا يوجد مخزون")} />;
  return (
    <ListContainer data={data} refreshing={refreshing} onRefresh={onRefresh} keyExtractor={(item) => String(item.id)} renderItem={(item) => (
      <Pressable onPress={() => onOpen(item)} style={styles.card} testID={`inventory-stock-${item.id}`}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.nameEn}</Text>
            <Text style={styles.rowSubtitle}>#{item.id}</Text>
          </View>
          <Badge label={String(item.stock)} tone={STOCK_TONE[item.status] ?? "success"} />
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.statusText}>{item.status === "critical" ? t("Critique", "حرج") : item.status === "low" ? t("Faible", "منخفض") : t("Normal", "طبيعي")}</Text>
          <Pressable onPress={() => onAdjust(item)} style={styles.inlineAction} testID={`button-adjust-stock-${item.id}`}>
            <Feather name="edit-3" size={15} color={colors.primary} />
            <Text style={styles.inlineActionText}>{t("Ajuster", "تعديل")}</Text>
          </Pressable>
        </View>
      </Pressable>
    )} />
  );
}

function MovementList({
  data,
  loading,
  refreshing,
  onRefresh,
  onOpen,
  t,
}: {
  data: InventoryMovement[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (item: InventoryMovement) => void;
  t: (fr: string, ar: string) => string;
}) {
  if (loading && !data.length) return <LoadingView />;
  if (!data.length) return <EmptyState title={t("Aucun mouvement de stock", "لا توجد حركات مخزون")} />;
  return (
    <ListContainer data={data} refreshing={refreshing} onRefresh={onRefresh} keyExtractor={(item) => String(item.id)} renderItem={(item) => (
      <Pressable onPress={() => onOpen(item)} style={styles.card} testID={`inventory-movement-${item.id}`}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.product?.nameEn ?? item.product?.nameAr ?? `#${item.productId}`}</Text>
            <Text style={styles.rowSubtitle}>{item.reason ?? item.reference ?? t("Sans motif", "بدون سبب")}</Text>
          </View>
          <Badge label={`${item.type} · ${item.quantity > 0 ? "+" : ""}${item.quantity}`} tone={TYPE_TONE[item.type] ?? "muted"} />
        </View>
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
      </Pressable>
    )} />
  );
}

function CountList({
  data,
  loading,
  refreshing,
  onRefresh,
  onOpen,
  t,
}: {
  data: InventoryCountSessionSummary[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (item: InventoryCountSessionSummary) => void;
  t: (fr: string, ar: string) => string;
}) {
  if (loading && !data.length) return <LoadingView />;
  if (!data.length) return <EmptyState title={t("Aucune session de جرد", "لا توجد جلسات جرد")} subtitle={t("Démarrez une nouvelle session avec le bouton +.", "ابدأ جلسة جديدة من زر +.")} />;
  return (
    <ListContainer data={data} refreshing={refreshing} onRefresh={onRefresh} keyExtractor={(item) => String(item.id)} renderItem={(item) => (
      <Pressable onPress={() => onOpen(item)} style={styles.card} testID={`inventory-count-${item.id}`}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{t("Session", "جلسة")} #{item.id}</Text>
            <Text style={styles.rowSubtitle}>{item.createdByName ?? t("Utilisateur inconnu", "مستخدم غير معروف")} · {formatDate(item.createdAt)}</Text>
          </View>
          <Badge label={item.status === "open" ? t("Ouverte", "مفتوحة") : t("Clôturée", "مغلقة")} tone={item.status === "open" ? "warning" : "success"} />
        </View>
        <View style={styles.countStats}>
          <Text style={styles.statText}>{item.countedCount}/{item.itemCount} {t("comptés", "تم عدها")}</Text>
          <Text style={[styles.statText, item.totalVariance !== 0 && styles.varianceText]}>{t("Écart", "الفرق")}: {item.totalVariance}</Text>
        </View>
      </Pressable>
    )} />
  );
}

function CountLine({
  item,
  editable,
  value,
  onChange,
  onSave,
  t,
}: {
  item: InventoryCountItem;
  editable: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  t: (fr: string, ar: string) => string;
}) {
  const difference = item.difference ?? (item.countedQuantity == null ? null : item.countedQuantity - item.systemQuantity);
  return (
    <View style={styles.countLine}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.nameEn ?? item.nameAr ?? `#${item.productId}`}</Text>
        <Text style={styles.rowSubtitle}>{t("Système", "النظام")}: {item.systemQuantity} · {t("Écart", "الفرق")}: {difference == null ? "—" : difference}</Text>
      </View>
      {editable ? (
        <View style={styles.countInputWrap}>
          <FormField label={t("Compté", "الفعلي")} value={value} onChangeText={onChange} keyboardType="decimal-pad" />
          <Pressable onPress={onSave} style={styles.saveLineButton} testID={`button-save-count-item-${item.id}`}>
            <Feather name="check" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : <Text style={styles.countedValue}>{item.countedQuantity == null ? "—" : item.countedQuantity}</Text>}
    </View>
  );
}

function ListContainer<T>({
  data,
  renderItem,
  keyExtractor,
  refreshing,
  onRefresh,
}: {
  data: T[];
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { FlatList } = require("react-native") as typeof import("react-native");
  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: 21, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  iconButton: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  flex: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  rowSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  statusText: { color: colors.textMuted, fontSize: 12 },
  inlineAction: { flexDirection: "row", alignItems: "center", gap: 5, padding: 5 },
  inlineActionText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  dateText: { color: colors.textMuted, fontSize: 11, marginTop: 10 },
  countStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  statText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  varianceText: { color: colors.danger },
  footerRow: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1 },
  sheetDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  countHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  countMeta: { color: colors.textMuted, fontSize: 12 },
  note: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  productTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 12 },
  countLine: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  countInputWrap: { width: 128, flexDirection: "row", alignItems: "flex-end", gap: 6 },
  saveLineButton: { width: 34, height: 34, marginBottom: 14, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  countedValue: { color: colors.text, fontSize: 15, fontWeight: "800", minWidth: 36, textAlign: "right" },
});