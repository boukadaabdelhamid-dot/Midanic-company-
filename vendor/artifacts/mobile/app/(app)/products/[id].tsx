import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getGetCategoriesQueryKey,
  getGetErpSettingsProductsBrandsQueryKey,
  getGetErpSettingsProductsColorsQueryKey,
  getGetErpSettingsProductsFamiliesQueryKey,
  getGetProductHistoryQueryKey,
  getGetProductQueryKey,
  type Product,
  type ProductHistoryResponse,
  useGetCategories,
  useGetErpSettingsProductsBrands,
  useGetErpSettingsProductsColors,
  useGetErpSettingsProductsFamilies,
  useGetProduct,
  useGetProductHistory,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, Divider, EmptyState, ErrorState, LoadingView, SectionTitle } from "@/components/ui";
import { colors } from "@/lib/colors";

type DetailTab = "information" | "purchases" | "sales" | "summary" | "movements";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "products" });
  const { t, lang } = useLang();
  const productId = Number(id);
  const currency = lang === "ar" ? "دج" : "DA";
  const [tab, setTab] = useState<DetailTab>("information");

  const productQ = useGetProduct(productId, {
    query: { enabled: ready && Number.isFinite(productId) && productId > 0, queryKey: getGetProductQueryKey(productId) },
  });
  const historyQ = useGetProductHistory(productId, {
    query: {
      enabled: ready && isAdmin && Number.isFinite(productId) && productId > 0 && tab !== "information",
      queryKey: getGetProductHistoryQueryKey(productId),
    },
  });
  const categoriesQ = useGetCategories({
    query: { enabled: ready, queryKey: getGetCategoriesQueryKey() },
  });
  const familiesQ = useGetErpSettingsProductsFamilies({
    query: { enabled: ready, queryKey: getGetErpSettingsProductsFamiliesQueryKey() },
  });
  const brandsQ = useGetErpSettingsProductsBrands({
    query: { enabled: ready, queryKey: getGetErpSettingsProductsBrandsQueryKey() },
  });
  const colorsQ = useGetErpSettingsProductsColors({
    query: { enabled: ready, queryKey: getGetErpSettingsProductsColorsQueryKey() },
  });

  const categoryName = useMemo(() => {
    const category = (categoriesQ.data ?? []).find((item) => item.id === productQ.data?.categoryId);
    return category ? (lang === "ar" ? category.nameAr : category.nameEn) : "—";
  }, [categoriesQ.data, lang, productQ.data?.categoryId]);
  const familyName = useMemo(() => {
    const family = familiesQ.data?.items.find((item) => item.id === productQ.data?.familyId);
    return family ? (lang === "ar" ? family.nameAr : family.nameFr) : "—";
  }, [familiesQ.data?.items, lang, productQ.data?.familyId]);
  const brandName = useMemo(() => {
    const brand = brandsQ.data?.items.find((item) => item.id === productQ.data?.brandId);
    return brand ? (lang === "ar" ? brand.nameAr : brand.nameFr) : productQ.data?.brand ?? "—";
  }, [brandsQ.data?.items, lang, productQ.data?.brand, productQ.data?.brandId]);
  const colorName = useMemo(() => {
    const color = colorsQ.data?.items.find((item) => item.id === productQ.data?.colorId);
    return color ? (lang === "ar" ? color.nameAr : color.nameFr) : productQ.data?.color ?? "—";
  }, [colorsQ.data?.items, lang, productQ.data?.color, productQ.data?.colorId]);

  if (!ready) return null;
  if (productQ.isLoading) return <LoadingView />;
  if (productQ.isError || !productQ.data) return <ErrorState title={t("Produit introuvable", "المنتج غير موجود")} />;

  const product = productQ.data;
  const historyAllowed = isAdmin;
  const title = lang === "ar" ? product.nameAr : product.nameEn;
  const images = normalizeImages(product);
  const detailTabs: Array<{ key: DetailTab; fr: string; ar: string; admin?: boolean }> = [
    { key: "information", fr: "Informations", ar: "المعلومات" },
    { key: "purchases", fr: "Achats", ar: "المشتريات", admin: true },
    { key: "sales", fr: "Ventes", ar: "المبيعات", admin: true },
    { key: "summary", fr: "Résumé", ar: "الملخص", admin: true },
    { key: "movements", fr: "Mouvements", ar: "الحركات", admin: true },
  ];

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <Pressable onPress={() => router.back()} style={styles.backButton} testID="button-back-product-detail">
          <Feather name="arrow-left" size={19} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.pageTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.pageSubtitle}>#{product.id} · {product.reference ?? product.barcode ?? t("Sans référence", "بدون مرجع")}</Text>
        </View>
        {isAdmin || can("products", "edit") ? (
          <Pressable onPress={() => router.push(`/products/${product.id}/edit` as never)} style={styles.editButton} testID="button-edit-product">
            <Feather name="edit-2" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <Card style={styles.heroCard}>
        {images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
            {images.map((image) => <Image key={image.url} source={{ uri: image.url }} style={styles.productImage} />)}
          </ScrollView>
        ) : (
          <View style={styles.imagePlaceholder}><Feather name="package" size={38} color={colors.textMuted} /></View>
        )}
        <Text style={styles.heroTitle}>{title}</Text>
        {lang === "ar" && product.nameEn ? <Text style={styles.heroSecondary}>{product.nameEn}</Text> : null}
        {product.descriptionEn || product.descriptionAr ? <Text style={styles.description}>{lang === "ar" ? product.descriptionAr ?? product.descriptionEn : product.descriptionEn ?? product.descriptionAr}</Text> : null}
        <View style={styles.badges}>
          <Badge label={`${t("Stock", "المخزون")}: ${product.stock}`} tone={product.stock <= 0 ? "danger" : product.stock < 5 ? "warning" : "success"} />
          <Badge label={product.isActive === false ? t("Inactif", "غير فعال") : t("Actif", "فعال")} tone={product.isActive === false ? "muted" : "success"} />
          {product.isExposed ? <Badge label={t("Vitrine", "واجهة")} tone="info" /> : null}
        </View>
      </Card>

      <View style={styles.tabScroller}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {detailTabs.map((item) => {
            const disabled = !!item.admin && !historyAllowed;
            return (
              <Pressable
                key={item.key}
                onPress={() => !disabled && setTab(item.key)}
                disabled={disabled}
                style={[styles.tab, tab === item.key && styles.tabActive, disabled && styles.tabDisabled]}
                testID={`product-detail-tab-${item.key}`}
              >
                <Text style={[styles.tabText, tab === item.key && styles.tabTextActive, disabled && styles.tabTextDisabled]}>{lang === "ar" ? item.ar : item.fr}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {tab === "information" ? (
        <InformationSection product={product} categoryName={categoryName} familyName={familyName} brandName={brandName} colorName={colorName} currency={currency} t={t} />
      ) : !historyAllowed ? (
        <Card><EmptyState title={t("Historique réservé à l'administrateur", "السجل متاح للمسؤول فقط")} /></Card>
      ) : historyQ.isLoading ? (
        <LoadingView label={t("Chargement de l'historique...", "جارٍ تحميل السجل...")} />
      ) : historyQ.isError || !historyQ.data ? (
        <Card><ErrorState title={t("Impossible de charger l'historique", "تعذر تحميل السجل")} /></Card>
      ) : tab === "purchases" ? (
        <HistorySection title={t("Achats et retours fournisseurs", "المشتريات ومرتجعات الموردين")} entries={[...historyQ.data.purchases.map((item) => ({ icon: "shopping-cart" as const, title: `#${item.purchaseOrderId}`, subtitle: `${item.supplierName ?? t("Fournisseur inconnu", "مورد غير معروف")} · ${item.status}`, value: `×${item.quantity} · ${formatAmount(item.unitCost)} ${currency}` })), ...historyQ.data.supplierReturns.map((item) => ({ icon: "corner-down-left" as const, title: `${t("Retour", "مرتجع")} #${item.bonRetourFournisseurId}`, subtitle: item.supplierName ?? t("Fournisseur inconnu", "مورد غير معروف"), value: `−${item.quantity} · ${formatAmount(item.unitCost)} ${currency}` }))]} empty={t("Aucun achat enregistré", "لا توجد مشتريات مسجلة")} />
      ) : tab === "sales" ? (
        <HistorySection title={t("Ventes et retours clients", "المبيعات ومرتجعات العملاء")} entries={[...historyQ.data.sales.map((item) => ({ icon: "trending-up" as const, title: `#${item.orderId}`, subtitle: `${item.customerName ?? t("Client inconnu", "عميل غير معروف")} · ${item.status}`, value: `×${item.quantity} · ${formatAmount(item.unitPrice)} ${currency}` })), ...historyQ.data.returns.map((item) => ({ icon: "corner-up-left" as const, title: `${t("Retour", "مرتجع")} #${item.bonRetourId}`, subtitle: item.customerName ?? t("Client inconnu", "عميل غير معروف"), value: `−${item.quantity} · ${formatAmount(item.unitPrice)} ${currency}` }))]} empty={t("Aucune vente enregistrée", "لا توجد مبيعات مسجلة")} />
      ) : tab === "summary" ? (
        <SummarySection product={product} history={historyQ.data} currency={currency} t={t} />
      ) : (
        <HistorySection
          title={t("Mouvements et transferts", "الحركات والتحويلات")}
          entries={[
            ...historyQ.data.timeline.map((item) => {
              const isMovement = item.kind === "movement";
              return {
                icon: "activity" as const,
                title: isMovement ? item.movementType : t("Transfert", "تحويل"),
                subtitle: isMovement ? `${lang === "ar" ? item.storeNameAr : item.storeNameEn ?? ""}${item.reference ? ` · ${item.reference}` : ""}` : `${lang === "ar" ? item.sourceStoreNameAr : item.sourceStoreNameEn ?? ""} → ${lang === "ar" ? item.destStoreNameAr : item.destStoreNameEn ?? ""}`,
                value: `${item.quantity > 0 ? "+" : ""}${item.quantity}`,
              };
            }),
            ...historyQ.data.returns.map((item) => ({ icon: "corner-up-left" as const, title: t("Retour client", "مرتجع عميل"), subtitle: item.customerName ?? "", value: `+${item.quantity}` })),
            ...historyQ.data.supplierReturns.map((item) => ({ icon: "corner-down-left" as const, title: t("Retour fournisseur", "مرتجع مورد"), subtitle: item.supplierName ?? "", value: `−${item.quantity}` })),
          ]}
          empty={t("Aucun mouvement enregistré", "لا توجد حركات مسجلة")}
        />
      )}
    </Screen>
  );
}

function InformationSection({
  product,
  categoryName,
  familyName,
  brandName,
  colorName,
  currency,
  t,
}: {
  product: Product;
  categoryName: string;
  familyName: string;
  brandName: string;
  colorName: string;
  currency: string;
  t: (fr: string, ar: string) => string;
}) {
  const fields: Array<[string, string]> = [
    [t("Nom arabe", "الاسم بالعربية"), product.nameAr],
    [t("Nom français", "الاسم بالفرنسية"), product.nameEn],
    [t("Référence", "المرجع"), product.reference ?? "—"],
    [t("Code-barres", "الباركود"), product.barcode ?? "—"],
    [t("Catégorie", "التصنيف"), categoryName],
    [t("Famille", "العائلة"), familyName],
    [t("Marque", "الماركة"), brandName],
    [t("Couleur", "اللون"), colorName],
    [t("Modèle", "الموديل"), product.model ?? "—"],
    [t("Type catalogue", "نوع الكتالوج"), product.catalogueType ?? "—"],
    [t("Stock", "المخزون"), String(product.stock ?? 0)],
    [t("Prix de vente", "سعر البيع"), `${formatAmount(product.price)} ${currency}`],
    [t("Prix de revient", "سعر التكلفة"), product.costPrice ? `${formatAmount(product.costPrice)} ${currency}` : "—"],
    [t("Prix gros", "سعر الجملة"), product.priceGros ? `${formatAmount(product.priceGros)} ${currency}` : "—"],
    [t("Prix semi-gros", "سعر نصف الجملة"), product.priceSemiGros ? `${formatAmount(product.priceSemiGros)} ${currency}` : "—"],
    [t("Prix minimum", "الحد الأدنى للسعر"), product.priceMin ? `${formatAmount(product.priceMin)} ${currency}` : "—"],
    [t("Colisage", "التعبئة"), product.colisage == null ? "—" : String(product.colisage)],
    [t("Poids", "الوزن"), product.weight ?? "—"],
    [t("Actif", "فعال"), product.isActive === false ? t("Non", "لا") : t("Oui", "نعم")],
    [t("Vitrine", "واجهة"), product.isExposed ? t("Oui", "نعم") : t("Non", "لا")],
    ...(["catalogue1", "catalogue2", "catalogue3", "catalogue4", "catalogue5", "catalogue6"] as const).map((key, index) => [`Catalogue ${index + 1}`, product[key] ?? "—"] as [string, string]),
  ];
  return (
    <Card>
      <SectionTitle>{t("Informations ERP", "معلومات ERP")}</SectionTitle>
      <View style={styles.detailGrid}>{fields.map(([label, value]) => <View key={label} style={styles.detailField}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value}</Text></View>)}</View>
    </Card>
  );
}

type HistoryEntry = { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string; value: string };

function HistorySection({ title, entries, empty }: { title: string; entries: HistoryEntry[]; empty: string }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {!entries.length ? <EmptyState title={empty} /> : entries.map((entry, index) => <View key={`${entry.title}-${entry.value}-${index}`}>{index ? <Divider /> : null}<View style={styles.historyRow}><Feather name={entry.icon} size={18} color={colors.primary} /><View style={styles.historyText}><Text style={styles.historyTitle}>{entry.title}</Text><Text style={styles.historySubtitle}>{entry.subtitle}</Text></View><Text style={styles.historyValue}>{entry.value}</Text></View></View>)}
    </Card>
  );
}

function SummarySection({ product, history, currency, t }: { product: Product; history: ProductHistoryResponse; currency: string; t: (fr: string, ar: string) => string }) {
  const bought = history.purchases.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const sold = history.sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const customerReturns = history.returns.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const supplierReturns = history.supplierReturns.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return (
    <Card>
      <SectionTitle>{t("Résumé produit", "ملخص المنتج")}</SectionTitle>
      <View style={styles.summaryGrid}>
        <SummaryMetric icon="package" label={t("Stock actuel", "المخزون الحالي")} value={`${product.stock} ${t("unité(s)", "وحدة")}`} />
        <SummaryMetric icon="shopping-cart" label={t("Quantités achetées", "الكميات المشتراة")} value={String(bought)} />
        <SummaryMetric icon="trending-up" label={t("Quantités vendues", "الكميات المباعة")} value={String(sold)} />
        <SummaryMetric icon="corner-up-left" label={t("Retours clients", "مرتجعات العملاء")} value={String(customerReturns)} />
        <SummaryMetric icon="corner-down-left" label={t("Retours fournisseurs", "مرتجعات الموردين")} value={String(supplierReturns)} />
        <SummaryMetric icon="dollar-sign" label={t("Dernière vente", "آخر بيع")} value={history.sales[0] ? `${formatAmount(history.sales[0].unitPrice)} ${currency}` : "—"} />
      </View>
    </Card>
  );
}

function SummaryMetric({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return <View style={styles.summaryMetric}><Feather name={icon} size={18} color={colors.primary} /><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function normalizeImages(product: Product) {
  if (product.images?.length) return product.images;
  return product.imageUrl ? [{ url: product.imageUrl, id: -1 }] : [];
}

function formatAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00";
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  headerText: { flex: 1 },
  pageTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  pageSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  editButton: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3FA" },
  heroCard: { alignItems: "center", gap: 8 },
  imageList: { gap: 8 },
  productImage: { width: 138, height: 138, borderRadius: 12, backgroundColor: colors.background },
  imagePlaceholder: { width: 138, height: 138, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  heroSecondary: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  tabScroller: { marginHorizontal: -16 },
  tabs: { gap: 7, paddingHorizontal: 16 },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabDisabled: { opacity: 0.45 },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  tabTextDisabled: { color: colors.textMuted },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  detailField: { width: "48%", minHeight: 52, padding: 10, borderRadius: 9, backgroundColor: colors.background },
  fieldLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700", marginBottom: 5 },
  fieldValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  historyText: { flex: 1 },
  historyTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  historySubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  historyValue: { color: colors.text, fontSize: 12, fontWeight: "700" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  summaryMetric: { width: "48%", minHeight: 92, padding: 11, borderRadius: 10, backgroundColor: colors.background },
  summaryLabel: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 5 },
});