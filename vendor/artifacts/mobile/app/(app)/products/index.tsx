import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getGetCategoriesQueryKey,
  getGetErpSettingsProductsBrandsQueryKey,
  getGetErpSettingsProductsColorsQueryKey,
  getGetErpSettingsProductsFamiliesQueryKey,
  getGetErpSettingsProductsTypesQueryKey,
  getGetProductHistoryQueryKey,
  getGetProductsQueryKey,
  getGetInventoryMovementsQueryKey,
  getGetInventoryStockQueryKey,
  type GetProductsParams,
  type Product,
  type ProductFamily,
  type ProductHistoryResponse,
  useAdjustInventory,
  useDeleteProduct,
  useGetCategories,
  useGetErpSettingsProductsBrands,
  useGetErpSettingsProductsColors,
  useGetErpSettingsProductsFamilies,
  useGetErpSettingsProductsTypes,
  useGetProductHistory,
  useGetProducts,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useConfirm } from "@/contexts/confirm-context";
import { Button, Card, EmptyState, FormField, LoadingView, Badge } from "@/components/ui";
import { Fab } from "@/components/Fab";
import { PickerField } from "@/components/Picker";
import { SearchBar } from "@/components/ListScreen";
import { SheetModal } from "@/components/SheetModal";
import { colors } from "@/lib/colors";

type ArticleTab = "all" | "active" | "inactive" | "exposed" | "out";
type ArticleSortKey = "name" | "stock" | "price" | "createdAt";
type DetailTab = "informations" | "achats" | "ventes" | "resume" | "mouvements";
type ArticleColumnKey =
  | "id"
  | "image"
  | "reference"
  | "catalogueType"
  | "name"
  | "description"
  | "barcode"
  | "brand"
  | "model"
  | "color"
  | "family"
  | "colisage"
  | "weight"
  | "catalogue1"
  | "catalogue2"
  | "catalogue3"
  | "catalogue4"
  | "catalogue5"
  | "catalogue6"
  | "createdAt"
  | "isExposed"
  | "isActive"
  | "price"
  | "priceGros"
  | "priceSemiGros"
  | "priceMin"
  | "costPrice"
  | "stock"
  | "vitrine"
  | "actions";

const ARTICLE_COLUMNS: Array<{ key: ArticleColumnKey; label: string; width: number; filterKey?: keyof ArticleFilters }> = [
  { key: "id", label: "ID #", width: 92, filterKey: "filterId" },
  { key: "image", label: "IMAGE", width: 92 },
  { key: "reference", label: "RÉF.", width: 138, filterKey: "filterRef" },
  { key: "catalogueType", label: "CATALOGUE", width: 138, filterKey: "filterCatalogueType" },
  { key: "name", label: "DÉSIGNATION", width: 168, filterKey: "filterName" },
  { key: "description", label: "DESCRIPTION", width: 190, filterKey: "filterDescription" },
  { key: "barcode", label: "CODE", width: 132, filterKey: "filterCode" },
  { key: "brand", label: "MARQUE", width: 128, filterKey: "filterBrand" },
  { key: "model", label: "MODÈLE", width: 128, filterKey: "filterModel" },
  { key: "color", label: "COULEUR", width: 128, filterKey: "filterColor" },
  { key: "family", label: "FAMILLE", width: 128, filterKey: "filterFamily" },
  { key: "colisage", label: "COLISAGE", width: 110, filterKey: "filterColisage" },
  { key: "weight", label: "POIDS", width: 105, filterKey: "filterWeight" },
  { key: "catalogue1", label: "CATALOGUE1", width: 138, filterKey: "filterCatalogue1" },
  { key: "catalogue2", label: "CATALOGUE2", width: 138, filterKey: "filterCatalogue2" },
  { key: "catalogue3", label: "CATALOGUE3", width: 138, filterKey: "filterCatalogue3" },
  { key: "catalogue4", label: "CATALOGUE4", width: 138, filterKey: "filterCatalogue4" },
  { key: "catalogue5", label: "CATALOGUE5", width: 138, filterKey: "filterCatalogue5" },
  { key: "catalogue6", label: "CATALOGUE6", width: 138, filterKey: "filterCatalogue6" },
  { key: "createdAt", label: "CRÉATION", width: 130, filterKey: "filterCreatedAt" },
  { key: "isExposed", label: "EXPOSÉ", width: 112, filterKey: "filterExposed" },
  { key: "isActive", label: "ÉTAT", width: 100 },
  { key: "price", label: "PU DÉTAIL", width: 112, filterKey: "filterPrice" },
  { key: "priceGros", label: "PU GROS", width: 112, filterKey: "filterPriceGros" },
  { key: "priceSemiGros", label: "PU S.GROS", width: 120, filterKey: "filterPriceSemiGros" },
  { key: "priceMin", label: "PRIX MIN", width: 112, filterKey: "filterPriceMin" },
  { key: "costPrice", label: "COÛT", width: 105, filterKey: "filterCostPrice" },
  { key: "stock", label: "STOCK", width: 104, filterKey: "filterStock" },
  { key: "vitrine", label: "VITRINE", width: 112 },
  { key: "actions", label: "ACTIONS", width: 88 },
];

const DEFAULT_ARTICLE_COLUMNS: ArticleColumnKey[] = ["reference", "catalogueType", "name", "barcode", "price", "costPrice", "stock", "vitrine", "actions"];

type ArticleFilters = {
  filterId: string;
  filterName: string;
  filterCode: string;
  filterRef: string;
  filterBrand: string;
  filterFamily: string;
  filterStock: string;
  filterCatalogueType: string;
  filterDescription: string;
  filterModel: string;
  filterColor: string;
  filterColisage: string;
  filterWeight: string;
  filterCatalogue1: string;
  filterCatalogue2: string;
  filterCatalogue3: string;
  filterCatalogue4: string;
  filterCatalogue5: string;
  filterCatalogue6: string;
  filterCreatedAt: string;
  filterPrice: string;
  filterPriceGros: string;
  filterPriceSemiGros: string;
  filterPriceMin: string;
  filterCostPrice: string;
  filterExposed: string;
  categoryId: number | null;
};

const EMPTY_FILTERS: ArticleFilters = {
  filterId: "",
  filterName: "",
  filterCode: "",
  filterRef: "",
  filterBrand: "",
  filterFamily: "",
  filterStock: "",
  filterCatalogueType: "",
  filterDescription: "",
  filterModel: "",
  filterColor: "",
  filterColisage: "",
  filterWeight: "",
  filterCatalogue1: "",
  filterCatalogue2: "",
  filterCatalogue3: "",
  filterCatalogue4: "",
  filterCatalogue5: "",
  filterCatalogue6: "",
  filterCreatedAt: "",
  filterPrice: "",
  filterPriceGros: "",
  filterPriceSemiGros: "",
  filterPriceMin: "",
  filterCostPrice: "",
  filterExposed: "",
  categoryId: null,
};

const FILTER_TEXT_FIELDS: Array<[keyof ArticleFilters, string, string, "default" | "numeric"]> = [
  ["filterId", "ID", "المعرّف", "numeric"],
  ["filterName", "Nom", "الاسم", "default"],
  ["filterCode", "Code-barres", "الباركود", "default"],
  ["filterRef", "Référence", "المرجع", "default"],
  ["filterBrand", "Marque", "الماركة", "default"],
  ["filterFamily", "Famille", "العائلة", "default"],
  ["filterStock", "Stock", "المخزون", "numeric"],
  ["filterCatalogueType", "Type catalogue", "نوع الكتالوج", "default"],
  ["filterDescription", "Description", "الوصف", "default"],
  ["filterModel", "Modèle", "الموديل", "default"],
  ["filterColor", "Couleur", "اللون", "default"],
  ["filterColisage", "Colisage", "التعبئة", "numeric"],
  ["filterWeight", "Poids", "الوزن", "numeric"],
  ["filterCatalogue1", "Catalogue 1", "كتالوج 1", "default"],
  ["filterCatalogue2", "Catalogue 2", "كتالوج 2", "default"],
  ["filterCatalogue3", "Catalogue 3", "كتالوج 3", "default"],
  ["filterCatalogue4", "Catalogue 4", "كتالوج 4", "default"],
  ["filterCatalogue5", "Catalogue 5", "كتالوج 5", "default"],
  ["filterCatalogue6", "Catalogue 6", "كتالوج 6", "default"],
  ["filterCreatedAt", "Date de création", "تاريخ الإنشاء", "default"],
  ["filterPrice", "Prix vente", "سعر البيع", "numeric"],
  ["filterPriceGros", "Prix gros", "سعر الجملة", "numeric"],
  ["filterPriceSemiGros", "Prix semi-gros", "سعر نصف الجملة", "numeric"],
  ["filterPriceMin", "Prix minimum", "السعر الأدنى", "numeric"],
  ["filterCostPrice", "Prix revient", "سعر التكلفة", "numeric"],
  ["filterExposed", "Vitrine (Oui/Non)", "واجهة المتجر (نعم/لا)", "default"],
];

