import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useCreateProduct, getGetProductQueryKey, getGetProductsQueryKey, useGetProduct, useGenerateProductBarcode, type CreateProductRequest, type ProductImage } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { ErrorState } from "@/components/ui";
import { ProductForm, emptyProductForm, productToForm, type ProductFormValues } from "@/components/ProductForm";
import { moveProductImage, normalizeLocalImages, normalizeProductImages, uploadProductImage } from "@/lib/product-images";

export default function NewProduct() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "products" });
  const { t } = useLang();
  const router = useRouter();
  const { duplicateFrom } = useLocalSearchParams<{ duplicateFrom?: string }>();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();

  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [duplicateHydrated, setDuplicateHydrated] = useState(false);
  const createProduct = useCreateProduct();
  const generateBarcode = useGenerateProductBarcode();
  const duplicateProductId = Number(duplicateFrom);
  const duplicateProductQ = useGetProduct(duplicateProductId, {
    query: {
      enabled: ready && Number.isInteger(duplicateProductId) && duplicateProductId > 0,
      queryKey: getGetProductQueryKey(duplicateProductId),
    },
  });

  useEffect(() => {
    if (!duplicateProductQ.data || duplicateHydrated) return;
    const copied = productToForm(duplicateProductQ.data);
    setValues({
      ...copied,
      nameEn: `${copied.nameEn} (copie)`,
      nameAr: `${copied.nameAr} (نسخة)`,
      reference: "",
      barcode: "",
      stock: "0",
    });
    setImages(normalizeProductImages(duplicateProductQ.data).map((image, index) => ({
      ...image,
      id: -Date.now() - index,
      productId: 0,
      sortOrder: index,
    })));
    setDuplicateHydrated(true);
  }, [duplicateProductQ.data, duplicateHydrated]);

  if (!ready) return null;
  const canCreate = isAdmin || can("products", "create");
  if (!canCreate) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function handleSubmit() {
    const normalizedImages = normalizeLocalImages(images);
    const payload = {
      nameEn: values.nameEn.trim(),
      nameAr: values.nameAr.trim(),
      price: normalizeDecimal(values.price),
      stock: parseNumber(values.stock) || 0,
      categoryId: values.categoryId,
      reference: values.reference.trim() || null,
      barcode: values.barcode.trim() || null,
      costPrice: optionalDecimal(values.costPrice),
      priceGros: optionalDecimal(values.priceGros),
      priceSemiGros: optionalDecimal(values.priceSemiGros),
      priceMin: optionalDecimal(values.priceMin),
      brand: values.brand.trim() || null,
      model: values.model.trim() || null,
      color: values.color.trim() || null,
      catalogueType: values.catalogueType.trim() || "ARTICLE",
      colisage: values.colisage.trim() ? parseNumber(values.colisage) : null,
      weight: optionalDecimal(values.weight),
      catalogue1: values.catalogue1.trim() || null,
      catalogue2: values.catalogue2.trim() || null,
      catalogue3: values.catalogue3.trim() || null,
      catalogue4: values.catalogue4.trim() || null,
      catalogue5: values.catalogue5.trim() || null,
      catalogue6: values.catalogue6.trim() || null,
      descriptionEn: values.descriptionEn.trim(),
      descriptionAr: values.descriptionAr.trim(),
      familyId: values.familyId,
      brandId: values.brandId,
      colorId: values.colorId,
      minStock: values.minStock.trim() ? parseNumber(values.minStock) : null,
      isActive: values.isActive,
      isExposed: values.isExposed,
      imageUrl: normalizedImages.find((image) => image.isPrimary)?.url ?? normalizedImages[0]?.url ?? null,
      images: normalizedImages.map((image, index) => ({
        url: image.url,
        sortOrder: index,
        isPrimary: image.isPrimary,
      })),
    } as unknown as CreateProductRequest;

    createProduct.mutate(
      { data: payload },
      {
        onSuccess: (product) => {
          feedback.success("Produit créé", "تم إنشاء المنتج");
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
          router.replace(`/products/${product.id}` as never);
        },
        onError: (e) => feedback.error(e),
      },
    );
  }

  async function handleAddImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      feedback.error(new Error(t("Permission galerie refusée", "رُفض الوصول إلى المعرض")));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingImage(true);
    try {
      const url = await uploadProductImage(result.assets[0].uri);
      setImages((current) => normalizeLocalImages([
        ...current,
        { id: -Date.now(), productId: 0, url, sortOrder: current.length, isPrimary: current.length === 0 },
      ]));
    } catch (error) {
      feedback.error(error);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      feedback.error(new Error(t("Permission caméra refusée", "رُفض الوصول إلى الكاميرا")));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingImage(true);
    try {
      const url = await uploadProductImage(result.assets[0].uri);
      setImages((current) => normalizeLocalImages([...current, { id: -Date.now(), productId: 0, url, sortOrder: current.length, isPrimary: current.length === 0 }]));
    } catch (error) {
      feedback.error(error);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage(image: ProductImage) {
    setImages((current) => normalizeLocalImages(current.filter((item) => item.url !== image.url)));
  }

  function handleSetPrimaryImage(image: ProductImage) {
    setImages((current) => normalizeLocalImages(current.map((item) => ({ ...item, isPrimary: item.url === image.url }))));
  }

  function handleMoveImage(image: ProductImage, direction: -1 | 1) {
    setImages((current) => moveProductImage(current, current.findIndex((item) => item.url === image.url), direction));
  }

  function handleGenerateBarcode() {
    generateBarcode.mutate(undefined, {
      onSuccess: (result) => setValues((current) => ({ ...current, barcode: result.barcode })),
      onError: (error) => feedback.error(error),
    });
  }

  return (
    <Screen>
      <ProductForm
        mode="create"
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitting={createProduct.isPending}
        submitLabel={t("Créer le produit", "إنشاء المنتج")}
        enhancedEdit
        images={images}
        onAddImage={handleAddImage}
        onRemoveImage={handleRemoveImage}
        onSetPrimaryImage={handleSetPrimaryImage}
        onMoveImage={handleMoveImage}
        onTakePhoto={handleTakePhoto}
        uploadingImage={uploadingImage}
        onGenerateBarcode={handleGenerateBarcode}
        generatingBarcode={generateBarcode.isPending}
      />
    </Screen>
  );
}

function parseNumber(value: string) {
  return Number(value.trim().replace(",", "."));
}

function normalizeDecimal(value: string) {
  return value.trim().replace(",", ".");
}

function optionalDecimal(value: string) {
  return value.trim() ? normalizeDecimal(value) : null;
}
