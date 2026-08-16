import React, { useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator } from "react-native";
import {
  useGetCategories, getGetCategoriesQueryKey,
  useGetErpSettingsProductsBrands, useGetErpSettingsProductsFamilies,
  useGetErpSettingsProductsColors, useGetErpSettingsProductsTypes,
  getGetErpSettingsProductsBrandsQueryKey,
  getGetErpSettingsProductsFamiliesQueryKey,
  getGetErpSettingsProductsColorsQueryKey,
  getGetErpSettingsProductsTypesQueryKey,
  type Category, type Product, type ProductImage,
} from "@workspace/api-client-react";
import { useLang } from "@/contexts/lang-context";
import { Card, Button, FormField, SectionTitle, Divider } from "@/components/ui";
import { PickerField } from "@/components/Picker";
import { colors } from "@/lib/colors";

export type ProductFormValues = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: string;
  costPrice: string;
  priceGros: string;
  priceSemiGros: string;
  priceMin: string;
  stock: string;
  minStock: string;
  reference: string;
  barcode: string;
  brand: string;
  model: string;
  color: string;
  catalogueType: string;
  colisage: string;
  weight: string;
  catalogue1: string;
  catalogue2: string;
  catalogue3: string;
  catalogue4: string;
  catalogue5: string;
  catalogue6: string;
  categoryId: number | null;
  familyId: number | null;
  brandId: number | null;
  colorId: number | null;
  isActive: boolean;
  isExposed: boolean;
};

export function emptyProductForm(): ProductFormValues {
  return {
    nameEn: "",
    nameAr: "",
    descriptionEn: "",
    descriptionAr: "",
    price: "",
    costPrice: "",
    priceGros: "",
    priceSemiGros: "",
    priceMin: "",
    stock: "0",
    minStock: "",
    reference: "",
    barcode: "",
    brand: "",
    model: "",
    color: "",
    catalogueType: "ARTICLE",
    colisage: "1",
    weight: "",
    catalogue1: "",
    catalogue2: "",
    catalogue3: "",
    catalogue4: "",
    catalogue5: "",
    catalogue6: "",
    categoryId: null,
    familyId: null,
    brandId: null,
    colorId: null,
    isActive: true,
    isExposed: true,
  };
}

export function productToForm(p: Product): ProductFormValues {
  const extended = p as Product & { minStock?: number | null };
  return {
    nameEn: p.nameEn ?? "",
    nameAr: p.nameAr ?? "",
    descriptionEn: p.descriptionEn ?? "",
    descriptionAr: p.descriptionAr ?? "",
    price: p.price != null ? String(p.price) : "",
    costPrice: p.costPrice != null ? String(p.costPrice) : "",
    priceGros: p.priceGros != null ? String(p.priceGros) : "",
    priceSemiGros: p.priceSemiGros != null ? String(p.priceSemiGros) : "",
    priceMin: p.priceMin != null ? String(p.priceMin) : "",
    stock: p.stock != null ? String(p.stock) : "0",
    minStock: extended.minStock != null ? String(extended.minStock) : "",
    reference: p.reference ?? "",
    barcode: p.barcode ?? "",
    brand: p.brand ?? "",
    model: p.model ?? "",
    color: p.color ?? "",
    catalogueType: p.catalogueType ?? "ARTICLE",
    colisage: p.colisage != null ? String(p.colisage) : "1",
    weight: p.weight != null ? String(p.weight) : "",
    catalogue1: p.catalogue1 ?? "",
    catalogue2: p.catalogue2 ?? "",
    catalogue3: p.catalogue3 ?? "",
    catalogue4: p.catalogue4 ?? "",
    catalogue5: p.catalogue5 ?? "",
    catalogue6: p.catalogue6 ?? "",
    categoryId: p.categoryId ?? null,
    familyId: p.familyId ?? null,
    brandId: p.brandId ?? null,
    colorId: p.colorId ?? null,
    isActive: p.isActive ?? true,
    isExposed: p.isExposed ?? true,
  };
}

/**
 * Shared create/edit product form, mirroring the web ERP's product dialog
 * fields. `mode="create"` also shows the initial stock field (stock can only
 * be seeded at creation — later changes flow through inventory movements /
 * purchase receptions, matching the web app).
 */
