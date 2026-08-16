import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminOrdersQueryKey,
  getGetErpCustomersQueryKey,
  getGetProductsQueryKey,
  type CustomerSummary,
  type Product,
  useCreateOrder,
  useGetErpCustomers,
  useGetProducts,
} from "@workspace/api-client-react";
import { Card, Button, Divider, EmptyState, ErrorState, FormField, LoadingView, SectionTitle } from "@/components/ui";
import { PickerField } from "@/components/Picker";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useLang } from "@/contexts/lang-context";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { colors } from "@/lib/colors";

type CartLine = { product: Product; quantity: number };

export default function PosScreen() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "orders" });
  const { t, lang, isRTL } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const currency = lang === "ar" ? "دج" : "DA";

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [paymentMode, setPaymentMode] = useState<"comptant" | "terme">("comptant");
  const [versement, setVersement] = useState("");

  const productsParams = { limit: 9999 };
  const { data: productsData, isLoading: productsLoading } = useGetProducts(productsParams, {
    query: { enabled: ready, queryKey: getGetProductsQueryKey(productsParams) },
  });
  const products = ((productsData as { products?: Product[] } | undefined)?.products ?? []).filter((p) => p.stock > 0);

  const customersParams = {};
  const { data: customersData } = useGetErpCustomers(customersParams, {
    query: { enabled: ready, queryKey: getGetErpCustomersQueryKey(customersParams) },
  });
  const customers = ((customersData as unknown as { data?: CustomerSummary[] })?.data ?? []) as CustomerSummary[];

  const createOrder = useCreateOrder();
  const canCreate = isAdmin || can("orders", "create");
  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0),
    [cart],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.nameAr, product.nameEn, product.reference, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [products, search]);

  if (!ready) return null;
  if (!canCreate) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];
      if (existing.quantity >= product.stock) return current;
      return current.map((line) =>
        line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    setCart((current) =>
      current.map((line) => (line.product.id === productId ? { ...line, quantity } : line)),
    );
  }

  function removeProduct(productId: number) {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  }

  function selectCustomer(selected: CustomerSummary) {
    setCustomer(selected);
  }

  function submitSale() {
    if (cart.length === 0) {
      feedback.error(null, "Ajoutez au moins un produit", "أضف منتجًا واحدًا على الأقل");
      return;
    }
    if (paymentMode === "terme" && !customer) {
      feedback.error(
        null,
        "Une vente à terme requiert un client sélectionné",
        "البيع الآجل يتطلب اختيار عميل",
      );
      return;
    }

    const downPayment = paymentMode === "terme" ? Math.max(0, Number(versement) || 0) : undefined;
    if (downPayment != null && downPayment > total) {
      feedback.error(null, "L'acompte ne peut pas dépasser le total", "لا يمكن أن تتجاوز الدفعة الأولى الإجمالي");
      return;
    }

    createOrder.mutate(
      {
        data: {
          customerName: customer?.name ?? t("Vente comptoir", "بيع في المتجر"),
          customerPhone: customer?.phone ?? "0000000000",
          customerAddress: customer?.address ?? t("Vente comptoir", "بيع في المتجر"),
          items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          linkedCustomerId: customer?.id ?? null,
          paymentMode,
          versement: downPayment,
        },
      },
      {
        onSuccess: (order) => {
          feedback.success("Vente enregistrée", "تم تسجيل البيع");
          queryClient.invalidateQueries({ queryKey: getGetAdminOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey(productsParams) });
          router.replace(`/orders/${order.id}` as never);
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function renderCart() {
    return (
      <Card style={styles.cartCard}>
        <View style={[styles.sectionHeader, isRTL && styles.rowRTL]}>
          <SectionTitle>{t("Panier", "السلة")}</SectionTitle>
          <Text style={styles.cartCount}>
            {cart.length} {t("article(s)", "منتج")}
          </Text>
        </View>
        {cart.length === 0 ? (
          <Text style={styles.muted}>{t("Touchez un produit pour l'ajouter", "اضغط على منتج لإضافته")}</Text>
        ) : (
          cart.map((line, index) => (
            <View key={line.product.id}>
              {index > 0 ? <Divider /> : null}
              <View style={[styles.cartLine, isRTL && styles.rowRTL]}>
                <View style={styles.cartInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {lang === "ar" ? line.product.nameAr : line.product.nameEn}
                  </Text>
                  <Text style={styles.productMeta}>
                    {(Number(line.product.price) * line.quantity).toLocaleString("fr-FR")} {currency}
                  </Text>
                </View>
                <QuantityStepper
                  value={line.quantity}
                  onChange={(quantity) => updateQuantity(line.product.id, quantity)}
                  max={line.product.stock}
                />
                <Pressable
                  onPress={() => removeProduct(line.product.id)}
                  hitSlop={8}
                  testID={`pos-remove-${line.product.id}`}
                >
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))
        )}
        <Divider />
        <View style={[styles.totalRow, isRTL && styles.rowRTL]}>
          <Text style={styles.totalLabel}>{t("Total", "الإجمالي")}</Text>
          <Text style={styles.totalValue}>{total.toLocaleString("fr-FR")} {currency}</Text>
        </View>
      </Card>
    );
  }

  function renderCheckout() {
    return (
      <Card style={styles.checkoutCard}>
        <SectionTitle>{t("Paiement", "الدفع")}</SectionTitle>
        <View style={[styles.paymentRow, isRTL && styles.rowRTL]}>
          <Button
            label={t("Comptant", "نقدًا")}
            variant={paymentMode === "comptant" ? "primary" : "secondary"}
            onPress={() => setPaymentMode("comptant")}
            style={styles.paymentButton}
            testID="pos-payment-comptant"
          />
          <Button
            label={t("À terme", "آجل")}
            variant={paymentMode === "terme" ? "primary" : "secondary"}
            onPress={() => setPaymentMode("terme")}
            style={styles.paymentButton}
            testID="pos-payment-terme"
          />
        </View>
        {paymentMode === "terme" ? (
          <>
            <PickerField<CustomerSummary>
              label={t("Client obligatoire", "العميل مطلوب")}
              value={customer}
              items={customers}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => item.name}
              subtitleExtractor={(item) => item.phone ?? undefined}
              onChange={selectCustomer}
              placeholder={t("Sélectionner un client", "اختر عميلًا")}
              searchPlaceholder={t("Rechercher un client...", "بحث عن عميل...")}
            />
            <FormField
              label={t("Acompte", "الدفعة الأولى")}
              value={versement}
              onChangeText={setVersement}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </>
        ) : null}
        <Button
          label={t("Enregistrer la vente", "تسجيل البيع")}
          onPress={submitSale}
          loading={createOrder.isPending}
          disabled={cart.length === 0}
          icon={<Feather name="check-circle" size={18} color="#fff" />}
          testID="pos-submit-sale"
        />
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Feather name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("Rechercher par nom, référence ou code-barres", "ابحث بالاسم أو المرجع أو الرمز الشريطي")}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            testID="pos-product-search"
          />
        </View>
      </View>
      <FlatList
        data={filteredProducts}
        keyExtractor={(product) => String(product.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {renderCart()}
            {renderCheckout()}
            <Text style={styles.productsHeading}>{t("Produits disponibles", "المنتجات المتاحة")}</Text>
          </View>
        }
        ListEmptyComponent={
          productsLoading ? <LoadingView /> : <EmptyState title={t("Aucun produit trouvé", "لم يتم العثور على منتجات")} />
        }
        renderItem={({ item: product }) => (
          <Pressable
            onPress={() => addProduct(product)}
            style={({ pressed }) => [styles.productRow, pressed && styles.productRowPressed]}
            testID={`pos-product-${product.id}`}
          >
            <View style={styles.productIcon}>
              <Feather name="package" size={19} color={colors.primary} />
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={1}>
                {lang === "ar" ? product.nameAr : product.nameEn}
              </Text>
              <Text style={styles.productMeta} numberOfLines={1}>
                {product.reference ?? product.barcode ?? t("Sans référence", "بدون مرجع")}
              </Text>
            </View>
            <View style={styles.productPrice}>
              <Text style={styles.priceText}>{Number(product.price).toLocaleString("fr-FR")} {currency}</Text>
              <Text style={styles.stockText}>{t("Stock", "المخزون")}: {product.stock}</Text>
            </View>
            <Feather name="plus-circle" size={22} color={colors.primary} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: { backgroundColor: colors.background, paddingTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 11 },
  listContent: { paddingHorizontal: 16, paddingBottom: 36 },
  cartCard: { marginBottom: 12 },
  checkoutCard: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowRTL: { flexDirection: "row-reverse" },
  cartCount: { color: colors.textMuted, fontSize: 12 },
  muted: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  cartLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  cartInfo: { flex: 1 },
  productName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  productMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  totalValue: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  paymentRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  paymentButton: { flex: 1 },
  productsHeading: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  productRowPressed: { backgroundColor: colors.background },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F7",
  },
  productDetails: { flex: 1, minWidth: 0 },
  productPrice: { alignItems: "flex-end" },
  priceText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  stockText: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});