export default function ProductsList() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "products" });
  const { t, lang } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const { confirm } = useConfirm();
  const currency = lang === "ar" ? "دج" : "DA";

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ArticleTab>("all");
  const [page, setPage] = useState(1);
  const [listedProducts, setListedProducts] = useState<Product[]>([]);
  const [sortKey, setSortKey] = useState<ArticleSortKey>("name");
  const [sortDescending, setSortDescending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ArticleColumnKey[]>(DEFAULT_ARTICLE_COLUMNS);
  const [actionsProduct, setActionsProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("informations");
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState<ArticleFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ArticleFilters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [stockReason, setStockReason] = useState("");

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
  const typesQ = useGetErpSettingsProductsTypes({
    query: { enabled: ready, queryKey: getGetErpSettingsProductsTypesQueryKey() },
  });

  const productsParams = useMemo(() => {
    const params: GetProductsParams & Record<string, unknown> = {
      search: search.trim() || undefined,
      limit: 100,
      page,
      ...Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [
          key,
          value === "" || value === null ? undefined : value,
        ]),
      ),
    };

    if (tab === "active") params.filterActive = "true";
    if (tab === "inactive") params.filterActive = "false";
    if (tab === "exposed") params.filterExposed = "true";
    if (tab === "out") params.filterStock = "0";

    return params as GetProductsParams;
  }, [filters, page, search, tab]);

  const productsQ = useGetProducts(productsParams, {
    query: {
      enabled: ready,
      queryKey: getGetProductsQueryKey(productsParams),
      placeholderData: (previous) => previous,
    },
  });
  useEffect(() => {
    AsyncStorage.getItem("midanic.products.visibleColumns").then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value) as ArticleColumnKey[];
        if (Array.isArray(parsed) && parsed.length > 0) setVisibleColumns(parsed);
      } catch {
        // Ignore malformed local preferences and keep the ERP defaults.
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem("midanic.products.visibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
    setListedProducts([]);
  }, [filters, search, tab]);

  useEffect(() => {
    const incoming = productsQ.data?.products ?? [];
    setListedProducts((current) => {
      if (page === 1) return incoming;
      const seen = new Set(current.map((product) => product.id));
      return [...current, ...incoming.filter((product) => !seen.has(product.id))];
    });
  }, [page, productsQ.data]);

  const products = useMemo(() => {
    const sorted = [...listedProducts];
    sorted.sort((a, b) => {
      let left: string | number = a.nameEn;
      let right: string | number = b.nameEn;
      if (sortKey === "stock") {
        left = Number(a.stock ?? 0);
        right = Number(b.stock ?? 0);
      } else if (sortKey === "price") {
        left = Number(a.price ?? 0);
        right = Number(b.price ?? 0);
      } else if (sortKey === "createdAt") {
        left = a.createdAt ?? "";
        right = b.createdAt ?? "";
      }
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), lang === "ar" ? "ar" : "fr");
      return sortDescending ? -result : result;
    });
    return sorted;
  }, [lang, listedProducts, sortDescending, sortKey]);
  const total = productsQ.data?.total ?? 0;
  const historyQ = useGetProductHistory(detailProduct?.id ?? 0, {
    query: {
      enabled: ready && isAdmin && detailOpen && !!detailProduct?.id,
      queryKey: getGetProductHistoryQueryKey(detailProduct?.id ?? 0),
    },
  });
  const deleteProduct = useDeleteProduct();
  const adjustInventory = useAdjustInventory();

  if (!ready) return null;

  const canCreate = isAdmin || can("products", "create");
  const canEdit = isAdmin || can("products", "edit");
  const canDelete = isAdmin || can("products", "delete");
  const activeFilterCount = Object.values(filters).filter((value) => value !== "" && value !== null).length;
  const categories = categoriesQ.data ?? [];
  const families = familiesQ.data?.items ?? [];
  const brands = brandsQ.data?.items ?? [];
  const productColors = colorsQ.data?.items ?? [];
  const productTypes = typesQ.data?.items ?? [];
  const hasMore = products.length < total;

  function openFilters() {
    setDraftFilters(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setFilterOpen(false);
  }

  function changeSort(nextKey: ArticleSortKey) {
    if (sortKey === nextKey) setSortDescending((current) => !current);
    else {
      setSortKey(nextKey);
      setSortDescending(false);
    }
  }

  function updateColumnFilter(key: keyof ArticleFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleSelected(productId: number) {
    setSelectedIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  }

  function toggleAllSelected() {
    setSelectedIds((current) => (
      products.length > 0 && products.every((product) => current.includes(product.id))
        ? current.filter((id) => !products.some((product) => product.id === id))
        : Array.from(new Set([...current, ...products.map((product) => product.id)]))
    ));
  }

  async function adjustProductStock(product: Product) {
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
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInventoryMovementsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInventoryStockQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProductHistoryQueryKey(stockProduct.id) });
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function openDetails(product: Product, tab: DetailTab = "informations") {
    setDetailProduct(product);
    setDetailTab(tab !== "informations" && !isAdmin ? "informations" : tab);
    setDetailOpen(true);
    setActionsProduct(null);
  }

  function closeDetails() {
    setDetailOpen(false);
    setDetailProduct(null);
  }

  function toggleColumn(column: ArticleColumnKey) {
    setVisibleColumns((current) => (
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    ));
  }

  function printArticles() {
    const printableProducts = selectedIds.length > 0
      ? products.filter((product) => selectedIds.includes(product.id))
      : products;
    const message = printableProducts
      .map((product) => `${product.nameEn} | ${product.reference ?? "—"} | ${product.barcode ?? "—"} | Stock: ${product.stock}`)
      .join("\n");
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
      return;
    }
    void Share.share({
      message: message || t(`Articles: ${total} produit(s)`, `المقالات: ${total} منتج`),
    });
  }

  async function deleteSelectedProducts() {
    if (!selectedIds.length) return;
    const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
    const accepted = await confirm({
      title: `Supprimer ${selectedProducts.length} article(s) ?`,
      titleAr: `حذف ${selectedProducts.length} مقال؟`,
      message: selectedProducts.map((product) => product.nameEn).join("\n"),
      messageAr: selectedProducts.map((product) => product.nameAr).join("\n"),
      confirmLabel: "Supprimer",
      confirmLabelAr: "حذف",
      destructive: true,
    });
    if (!accepted) return;
    let remaining = selectedProducts.length;
    selectedProducts.forEach((product) => {
      deleteProduct.mutate(
        { id: product.id },
        {
          onSuccess: () => {
            remaining -= 1;
            if (remaining === 0) {
              setSelectedIds([]);
              feedback.success("Articles supprimés", "تم حذف المقالات");
              queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
            }
          },
          onError: (error) => {
            remaining -= 1;
            feedback.error(error);
            if (remaining === 0) setSelectedIds([]);
          },
        },
      );
    });
  }

  async function handleDelete(product: Product) {
    const accepted = await confirm({
      title: "Supprimer l'article ?",
      titleAr: "حذف المقال؟",
      message: product.nameEn,
      messageAr: product.nameAr,
      confirmLabel: "Supprimer",
      confirmLabelAr: "حذف",
      destructive: true,
    });
    if (!accepted) return;
    deleteProduct.mutate(
      { id: product.id },
      {
        onSuccess: () => {
          feedback.success("Article supprimé", "تم حذف المقال");
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  const tabs: Array<{ key: ArticleTab; fr: string; ar: string }> = [
    { key: "all", fr: "Tous", ar: "الكل" },
    { key: "active", fr: "Actifs", ar: "نشطة" },
    { key: "inactive", fr: "Inactifs", ar: "غير نشطة" },
    { key: "exposed", fr: "Vitrine", ar: "واجهة المتجر" },
    { key: "out", fr: "Rupture", ar: "نفاد المخزون" },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Feather name="package" size={19} color={colors.primary} />
            <Text style={styles.title}>{t("Articles", "المقالات")}</Text>
          </View>
          <Text style={styles.count}>{total} {t("article(s)", "مقال")}</Text>
        </View>
        <View style={styles.headerActions}>
          {canCreate ? (
            <Pressable onPress={() => router.push("/products/new" as never)} style={styles.headerAction} hitSlop={8} testID="button-new-article">
              <Feather name="plus-square" size={20} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={printArticles} style={styles.headerAction} hitSlop={8} testID="button-print-articles">
            <Feather name="printer" size={19} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => productsQ.refetch()} style={styles.headerAction} hitSlop={8} testID="button-refresh-articles">
            <Feather name="refresh-cw" size={19} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={t("Rechercher par nom...", "البحث بالاسم...")} />
        </View>
        <Pressable onPress={() => setColumnsOpen(true)} style={styles.columnsButton} testID="button-open-article-columns">
          <Feather name="columns" size={17} color={colors.primary} />
          <Text style={styles.columnsButtonText}>{t("Colonnes", "الأعمدة")}</Text>
        </Pressable>
        <Pressable onPress={() => changeSort(sortKey === "name" ? "stock" : "name")} style={styles.sortButton} testID="button-sort-articles">
          <Feather name={sortDescending ? "arrow-down" : "arrow-up"} size={16} color={colors.primary} />
          <Text style={styles.sortButtonText}>{sortKey === "name" ? t("Nom", "الاسم") : sortKey === "stock" ? t("Stock", "المخزون") : sortKey === "price" ? t("Prix", "السعر") : t("Date", "التاريخ")}</Text>
        </Pressable>
        <Pressable onPress={openFilters} style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]} testID="button-open-article-filters">
          <Feather name="filter" size={18} color={activeFilterCount > 0 ? "#fff" : colors.primary} />
          {activeFilterCount > 0 ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View> : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {tabs.map((item) => (
          <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{lang === "ar" ? item.ar : item.fr}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {selectedIds.length > 0 ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selectedIds.length} {t("sélectionné(s)", "محدد")}</Text>
          <Pressable onPress={printArticles} style={styles.bulkAction} testID="button-print-selected-articles">
            <Feather name="printer" size={16} color={colors.primary} />
            <Text style={styles.bulkActionText}>{t("Imprimer", "طباعة")}</Text>
          </Pressable>
          {canDelete ? (
            <Pressable onPress={() => void deleteSelectedProducts()} style={styles.bulkAction} testID="button-delete-selected-articles">
              <Feather name="trash-2" size={16} color={colors.danger} />
              <Text style={[styles.bulkActionText, { color: colors.danger }]}>{t("Supprimer", "حذف")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {productsQ.isLoading && !productsQ.data ? (
        <LoadingView />
      ) : productsQ.isError && !productsQ.data ? (
        <View style={styles.errorState}>
          <EmptyState title={t("Impossible de charger les articles", "تعذر تحميل المقالات")} subtitle={t("Vérifiez la connexion puis réessayez.", "تحقق من الاتصال ثم أعد المحاولة.")} />
          <Button label={t("Réessayer", "إعادة المحاولة")} onPress={() => productsQ.refetch()} />
        </View>
      ) : (
        <ArticleTable
          products={products}
          families={families}
          columns={visibleColumns}
          lang={lang}
          isRefreshing={productsQ.isRefetching}
          isFetching={productsQ.isFetching && !!productsQ.data}
          onRefresh={() => productsQ.refetch()}
          onOpenFilters={openFilters}
          onOpen={(product) => openDetails(product)}
          onActions={setActionsProduct}
          filterValues={filters}
          selectedIds={selectedIds}
          onFilterChange={updateColumnFilter}
          onToggleSelected={toggleSelected}
          onToggleAll={toggleAllSelected}
          onEndReached={() => {
            if (hasMore && !productsQ.isFetching) setPage((current) => current + 1);
          }}
          hasMore={hasMore}
          emptyTitle={t("Aucun article", "لا توجد مقالات")}
          emptySubtitle={search || activeFilterCount > 0 ? t("Essayez d'autres filtres", "جرّب فلاتر أخرى") : undefined}
        />
      )}

      {canCreate ? <Fab onPress={() => router.push("/products/new" as never)} testID="button-new-product" /> : null}

      <SheetModal
        visible={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title={t("Colonnes visibles", "الأعمدة الظاهرة")}
        footer={
          <View style={styles.columnsFooter}>
            <Pressable
              onPress={() => setVisibleColumns(ARTICLE_COLUMNS.map((column) => column.key))}
              style={styles.columnsFooterButton}
              testID="button-show-all-article-columns"
            >
              <Text style={styles.columnsFooterText}>{t("Tout afficher", "إظهار الكل")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setVisibleColumns(DEFAULT_ARTICLE_COLUMNS)}
              style={styles.columnsFooterButton}
              testID="button-reset-article-columns"
            >
              <Text style={styles.columnsFooterText}>{t("Réinitialiser", "إعادة التعيين")}</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.sheetHint}>{t("Choisissez les colonnes affichées dans le tableau ERP.", "اختر الأعمدة الظاهرة في جدول ERP.")}</Text>
        {ARTICLE_COLUMNS.map((column) => (
          <Pressable
            key={column.key}
            onPress={() => toggleColumn(column.key)}
            style={styles.columnOption}
            testID={`toggle-column-${column.key}`}
          >
            <View style={[styles.checkbox, visibleColumns.includes(column.key) && styles.checkboxChecked]}>
              {visibleColumns.includes(column.key) ? <Feather name="check" size={14} color="#fff" /> : null}
            </View>
            <Text style={styles.columnOptionText}>{column.label}</Text>
          </Pressable>
        ))}
      </SheetModal>

      <SheetModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t("Filtres des articles", "فلاتر المقالات")}
        footer={
          <View style={styles.filterFooter}>
            <Button label={t("Effacer", "مسح")} variant="secondary" onPress={clearFilters} style={styles.footerButton} />
            <Button label={t("Appliquer", "تطبيق")} onPress={applyFilters} style={styles.footerButton} />
          </View>
        }
      >
        <PickerField
          label={t("Catégorie", "الفئة")}
          value={categories.find((category) => category.id === draftFilters.categoryId) ?? null}
          items={categories}
          keyExtractor={(category) => String(category.id)}
          labelExtractor={(category) => lang === "ar" ? category.nameAr : category.nameEn}
          onChange={(category) => setDraftFilters((current) => ({ ...current, categoryId: category.id }))}
          placeholder={t("Toutes les catégories", "كل الفئات")}
        />
        <View style={styles.filterHint}>
          <Feather name="sliders" size={16} color={colors.primary} />
          <Text style={styles.filterHintText}>{t("Filtres disponibles sur toutes les colonnes ERP", "الفلاتر متاحة على جميع أعمدة ERP")}</Text>
        </View>
        {FILTER_TEXT_FIELDS.map(([key, labelFr, labelAr, type]) => (
          <FormField
            key={key}
            label={t(labelFr, labelAr)}
            value={String(draftFilters[key] ?? "")}
            onChangeText={(value) => setDraftFilters((current) => ({ ...current, [key]: value }))}
            keyboardType={type === "numeric" ? "decimal-pad" : "default"}
            autoCapitalize="none"
          />
        ))}
        <Text style={styles.filterSectionLabel}>{t("Attributs ERP", "خصائص ERP")}</Text>
        <PickerField
          label={t("Famille enregistrée", "العائلة المسجلة")}
          value={families.find((family) => family.nameFr.toLowerCase() === draftFilters.filterFamily.toLowerCase()) ?? null}
          items={families}
          keyExtractor={(family) => String(family.id)}
          labelExtractor={(family) => lang === "ar" ? family.nameAr : family.nameFr}
          onChange={(family) => setDraftFilters((current) => ({ ...current, filterFamily: family.nameFr }))}
          placeholder={t("Saisir ou choisir une famille", "اكتب أو اختر عائلة")}
        />
        <PickerField
          label={t("Marque enregistrée", "الماركة المسجلة")}
          value={brands.find((brand) => brand.nameFr.toLowerCase() === draftFilters.filterBrand.toLowerCase()) ?? null}
          items={brands}
          keyExtractor={(brand) => String(brand.id)}
          labelExtractor={(brand) => lang === "ar" ? brand.nameAr : brand.nameFr}
          onChange={(brand) => setDraftFilters((current) => ({ ...current, filterBrand: brand.nameFr }))}
          placeholder={t("Saisir ou choisir une marque", "اكتب أو اختر ماركة")}
        />
        <PickerField
          label={t("Couleur enregistrée", "اللون المسجل")}
          value={productColors.find((color) => color.nameFr.toLowerCase() === draftFilters.filterColor.toLowerCase()) ?? null}
          items={productColors}
          keyExtractor={(color) => String(color.id)}
          labelExtractor={(color) => lang === "ar" ? color.nameAr : color.nameFr}
          onChange={(color) => setDraftFilters((current) => ({ ...current, filterColor: color.nameFr }))}
          placeholder={t("Saisir ou choisir une couleur", "اكتب أو اختر لونًا")}
        />
        <PickerField
          label={t("Type de catalogue", "نوع الكتالوج")}
          value={productTypes.find((type) => type.nameFr.toLowerCase() === draftFilters.filterCatalogueType.toLowerCase()) ?? null}
          items={productTypes}
          keyExtractor={(type) => String(type.id)}
          labelExtractor={(type) => lang === "ar" ? type.nameAr : type.nameFr}
          onChange={(type) => setDraftFilters((current) => ({ ...current, filterCatalogueType: type.nameFr }))}
          placeholder={t("Tous les types", "كل الأنواع")}
        />
      </SheetModal>

      <ProductActionsSheet
        product={actionsProduct}
        visible={!!actionsProduct}
        canEdit={canEdit}
        canDelete={canDelete}
        canHistory={isAdmin}
        canTransfer={isAdmin || can("inventory", "create")}
        canAdjustStock={isAdmin}
        onClose={() => setActionsProduct(null)}
        onEdit={(product) => {
          setActionsProduct(null);
          router.push(`/products/${product.id}/edit` as never);
        }}
        onDetails={(product) => openDetails(product)}
        onHistory={(product) => openDetails(product, "mouvements")}
        onDelete={(product) => {
          setActionsProduct(null);
          void handleDelete(product);
        }}
        onImages={(product) => {
          setActionsProduct(null);
          router.push(`/products/${product.id}/edit` as never);
        }}
        onInventory={() => {
          if (actionsProduct) void adjustProductStock(actionsProduct);
          setActionsProduct(null);
        }}
        onTransfer={() => {
          setActionsProduct(null);
          router.push(`/transfers/new?productId=${actionsProduct?.id ?? ""}` as never);
        }}
        onPrices={(product) => {
          setActionsProduct(null);
          router.push(`/products/${product.id}/edit` as never);
        }}
        onBarcode={(product) => {
          setActionsProduct(null);
          void Share.share({
            message: `${product.nameEn}\n${product.barcode ?? product.reference ?? `#${product.id}`}`,
          });
        }}
        onDuplicate={(product) => {
          setActionsProduct(null);
          router.push(`/products/new?duplicateFrom=${product.id}` as never);
        }}
      />

      <SheetModal
        visible={!!stockProduct}
        onClose={() => setStockProduct(null)}
        title={t("Ajuster le stock", "تعديل المخزون")}
        footer={
          <View style={styles.filterFooter}>
            <Button label={t("Annuler", "إلغاء")} variant="secondary" onPress={() => setStockProduct(null)} style={styles.footerButton} />
            <Button label={t("Enregistrer", "حفظ")} onPress={submitStockAdjustment} loading={adjustInventory.isPending} style={styles.footerButton} />
          </View>
        }
      >
        {stockProduct ? <Text style={styles.stockProductTitle}>{stockProduct.nameEn} · {t("Stock actuel", "المخزون الحالي")}: {stockProduct.stock}</Text> : null}
        <FormField
          label={t("Variation de stock (+/-)", "تغيير المخزون (+/-)")}
          value={stockAdjustment}
          onChangeText={setStockAdjustment}
          keyboardType="decimal-pad"
          placeholder={t("Ex. 10 ou -3", "مثال: 10 أو -3")}
        />
        <FormField
          label={t("Raison", "السبب")}
          value={stockReason}
          onChangeText={setStockReason}
          placeholder={t("Ex. Inventaire physique", "مثال: جرد فعلي")}
        />
      </SheetModal>

      <ProductDetailsSheet
        visible={detailOpen}
        product={detailProduct}
        families={families}
        history={historyQ.data}
        historyLoading={historyQ.isLoading}
        historyError={historyQ.isError}
        historyAllowed={isAdmin}
        tab={detailTab}
        lang={lang}
        currency={currency}
        onTabChange={setDetailTab}
        onClose={closeDetails}
      />
    </View>
  );
}

function ArticleTable({
  products,
  families,
  columns,
  lang,
  isRefreshing,
  isFetching,
  onRefresh,
  onOpenFilters,
  onOpen,
  onActions,
  filterValues,
  selectedIds,
  onFilterChange,
  onToggleSelected,
  onToggleAll,
  onEndReached,
  hasMore,
  emptyTitle,
  emptySubtitle,
}: {
  products: Product[];
  families: ProductFamily[];
  columns: ArticleColumnKey[];
  lang: string;
  isRefreshing: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onOpenFilters: () => void;
  onOpen: (product: Product) => void;
  onActions: (product: Product) => void;
  filterValues: ArticleFilters;
  selectedIds: number[];
  onFilterChange: (key: keyof ArticleFilters, value: string) => void;
  onToggleSelected: (productId: number) => void;
  onToggleAll: () => void;
  onEndReached: () => void;
  hasMore: boolean;
  emptyTitle: string;
  emptySubtitle?: string;
}) {
  const orderedColumns = ARTICLE_COLUMNS.filter((column) => columns.includes(column.key));
  const minTableWidth = orderedColumns.reduce((sum, column) => sum + column.width, 52);
  const allSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.tableOuter}
      contentContainerStyle={{ minWidth: minTableWidth }}
    >
      <View style={{ minWidth: minTableWidth, flex: 1 }}>
        <View style={styles.tableHeader}>
          <View style={[styles.tableCheckboxCell, { width: 52 }]}>
            <Pressable onPress={onToggleAll} style={[styles.tableCheckbox, allSelected && styles.tableCheckboxChecked]} testID="checkbox-select-all-articles">
              {allSelected ? <Feather name="check" size={14} color="#fff" /> : null}
            </Pressable>
          </View>
          {orderedColumns.map((column) => (
            <View key={column.key} style={[styles.tableHeaderCell, { width: column.width }]}>
              <Text style={styles.tableHeaderText}>{column.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.tableFilterRow}>
          <View style={[styles.tableCheckboxCell, { width: 52 }]} />
          {orderedColumns.map((column) => (
              <View key={column.key} style={[styles.tableFilterCell, { width: column.width }]}>
                {column.filterKey ? (
                  <TextInput
                    value={String(filterValues[column.filterKey] ?? "")}
                    onChangeText={(value) => onFilterChange(column.filterKey!, value)}
                    placeholder="abc  Filtre ..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.tableFilterInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={column.key === "stock" || column.key === "colisage" || column.key === "weight" ? "decimal-pad" : "default"}
                    returnKeyType="search"
                    testID={`input-column-filter-${column.key}`}
                  />
                ) : column.key === "actions" || column.key === "image" ? null : (
                  <Pressable onPress={onOpenFilters} style={styles.tableFilterTrigger} testID={`button-column-filter-${column.key}`}>
                    <Text style={styles.tableFilterText}>abc&nbsp; Filtre ...</Text>
                  </Pressable>
                )}
              </View>
          ))}
        </View>
        {isFetching ? (
          <View style={styles.tableFetching}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.refreshText}>{lang === "ar" ? "جارٍ التحديث..." : "Mise à jour..."}</Text>
          </View>
        ) : null}
        <FlatList
          data={products}
          keyExtractor={(product) => String(product.id)}
          contentContainerStyle={products.length === 0 ? styles.tableEmptyContent : styles.tableListContent}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          scrollEnabled
          ListEmptyComponent={<EmptyState title={emptyTitle} subtitle={emptySubtitle} />}
          renderItem={({ item }) => (
            <ArticleTableRow
              product={item}
              families={families}
              columns={orderedColumns}
              lang={lang}
              onOpen={() => onOpen(item)}
              onActions={() => onActions(item)}
              selected={selectedIds.includes(item.id)}
              onToggleSelected={() => onToggleSelected(item.id)}
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={hasMore ? <View style={styles.tableFooter}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
        />
      </View>
    </ScrollView>
  );
}

function ArticleTableRow({
  product,
  families,
  columns,
  lang,
  onOpen,
  onActions,
  selected,
  onToggleSelected,
}: {
  product: Product;
  families: ProductFamily[];
  columns: Array<{ key: ArticleColumnKey; label: string; width: number }>;
  lang: string;
  onOpen: () => void;
  onActions: () => void;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={styles.tableRow} testID={`row-product-${product.id}`}>
      <View style={[styles.tableCheckboxCell, { width: 52 }]}>
        <Pressable onPress={onToggleSelected} style={[styles.tableCheckbox, selected && styles.tableCheckboxChecked]} testID={`checkbox-product-${product.id}`}>
          {selected ? <Feather name="check" size={14} color="#fff" /> : null}
        </Pressable>
      </View>
      {columns.map((column) => (
        <View key={column.key} style={[styles.tableCell, { width: column.width }]}>
          {column.key === "actions" ? (
            <Pressable onPress={onActions} style={styles.rowActionsButton} hitSlop={4} testID={`button-product-actions-${product.id}`}>
              <Feather name="more-vertical" size={20} color={colors.text} />
            </Pressable>
          ) : (
            <TableCellValue product={product} families={families} column={column.key} lang={lang} />
          )}
        </View>
      ))}
    </Pressable>
  );
}

function TableCellValue({ product, families, column, lang }: { product: Product; families: ProductFamily[]; column: ArticleColumnKey; lang: string }) {
  const value = tableValue(product, column, lang, families);
  if (column === "isExposed") {
    return (
      <Badge label={product.isExposed ? "Oui" : "Non"} tone={product.isExposed ? "info" : "muted"} />
    );
  }
  if (column === "isActive") {
    return (
      <View style={[styles.statusDot, { backgroundColor: product.isActive === false ? colors.danger : colors.success }]}>
        <Text style={styles.statusDotText}>{product.isActive === false ? "—" : "✓"}</Text>
      </View>
    );
  }
  if (column === "vitrine") {
    return (
      <View style={styles.exposedCell}>
        <Feather name={product.isExposed ? "eye" : "eye-off"} size={17} color={product.isExposed ? colors.success : colors.textMuted} />
      </View>
    );
  }
  if (column === "image") {
    return product.imageUrl ? (
      <Image source={{ uri: product.imageUrl }} style={styles.tableProductImage} resizeMode="cover" />
    ) : (
      <View style={[styles.tableProductImage, styles.imagePlaceholder]}>
        <Feather name="image" size={17} color={colors.textMuted} />
      </View>
    );
  }
  if (column === "stock") {
    const stock = Number(product.stock ?? 0);
    return <Text style={[styles.tableCellText, stock <= 0 ? styles.stockEmpty : stock < 5 ? styles.stockLow : styles.stockOk]}>{stock}</Text>;
  }
  if (column === "catalogueType") {
    return <Badge label={value === "—" ? "—" : value} tone={value === "—" ? "muted" : "info"} />;
  }
  return <Text style={styles.tableCellText} numberOfLines={1}>{value}</Text>;
}

function tableValue(product: Product, column: ArticleColumnKey, lang: string, families: ProductFamily[] = []): string {
  switch (column) {
    case "id": return String(product.id);
    case "name": return lang === "ar" ? product.nameAr : product.nameEn;
    case "description": return (lang === "ar" ? product.descriptionAr : product.descriptionEn) ?? "—";
    case "barcode": return product.barcode ?? "—";
    case "reference": return product.reference ?? "—";
    case "catalogueType": return product.catalogueType ?? "—";
    case "createdAt": return product.createdAt ? new Date(product.createdAt).toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR") : "—";
    case "isActive": return product.isActive === false ? "Inactif" : "Actif";
    case "price": return formatArticleMoney(product.price, lang);
    case "priceGros": return formatArticleMoney(product.priceGros, lang);
    case "priceSemiGros": return formatArticleMoney(product.priceSemiGros, lang);
    case "priceMin": return formatArticleMoney(product.priceMin, lang);
    case "costPrice": return formatArticleMoney(product.costPrice, lang);
    case "stock": return String(product.stock ?? 0);
    case "brand": return product.brand ?? (product.brandId ? `#${product.brandId}` : "—");
    case "model": return product.model ?? "—";
    case "color": return product.color ?? (product.colorId ? `#${product.colorId}` : "—");
    case "family": {
      if (!product.familyId) return "—";
      const family = families.find((item) => item.id === product.familyId);
      return family ? (lang === "ar" ? family.nameAr : family.nameFr) : `#${product.familyId}`;
    }
    case "colisage": return product.colisage == null ? "—" : String(product.colisage);
    case "weight": return product.weight ?? "—";
    case "catalogue1": return product.catalogue1 ?? "—";
    case "catalogue2": return product.catalogue2 ?? "—";
    case "catalogue3": return product.catalogue3 ?? "—";
    case "catalogue4": return product.catalogue4 ?? "—";
    case "catalogue5": return product.catalogue5 ?? "—";
    case "catalogue6": return product.catalogue6 ?? "—";
    case "isExposed": return product.isExposed ? "Oui" : "Non";
    case "vitrine": return product.isExposed ? "Oui" : "Non";
    case "actions":
    case "image":
    default: return lang === "ar" ? product.nameAr : product.nameEn;
  }
}

function formatArticleMoney(value: string | null | undefined, lang: string) {
  if (value == null || value === "") return "—";
  const amount = Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount)) return String(value);
  const formatted = amount.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${lang === "ar" ? "دج" : "DA"}`;
}

function ProductActionsSheet({
  product,
  visible,
  canEdit,
  canDelete,
  canHistory,
  canTransfer,
  canAdjustStock,
  onClose,
  onEdit,
  onDetails,
  onHistory,
  onDelete,
  onImages,
  onInventory,
  onTransfer,
  onPrices,
  onBarcode,
  onDuplicate,
}: {
  product: Product | null;
  visible: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canHistory: boolean;
  canTransfer: boolean;
  canAdjustStock: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDetails: (product: Product) => void;
  onHistory: (product: Product) => void;
  onDelete: (product: Product) => void;
  onImages: (product: Product) => void;
  onInventory: () => void;
  onTransfer: () => void;
  onPrices: (product: Product) => void;
  onBarcode: (product: Product) => void;
  onDuplicate: (product: Product) => void;
}) {
  const { t } = useLang();
  if (!product) return null;

  const Action = ({
    icon,
    label,
    onPress,
    destructive = false,
    disabled = false,
  }: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }) => (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.productAction, disabled && styles.productActionDisabled]} testID={`product-action-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <Feather name={icon} size={18} color={disabled ? colors.textMuted : destructive ? colors.danger : colors.primary} />
      <Text style={[styles.productActionText, destructive && styles.productActionDanger, disabled && styles.productActionMuted]}>{label}</Text>
    </Pressable>
  );

  return (
    <SheetModal visible={visible} onClose={onClose} title={t("Actions de l'article", "إجراءات المقال")} scrollable={false}>
      <Text style={styles.actionProductName} numberOfLines={2}>{product.nameEn}</Text>
      <Action icon="edit-2" label={t("Modifier", "تعديل")} onPress={() => onEdit(product)} disabled={!canEdit} />
      <Action icon="image" label={t("Images", "الصور")} onPress={() => onImages(product)} disabled={!canEdit} />
      <Action icon="copy" label={t("Dupliquer", "نسخ")} onPress={() => onDuplicate(product)} disabled={!canEdit} />
      <Action icon="send" label={t("Envoyer vers magasin", "إرسال إلى متجر")} onPress={onTransfer} disabled={!canTransfer} />
      <Action icon="info" label={t("Détails", "التفاصيل")} onPress={() => onDetails(product)} />
      <Action icon="rotate-ccw" label={t("Historique", "السجل")} onPress={() => onHistory(product)} disabled={!canHistory} />
      <View style={styles.actionSeparator} />
      <Action icon="share-2" label={t("Partager code-barres", "مشاركة الباركود")} onPress={() => onBarcode(product)} disabled={!product.barcode} />
      <Action icon="archive" label={t("Gestion stock", "إدارة المخزون")} onPress={onInventory} disabled={!canAdjustStock} />
      <Action icon="dollar-sign" label={t("Prix", "الأسعار")} onPress={() => onPrices(product)} disabled={!canEdit} />
      <View style={styles.actionSeparator} />
      <Action icon="trash-2" label={t("Supprimer", "حذف")} onPress={() => onDelete(product)} destructive disabled={!canDelete} />
    </SheetModal>
  );
}

function ProductDetailsSheet({
  visible,
  product,
  families,
  history,
  historyLoading,
  historyError,
  historyAllowed,
  tab,
  lang,
  currency,
  onTabChange,
  onClose,
}: {
  visible: boolean;
  product: Product | null;
  families: ProductFamily[];
  history?: ProductHistoryResponse;
  historyLoading: boolean;
  historyError: boolean;
  historyAllowed: boolean;
  tab: DetailTab;
  lang: string;
  currency: string;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  if (!product) return null;
  const tabs: Array<{ key: DetailTab; label: string; restricted?: boolean }> = [
    { key: "informations", label: t("Informations", "معلومات") },
    { key: "achats", label: t("Achats", "المشتريات"), restricted: true },
    { key: "ventes", label: t("Ventes", "المبيعات"), restricted: true },
    { key: "resume", label: t("Résumé", "ملخص"), restricted: true },
    { key: "mouvements", label: t("Mouvements", "الحركات"), restricted: true },
  ];
  const name = lang === "ar" ? product.nameAr : product.nameEn;

  return (
    <SheetModal visible={visible} onClose={onClose} title={`${t("Détails du produit", "تفاصيل المنتج")} — ${name}`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs}>
        {tabs.map((item) => (
          <Pressable key={item.key} onPress={() => onTabChange(item.key)} disabled={item.restricted && !historyAllowed} style={[styles.detailTab, item.key === tab && styles.detailTabActive, item.restricted && !historyAllowed && styles.detailTabDisabled]} testID={`product-detail-tab-${item.key}`}>
            <Text style={[styles.detailTabText, item.key === tab && styles.detailTabTextActive, item.restricted && !historyAllowed && styles.detailTabTextDisabled]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {tab === "informations" ? <ProductInformation product={product} families={families} currency={currency} t={t} lang={lang} /> : null}
      {!historyAllowed && tab !== "informations" ? <HistoryEmpty icon="lock" text={t("Historique réservé à l'administrateur", "السجل متاح للمسؤول فقط")} /> : null}
      {historyAllowed && historyError ? <HistoryEmpty icon="alert-circle" text={t("Impossible de charger l'historique", "تعذر تحميل السجل")} /> : null}
      {historyAllowed && !historyError && tab === "achats" ? <PurchaseHistory history={history} loading={historyLoading} currency={currency} t={t} /> : null}
      {historyAllowed && !historyError && tab === "ventes" ? <SalesHistory history={history} loading={historyLoading} currency={currency} t={t} /> : null}
      {historyAllowed && !historyError && tab === "resume" ? <ProductSummary product={product} history={history} loading={historyLoading} currency={currency} t={t} /> : null}
      {historyAllowed && !historyError && tab === "mouvements" ? <MovementHistory history={history} loading={historyLoading} lang={lang} t={t} /> : null}
    </SheetModal>
  );
}

function ProductInformation({ product, families, currency, t, lang }: { product: Product; families: ProductFamily[]; currency: string; t: (fr: string, ar: string) => string; lang: string }) {
  const family = product.familyId ? families.find((item) => item.id === product.familyId) : null;
  const fields: Array<[string, string]> = [
    [t("Nom (arabe)", "الاسم بالعربية"), product.nameAr],
    [t("Nom (français)", "الاسم بالفرنسية"), product.nameEn],
    [t("Référence", "المرجع"), product.reference ?? "—"],
    [t("Code-barres", "الباركود"), product.barcode ?? "—"],
    [t("Catalogue", "الكتالوج"), product.catalogueType ?? "—"],
    [t("Marque", "الماركة"), product.brand ?? "—"],
    [t("Stock actuel", "المخزون الحالي"), String(product.stock ?? 0)],
    [t("Prix de vente", "سعر البيع"), `${formatAmount(product.price)} ${currency}`],
    [t("Prix de revient", "سعر التكلفة"), product.costPrice ? `${formatAmount(product.costPrice)} ${currency}` : "—"],
    [t("Prix en gros", "سعر الجملة"), product.priceGros ? `${formatAmount(product.priceGros)} ${currency}` : "—"],
    [t("Modèle", "الموديل"), product.model ?? "—"],
    [t("Couleur", "اللون"), product.color ?? "—"],
    [t("Famille", "العائلة"), family ? (lang === "ar" ? family.nameAr : family.nameFr) : product.familyId ? `#${product.familyId}` : "—"],
    [t("Colisage", "التعبئة"), product.colisage == null ? "—" : String(product.colisage)],
    [t("Poids", "الوزن"), product.weight ?? "—"],
  ];
  return <View style={styles.detailGrid}>{fields.map(([label, value]) => <View key={label} style={styles.detailField}><Text style={styles.detailFieldLabel}>{label}</Text><Text style={styles.detailFieldValue}>{value}</Text></View>)}</View>;
}

function ProductSummary({ product, history, loading, currency, t }: { product: Product; history?: ProductHistoryResponse; loading: boolean; currency: string; t: (fr: string, ar: string) => string }) {
  const purchases = history?.purchases ?? [];
  const sales = history?.sales ?? [];
  const customerReturns = history?.returns ?? [];
  const supplierReturns = history?.supplierReturns ?? [];
  const bought = purchases.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const sold = sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const lastPurchase = purchases[0];
  const lastSale = sales[0];
  return (
    <View style={styles.summaryGrid}>
      <SummaryCard icon="shopping-cart" label={t("Dernier achat", "آخر شراء")} value={lastPurchase ? `${formatAmount(lastPurchase.unitCost)} ${currency}` : t("Aucun", "لا يوجد")} />
      <SummaryCard icon="trending-up" label={t("Dernière vente", "آخر بيع")} value={lastSale ? `${formatAmount(lastSale.unitPrice)} ${currency}` : t("Aucune", "لا توجد")} />
      <SummaryCard icon="package" label={t("Total quantités achetées", "إجمالي المشتريات")} value={loading ? "…" : String(bought)} />
      <SummaryCard icon="bar-chart-2" label={t("Total quantités vendues", "إجمالي المبيعات")} value={loading ? "…" : String(sold)} />
      <SummaryCard icon="corner-up-left" label={t("Retours clients", "مرتجعات العملاء")} value={loading ? "…" : String(customerReturns.reduce((sum, item) => sum + Number(item.quantity || 0), 0))} />
      <SummaryCard icon="corner-down-left" label={t("Retours fournisseurs", "مرتجعات الموردين")} value={loading ? "…" : String(supplierReturns.reduce((sum, item) => sum + Number(item.quantity || 0), 0))} />
      <View style={styles.summaryStock}><Text style={styles.summaryStockLabel}>{t("Stock actuel", "المخزون الحالي")}</Text><Text style={styles.summaryStockValue}>{product.stock} {t("unité(s)", "وحدة")}</Text></View>
    </View>
  );
}

function SummaryCard({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return <View style={styles.summaryCard}><Feather name={icon} size={20} color={colors.primary} /><Text style={styles.summaryCardLabel}>{label}</Text><Text style={styles.summaryCardValue}>{value}</Text></View>;
}

function PurchaseHistory({ history, loading, currency, t }: { history?: ProductHistoryResponse; loading: boolean; currency: string; t: (fr: string, ar: string) => string }) {
  if (loading) return <LoadingView label={t("Chargement des achats...", "جارٍ تحميل المشتريات...")} />;
  const entries = history?.purchases ?? [];
  const returns = history?.supplierReturns ?? [];
  if (!entries.length && !returns.length) return <HistoryEmpty icon="package" text={t("Aucun achat enregistré pour ce produit", "لا توجد مشتريات مسجلة لهذا المنتج")} />;
  return (
    <View>
      {entries.map((entry) => <HistoryRow key={`${entry.purchaseOrderId}-${entry.storeId}-${entry.createdAt ?? ""}`} icon="shopping-cart" title={`${t("Achat", "شراء")} #${entry.purchaseOrderId}`} subtitle={`${entry.supplierName ?? t("Fournisseur inconnu", "مورد غير معروف")} · ${entry.status}`} value={`×${entry.quantity} · ${formatAmount(entry.unitCost)} ${currency}`} />)}
      {returns.map((entry) => <HistoryRow key={`supplier-return-${entry.id}`} icon="corner-down-left" title={`${t("Retour fournisseur", "مرتجع مورد")} #${entry.bonRetourFournisseurId}`} subtitle={`${entry.supplierName ?? t("Fournisseur inconnu", "مورد غير معروف")}${entry.reason ? ` · ${entry.reason}` : ""}`} value={`−${entry.quantity} · ${formatAmount(entry.unitCost)} ${currency}`} />)}
    </View>
  );
}

function SalesHistory({ history, loading, currency, t }: { history?: ProductHistoryResponse; loading: boolean; currency: string; t: (fr: string, ar: string) => string }) {
  if (loading) return <LoadingView label={t("Chargement des ventes...", "جارٍ تحميل المبيعات...")} />;
  const entries = history?.sales ?? [];
  const returns = history?.returns ?? [];
  if (!entries.length && !returns.length) return <HistoryEmpty icon="trending-up" text={t("Aucune vente enregistrée pour ce produit", "لا توجد مبيعات مسجلة لهذا المنتج")} />;
  return (
    <View>
      {entries.map((entry) => <HistoryRow key={`${entry.orderId}-${entry.storeId}-${entry.createdAt ?? ""}`} icon="trending-up" title={`${t("Vente", "بيع")} #${entry.orderId}`} subtitle={`${entry.customerName ?? t("Client inconnu", "عميل غير معروف")} · ${entry.status}`} value={`×${entry.quantity} · ${formatAmount(entry.unitPrice)} ${currency}`} />)}
      {returns.map((entry) => <HistoryRow key={`customer-return-${entry.id}`} icon="corner-up-left" title={`${t("Retour client", "مرتجع عميل")} #${entry.bonRetourId}`} subtitle={`${entry.customerName ?? t("Client inconnu", "عميل غير معروف")}${entry.reason ? ` · ${entry.reason}` : ""}`} value={`−${entry.quantity} · ${formatAmount(entry.unitPrice)} ${currency}`} />)}
    </View>
  );
}

function MovementHistory({ history, loading, lang, t }: { history?: ProductHistoryResponse; loading: boolean; lang: string; t: (fr: string, ar: string) => string }) {
  if (loading) return <LoadingView label={t("Chargement de l'historique...", "جارٍ تحميل السجل...")} />;
  const entries = history?.timeline ?? [];
  const customerReturns = history?.returns ?? [];
  const supplierReturns = history?.supplierReturns ?? [];
  if (!entries.length && !customerReturns.length && !supplierReturns.length) return <HistoryEmpty icon="activity" text={t("Aucun mouvement enregistré pour ce produit", "لا توجد حركات مسجلة لهذا المنتج")} />;
  return <View>{entries.map((entry) => {
    const title = entry.kind === "movement" ? entry.movementType : t("Transfert", "تحويل");
    const place = entry.kind === "movement"
      ? (lang === "ar" ? entry.storeNameAr : entry.storeNameEn)
      : `${lang === "ar" ? entry.sourceStoreNameAr : entry.sourceStoreNameEn} → ${lang === "ar" ? entry.destStoreNameAr : entry.destStoreNameEn}`;
    const reference = entry.kind === "movement" ? entry.reference : null;
    return <HistoryRow key={entry.id} icon="activity" title={title} subtitle={`${place ?? ""}${reference ? ` · ${reference}` : ""}`} value={`${entry.quantity > 0 ? "+" : ""}${entry.quantity}`} />;
  })}
    {customerReturns.map((entry) => <HistoryRow key={`movement-customer-return-${entry.id}`} icon="corner-up-left" title={t("Retour client", "مرتجع عميل")} subtitle={`${entry.customerName ?? ""}${entry.reason ? ` · ${entry.reason}` : ""}`} value={`+${entry.quantity}`} />)}
    {supplierReturns.map((entry) => <HistoryRow key={`movement-supplier-return-${entry.id}`} icon="corner-down-left" title={t("Retour fournisseur", "مرتجع مورد")} subtitle={`${entry.supplierName ?? ""}${entry.reason ? ` · ${entry.reason}` : ""}`} value={`−${entry.quantity}`} />)}
  </View>;
}

function HistoryRow({ icon, title, subtitle, value }: { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string; value: string }) {
  return <View style={styles.historyRow}><Feather name={icon} size={18} color={colors.primary} /><View style={styles.historyText}><Text style={styles.historyTitle}>{title}</Text><Text style={styles.historySubtitle}>{subtitle}</Text></View><Text style={styles.historyValue}>{value}</Text></View>;
}

function HistoryEmpty({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return <View style={styles.historyEmpty}><Feather name={icon} size={34} color={colors.border} /><Text style={styles.historyEmptyText}>{text}</Text></View>;
}

function formatAmount(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00";
}

function ArticleCard({
  product,
  lang,
  currency,
  compact,
  canEdit,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: {
  product: Product;
  lang: string;
  currency: string;
  compact: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primaryImage = product.primaryImage ?? product.imageUrl ?? product.images?.[0]?.url ?? null;
  const stock = Number(product.stock ?? 0);
  const title = lang === "ar" ? product.nameAr : product.nameEn;
  const secondary = product.reference ?? product.barcode ?? `#${product.id}`;
  const statusTone = product.isActive === false ? "muted" : stock <= 0 ? "danger" : stock < 5 ? "warning" : "success";

  return (
    <Pressable onPress={onOpen} style={[styles.articleCard, compact && styles.articleCardCompact]} testID={`row-product-${product.id}`}>
      <View style={[styles.cardTop, compact && styles.cardTopCompact]}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={[styles.articleImage, compact && styles.articleImageCompact]} />
        ) : (
          <View style={[styles.articleImage, styles.imagePlaceholder, compact && styles.articleImageCompact]}>
            <Feather name="package" size={compact ? 23 : 28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.articleIdentity}>
          <Text style={styles.articleName} numberOfLines={compact ? 2 : 1}>{title}</Text>
          <Text style={styles.articleSecondary} numberOfLines={1}>{secondary}</Text>
          {!compact && product.brand ? <Text style={styles.articleMeta} numberOfLines={1}>{product.brand}{product.model ? ` · ${product.model}` : ""}</Text> : null}
        </View>
        <Badge label={product.isActive === false ? "INACTIF" : product.isExposed ? "VITRINE" : "ACTIF"} tone={product.isActive === false ? "muted" : product.isExposed ? "info" : "success"} />
      </View>

      <View style={styles.metrics}>
        <Metric label="STOCK" value={String(stock)} tone={statusTone} />
        <Metric label="PRIX VENTE" value={`${Number(product.price ?? 0).toLocaleString("fr-FR")} ${currency}`} />
        <Metric label="PRIX GROS" value={product.priceGros ? `${Number(product.priceGros).toLocaleString("fr-FR")} ${currency}` : "—"} />
      </View>

      {!compact ? (
        <View style={styles.detailLine}>
          <Text style={styles.detailText}>{product.categoryId ? `Cat. #${product.categoryId}` : "Sans catégorie"}</Text>
          <Text style={styles.detailText}>{product.barcode ?? "Sans code-barres"}</Text>
          {product.colisage ? <Text style={styles.detailText}>×{product.colisage}</Text> : null}
        </View>
      ) : null}

      <View style={styles.cardActions}>
        <Pressable onPress={onOpen} style={styles.cardAction}>
          <Feather name="eye" size={15} color={colors.textMuted} />
          <Text style={styles.cardActionText}>Voir</Text>
        </Pressable>
        {canEdit ? (
          <Pressable onPress={onEdit} style={styles.cardAction}>
            <Feather name="edit-2" size={15} color={colors.primary} />
            <Text style={[styles.cardActionText, { color: colors.primary }]}>Modifier</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable onPress={onDelete} style={[styles.cardAction, styles.deleteAction]}>
            <Feather name="trash-2" size={15} color={colors.danger} />
            <Text style={[styles.cardActionText, { color: colors.danger }]}>Supprimer</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === "danger" && styles.metricDanger, tone === "warning" && styles.metricWarning, tone === "success" && styles.metricSuccess]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleBlock: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  count: { color: colors.textMuted, fontSize: 12, marginTop: 3, marginLeft: 27 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAction: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  viewToggle: { width: 38, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3FA" },
  tabsScroll: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 9 },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  bulkBar: { minHeight: 46, marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EEF3FA", flexDirection: "row", alignItems: "center", gap: 12 },
  bulkCount: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: "800" },
  bulkAction: { minHeight: 32, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  bulkActionText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  searchWrap: { flex: 1 },
  sortButton: { height: 45, minWidth: 68, paddingHorizontal: 9, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  sortButtonText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  filterButton: { width: 45, height: 45, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge: { position: "absolute", right: -4, top: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  quickFilters: { paddingHorizontal: 16, paddingVertical: 9, gap: 8 },
  quickFilter: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  quickFilterText: { color: colors.text, fontSize: 12, fontWeight: "500" },
  listContent: { padding: 12, paddingBottom: 100 },
  gridRow: { gap: 10, paddingHorizontal: 12 },
  gridItem: { flex: 1, maxWidth: "50%" },
  articleCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 12, marginBottom: 10 },
  articleCardCompact: { padding: 9, minHeight: 245 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTopCompact: { alignItems: "flex-start", flexDirection: "column" },
  articleImage: { width: 68, height: 68, borderRadius: 10, backgroundColor: colors.background },
  articleImageCompact: { width: "100%", height: 112, borderRadius: 10 },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  articleIdentity: { flex: 1, minWidth: 0 },
  articleName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  articleSecondary: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  articleMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  metrics: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, marginTop: 11, paddingTop: 10, gap: 8 },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700", marginBottom: 3 },
  metricValue: { color: colors.text, fontSize: 12, fontWeight: "800" },
  metricDanger: { color: colors.danger },
  metricWarning: { color: colors.warning },
  metricSuccess: { color: colors.success },
  detailLine: { flexDirection: "row", gap: 8, marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  detailText: { flex: 1, color: colors.textMuted, fontSize: 10 },
  cardActions: { flexDirection: "row", gap: 7, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border },
  cardAction: { flex: 1, minHeight: 34, borderRadius: 8, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  deleteAction: { backgroundColor: "#FFF1F2" },
  cardActionText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  refreshNotice: { flexDirection: "row", alignItems: "center", gap: 7, padding: 8, justifyContent: "center" },
  refreshText: { color: colors.textMuted, fontSize: 12 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  filterFooter: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1 },
  filterHint: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 9, backgroundColor: "#EEF3FA", marginBottom: 14 },
  filterHintText: { flex: 1, color: colors.primary, fontSize: 12 },
  filterSectionLabel: { color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 4, marginBottom: 12 },
  columnsButton: { height: 45, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  columnsButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  sheetHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  columnOption: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  columnOptionText: { color: colors.text, fontSize: 15 },
  columnsFooter: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
  columnsFooterButton: { flex: 1, alignItems: "center", paddingVertical: 11 },
  columnsFooterText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  checkbox: { width: 21, height: 21, borderRadius: 4, borderWidth: 1, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tableOuter: { flex: 1, marginTop: 12, marginHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  tableHeader: { height: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#FAFBFC" },
  tableHeaderCell: { height: "100%", justifyContent: "center", paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: colors.border },
  tableHeaderText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  tableCheckboxCell: { alignItems: "center", justifyContent: "center", height: "100%" },
  tableCheckbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  tableCheckboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tableActionsHeader: { height: "100%", borderLeftWidth: 1, borderLeftColor: colors.border },
  tableFilterRow: { height: 47, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  tableFilterCell: { height: "100%", justifyContent: "center", paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: colors.border },
  tableFilterInput: { width: "100%", minHeight: 31, color: colors.text, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 4 },
  tableFilterTrigger: { width: "100%", minHeight: 31, justifyContent: "center" },
  tableFilterText: { color: colors.textMuted, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 },
  tableFetching: { height: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableListContent: { paddingBottom: 90 },
  tableFooter: { paddingVertical: 16, alignItems: "center" },
  tableEmptyContent: { flexGrow: 1, minHeight: 300 },
  tableRow: { minHeight: 78, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  tableCell: { justifyContent: "center", paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: colors.border },
  tableCellText: { color: colors.text, fontSize: 13 },
  tableProductImage: { width: 42, height: 42, borderRadius: 7, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  rowActionsButton: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  statusDot: { width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statusDotText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  stockEmpty: { color: colors.danger, fontWeight: "800" },
  stockLow: { color: colors.warning, fontWeight: "800" },
  stockOk: { color: colors.success, fontWeight: "800" },
  exposedCell: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  tableActionsCell: { alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.border },
  productAction: { minHeight: 47, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 5 },
  productActionDisabled: { opacity: 0.42 },
  productActionText: { color: colors.text, fontSize: 16 },
  productActionDanger: { color: colors.danger },
  productActionMuted: { color: colors.textMuted },
  actionProductName: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  stockProductTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20, marginBottom: 14 },
  actionSeparator: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  detailTabs: { gap: 3, backgroundColor: colors.background, borderRadius: 10, padding: 4, marginBottom: 14 },
  detailTab: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8 },
  detailTabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  detailTabDisabled: { opacity: 0.45 },
  detailTabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  detailTabTextActive: { color: colors.text, fontWeight: "800" },
  detailTabTextDisabled: { color: colors.textMuted },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailField: { width: "48%", minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface },
  detailFieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  detailFieldValue: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 116, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface },
  summaryCardLabel: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  summaryCardValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  summaryStock: { width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, marginTop: 2 },
  summaryStockLabel: { color: colors.textMuted, fontSize: 13 },
  summaryStockValue: { color: colors.primary, fontSize: 20, fontWeight: "800", marginTop: 5 },
  historyRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyText: { flex: 1, minWidth: 0 },
  historyTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  historySubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  historyValue: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  historyEmpty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 12 },
  historyEmptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
});