export function ProductForm({
  mode,
  values,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  enhancedEdit = false,
  images = [],
  onAddImage,
  onRemoveImage,
  onSetPrimaryImage,
  onMoveImage,
  onTakePhoto,
  uploadingImage = false,
  onGenerateBarcode,
  generatingBarcode = false,
}: {
  mode: "create" | "edit";
  values: ProductFormValues;
  onChange: (next: ProductFormValues) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  enhancedEdit?: boolean;
  images?: ProductImage[];
  onAddImage?: () => void;
  onRemoveImage?: (image: ProductImage) => void;
  onSetPrimaryImage?: (image: ProductImage) => void;
  onMoveImage?: (image: ProductImage, direction: -1 | 1) => void;
  onTakePhoto?: () => void;
  uploadingImage?: boolean;
  onGenerateBarcode?: () => void;
  generatingBarcode?: boolean;
}) {
  const { t, lang } = useLang();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categoriesData } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() },
  });
  const categories = (categoriesData ?? []) as Category[];
  const selectedCategory = categories.find((c) => c.id === values.categoryId) ?? null;
  const familiesQ = useGetErpSettingsProductsFamilies({
    query: { enabled: enhancedEdit, queryKey: getGetErpSettingsProductsFamiliesQueryKey() },
  });
  const brandsQ = useGetErpSettingsProductsBrands({
    query: { enabled: enhancedEdit, queryKey: getGetErpSettingsProductsBrandsQueryKey() },
  });
  const colorsQ = useGetErpSettingsProductsColors({
    query: { enabled: enhancedEdit, queryKey: getGetErpSettingsProductsColorsQueryKey() },
  });
  const typesQ = useGetErpSettingsProductsTypes({
    query: { enabled: enhancedEdit, queryKey: getGetErpSettingsProductsTypesQueryKey() },
  });
  const families = familiesQ.data?.items ?? [];
  const brands = brandsQ.data?.items ?? [];
  const productColors = colorsQ.data?.items ?? [];
  const productTypes = typesQ.data?.items ?? [];
  const selectedFamily = families.find((item) => item.id === values.familyId) ?? null;
  const selectedBrand = brands.find((item) => item.id === values.brandId) ?? null;
  const selectedColor = productColors.find((item) => item.id === values.colorId) ?? null;
  const selectedType = productTypes.find((item) => item.nameFr === values.catalogueType || item.nameAr === values.catalogueType) ?? null;

  function set<K extends keyof ProductFormValues>(key: K, v: ProductFormValues[K]) {
    onChange({ ...values, [key]: v });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!values.nameEn.trim()) next.nameEn = t("Requis", "مطلوب");
    if (!values.nameAr.trim()) next.nameAr = t("Requis", "مطلوب");
    if (!values.price.trim() || !isValidNumber(values.price) || parseNumber(values.price) < 0) next.price = t("Prix invalide", "سعر غير صالح");
    for (const [key, label] of [
      ["costPrice", t("prix de revient", "سعر التكلفة")],
      ["priceGros", t("prix gros", "سعر الجملة")],
      ["priceSemiGros", t("prix semi-gros", "سعر نصف الجملة")],
      ["priceMin", t("prix minimum", "السعر الأدنى")],
      ["weight", t("poids", "الوزن")],
      ["colisage", t("colisage", "التعبئة")],
      ["stock", t("stock", "المخزون")],
      ["minStock", t("seuil d'alerte", "حد التنبيه")],
    ] as const) {
      const value = values[key];
      if (value.trim() && (!isValidNumber(value) || parseNumber(value) < 0)) next[key] = t(`Valeur invalide: ${label}`, `قيمة غير صالحة: ${label}`);
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit();
  }

  return (
    <View>
      <Card>
        <SectionTitle>{t("Identité", "الهوية")}</SectionTitle>
        <FormField label={t("Nom du produit", "اسم المنتج (فرنسي)")} value={values.nameEn} onChangeText={(v) => set("nameEn", v)} error={errors.nameEn} />
        <FormField label={t("Nom (arabe)", "الاسم بالعربية")} value={values.nameAr} onChangeText={(v) => set("nameAr", v)} error={errors.nameAr} />
        <PickerField<Category>
          label={t("Catégorie", "الفئة")}
          value={selectedCategory}
          items={categories}
          keyExtractor={(c) => String(c.id)}
          labelExtractor={(c) => (lang === "ar" ? c.nameAr : c.nameEn)}
          onChange={(c) => set("categoryId", c.id)}
          allowClear
          onClear={() => set("categoryId", null)}
          placeholder={t("Aucune catégorie", "بدون فئة")}
        />
        {enhancedEdit ? (
          <>
            <FormField label={t("Description", "الوصف")} value={values.descriptionEn} onChangeText={(v) => set("descriptionEn", v)} multiline />
            <FormField label={t("Description (arabe)", "الوصف بالعربية")} value={values.descriptionAr} onChangeText={(v) => set("descriptionAr", v)} multiline />
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t("Prix", "الأسعار")}</SectionTitle>
        <FormField label={t("Prix de vente", "سعر البيع")} value={values.price} onChangeText={(v) => set("price", v)} keyboardType="decimal-pad" error={errors.price} />
        <FormField label={t("Prix de revient", "سعر التكلفة")} value={values.costPrice} onChangeText={(v) => set("costPrice", v)} keyboardType="decimal-pad" error={errors.costPrice} />
        <FormField label={t("Prix gros", "سعر الجملة")} value={values.priceGros} onChangeText={(v) => set("priceGros", v)} keyboardType="decimal-pad" error={errors.priceGros} />
        {enhancedEdit ? (
          <>
            <FormField label={t("Prix semi-gros", "سعر نصف الجملة")} value={values.priceSemiGros} onChangeText={(v) => set("priceSemiGros", v)} keyboardType="decimal-pad" error={errors.priceSemiGros} />
            <FormField label={t("Prix minimum", "السعر الأدنى")} value={values.priceMin} onChangeText={(v) => set("priceMin", v)} keyboardType="decimal-pad" error={errors.priceMin} />
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t("Stock", "المخزون")}</SectionTitle>
        {mode === "create" ? (
          <FormField label={t("Stock initial", "المخزون الابتدائي")} value={values.stock} onChangeText={(v) => set("stock", v)} keyboardType="numeric" error={errors.stock} />
        ) : null}
        <FormField label={t("Seuil d'alerte", "حد التنبيه")} value={values.minStock} onChangeText={(v) => set("minStock", v)} keyboardType="numeric" error={errors.minStock} />
      </Card>

      <Card>
        <SectionTitle>{t("Identification", "التعريف")}</SectionTitle>
        <FormField label={t("Référence", "المرجع")} value={values.reference} onChangeText={(v) => set("reference", v)} autoCapitalize="none" />
        <FormField label={t("Code-barres", "الرمز الشريطي")} value={values.barcode} onChangeText={(v) => set("barcode", v)} autoCapitalize="none" keyboardType="numeric" />
        {onGenerateBarcode ? (
          <Button
            label={t("Générer un code-barres unique", "إنشاء باركود فريد")}
            variant="secondary"
            onPress={onGenerateBarcode}
            loading={generatingBarcode}
            style={styles.barcodeButton}
          />
        ) : null}
        <FormField label={t("Marque", "الماركة")} value={values.brand} onChangeText={(v) => set("brand", v)} />
        <FormField label={t("Modèle", "الموديل")} value={values.model} onChangeText={(v) => set("model", v)} />
        <FormField label={t("Couleur", "اللون")} value={values.color} onChangeText={(v) => set("color", v)} />
        {enhancedEdit ? (
          <>
            <PickerField
              label={t("Famille", "العائلة")}
              value={selectedFamily}
              items={families}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => lang === "ar" ? item.nameAr : item.nameFr}
              onChange={(item) => set("familyId", item.id)}
              allowClear
              onClear={() => set("familyId", null)}
              placeholder={t("Aucune famille", "بدون عائلة")}
            />
            <PickerField
              label={t("Marque liée", "الماركة المرتبطة")}
              value={selectedBrand}
              items={brands}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => lang === "ar" ? item.nameAr : item.nameFr}
              onChange={(item) => set("brandId", item.id)}
              allowClear
              onClear={() => set("brandId", null)}
              placeholder={t("Aucune marque", "بدون ماركة")}
            />
            <PickerField
              label={t("Couleur liée", "اللون المرتبط")}
              value={selectedColor}
              items={productColors}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => lang === "ar" ? item.nameAr : item.nameFr}
              onChange={(item) => set("colorId", item.id)}
              allowClear
              onClear={() => set("colorId", null)}
              placeholder={t("Aucune couleur", "بدون لون")}
            />
          </>
        ) : null}
      </Card>

      {enhancedEdit ? (
        <>
          <Card>
            <SectionTitle>{t("Logistique", "اللوجستيك")}</SectionTitle>
            <PickerField
              label={t("Type de catalogue", "نوع الكتالوج")}
              value={selectedType}
              items={productTypes}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => lang === "ar" ? item.nameAr : item.nameFr}
              onChange={(item) => set("catalogueType", item.nameFr)}
              placeholder={t("ARTICLE", "مقال")}
            />
        <FormField label={t("Colisage", "عدد القطع في الطرد")} value={values.colisage} onChangeText={(v) => set("colisage", v)} keyboardType="numeric" error={errors.colisage} />
        <FormField label={t("Poids", "الوزن")} value={values.weight} onChangeText={(v) => set("weight", v)} keyboardType="decimal-pad" error={errors.weight} />
          </Card>
          <Card>
            <SectionTitle>{t("Champs catalogue", "حقول الكتالوج")}</SectionTitle>
            {([
              ["catalogue1", "Catalogue 1"],
              ["catalogue2", "Catalogue 2"],
              ["catalogue3", "Catalogue 3"],
              ["catalogue4", "Catalogue 4"],
              ["catalogue5", "Catalogue 5"],
              ["catalogue6", "Catalogue 6"],
            ] as const).map(([key, label]) => (
              <FormField key={key} label={label} value={values[key]} onChangeText={(v) => set(key, v)} />
            ))}
          </Card>
          {onAddImage ? <Card>
            <SectionTitle>{t("Images du produit", "صور المنتج")}</SectionTitle>
            <View style={styles.imageGrid}>
              {images.map((image) => (
                <View key={image.id || image.url} style={styles.imageItem}>
                  <Image source={{ uri: image.url }} style={styles.productImage} resizeMode="cover" />
                  <View style={styles.imageControls}>
                    {image.isPrimary ? <Text style={styles.primaryLabel}>{t("Principale", "رئيسية")}</Text> : (
                      <Pressable onPress={() => onSetPrimaryImage?.(image)} style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>{t("Choisir", "اختيار")}</Text>
                      </Pressable>
                    )}
                    {onMoveImage ? (
                      <View style={styles.reorderRow}>
                        <Pressable onPress={() => onMoveImage(image, -1)} hitSlop={6} disabled={images[0]?.url === image.url}>
                          <Text style={[styles.reorderText, images[0]?.url === image.url && styles.disabledText]}>‹</Text>
                        </Pressable>
                        <Pressable onPress={() => onMoveImage(image, 1)} hitSlop={6} disabled={images[images.length - 1]?.url === image.url}>
                          <Text style={[styles.reorderText, images[images.length - 1]?.url === image.url && styles.disabledText]}>›</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => onRemoveImage?.(image)} style={styles.removeImage} hitSlop={8}>
                    <Text style={styles.removeImageText}>×</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={onAddImage} disabled={uploadingImage} style={styles.addImage}>
                {uploadingImage ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.addImageText}>＋</Text>}
                <Text style={styles.addImageLabel}>{t("Ajouter", "إضافة")}</Text>
              </Pressable>
              {onTakePhoto ? (
                <Pressable onPress={onTakePhoto} disabled={uploadingImage} style={styles.addImage}>
                  <Text style={styles.cameraIcon}>⌾</Text>
                  <Text style={styles.addImageLabel}>{t("Caméra", "الكاميرا")}</Text>
                </Pressable>
              ) : null}
            </View>
          </Card> : null}
        </>
      ) : null}

      <Card>
        <SectionTitle>{t("Visibilité", "الظهور")}</SectionTitle>
        <ToggleRow label={t("Produit actif", "منتج نشط")} value={values.isActive} onChange={(v) => set("isActive", v)} />
        <Divider />
        <ToggleRow label={t("Visible en vitrine", "ظاهر في الواجهة")} value={values.isExposed} onChange={(v) => set("isExposed", v)} />
      </Card>

      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} testID="button-submit-product" />
    </View>
  );
}

function isValidNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  return normalized !== "" && Number.isFinite(Number(normalized));
}

function parseNumber(value: string) {
  return Number(value.trim().replace(",", "."));
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Button label={value ? "✓" : ""} variant={value ? "primary" : "secondary"} onPress={() => onChange(!value)} style={styles.toggleBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  toggleLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
  toggleBtn: { width: 44, paddingVertical: 6 },
  barcodeButton: { marginBottom: 4 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageItem: { width: 100, height: 124, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border, position: "relative" },
  productImage: { width: "100%", height: 92, backgroundColor: colors.background },
  primaryLabel: { height: 31, paddingTop: 6, textAlign: "center", color: colors.success, fontSize: 11, fontWeight: "700" },
  primaryButton: { height: 31, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  primaryButtonText: { color: colors.primary, fontSize: 11, fontWeight: "600" },
  imageControls: { height: 31, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, backgroundColor: colors.background },
  reorderRow: { flexDirection: "row", gap: 6 },
  reorderText: { color: colors.primary, fontSize: 20, lineHeight: 20, fontWeight: "700" },
  disabledText: { color: colors.border },
  cameraIcon: { color: colors.primary, fontSize: 26, lineHeight: 30 },
  removeImage: { position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  removeImageText: { color: "#fff", fontSize: 18, lineHeight: 20 },
  addImage: { width: 100, height: 124, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  addImageText: { color: colors.primary, fontSize: 30, lineHeight: 34 },
  addImageLabel: { color: colors.primary, fontSize: 12, fontWeight: "600" },
});
