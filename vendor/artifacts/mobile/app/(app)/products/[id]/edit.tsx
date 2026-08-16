import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  useGetProduct,
  useUpdateProduct,
  useGenerateProductBarcode,
  getGetProductQueryKey,
  getGetProductsQueryKey,
  type ProductImage,
  type UpdateProductRequest,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { LoadingView, ErrorState } from "@/components/ui";
import { ProductForm, emptyProductForm, productToForm, type ProductFormValues } from "@/components/ProductForm";
import { moveProductImage, normalizeLocalImages, normalizeProductImages, uploadProductImage } from "@/lib/product-images";

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "products" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const productId = Number(id);

  const { data: product, isLoading, isError } = useGetProduct(productId, {
    query: { enabled: ready && !!productId, queryKey: getGetProductQueryKey(productId) },
  });

  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (product && !hydrated) {
      setValues(productToForm(product));
      setImages(normalizeProductImages(product));
      setHydrated(true);
    }
  }, [product, hydrated]);

  const updateProduct = useUpdateProduct();
  const generateBarcode = useGenerateProductBarcode();

  if (!ready) return null;
  const canEdit = isAdmin || can("products", "edit");
  if (!canEdit) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }
  if (isLoading || !hydrated) return <LoadingView />;
  if (isError || !product) return <ErrorState title={t("Produit introuvable", "المنتج غير موجود")} />;

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
        {
          id: -Date.now(),
          productId,
          url,
          sortOrder: current.length,
          isPrimary: current.length === 0,
        },
      ], productId));
    } catch (error) {
      feedback.error(error);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage(image: ProductImage) {
    setImages((current) => normalizeLocalImages(current.filter((item) => item.url !== image.url), productId));
  }

  function handleSetPrimaryImage(image: ProductImage) {
    setImages((current) => normalizeLocalImages(current.map((item) => ({ ...item, isPrimary: item.url === image.url })), productId));
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      feedback.error(new Error(t("Permission caméra refusée", "رُفض الوصول إلى الكاميرا")));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
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
        {
          id: -Date.now(),
          productId,
          url,
          sortOrder: current.length,
          isPrimary: current.length === 0,
        },
      ], productId));
    } catch (error) {
      feedback.error(error);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleMoveImage(image: ProductImage, direction: -1 | 1) {
    setImages((current) => moveProductImage(
      current,
      current.findIndex((item) => item.url === image.url),
      direction,
      productId,
    ));
  }

  function handleSubmit() {
    const payload = {
      nameEn: values.nameEn.trim(),
      nameAr: values.nameAr.trim(),
      descriptionEn: values.descriptionEn.trim(),
      descriptionAr: values.descriptionAr.trim(),
       price: normalizeDecimal(values.price),
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
      familyId: values.familyId,
      brandId: values.brandId,
      colorId: values.colorId,
       minStock: values.minStock.trim() ? parseNumber(values.minStock) : null,
      isActive: values.isActive,
      isExposed: values.isExposed,
      imageUrl: images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null,
      images: images.map((image, index) => ({
        url: image.url,
        sortOrder: index,
        isPrimary: image.isPrimary,
      })),
    } as unknown as UpdateProductRequest;

    updateProduct.mutate(
      { id: productId, data: payload },
      {
        onSuccess: () => {
          feedback.success("Produit mis à jour", "تم تحديث المنتج");
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
          router.replace(`/products/${productId}` as never);
        },
        onError: (e) => feedback.error(e),
      },
    );
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
        mode="edit"
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitting={updateProduct.isPending}
        submitLabel={t("Enregistrer", "حفظ")}
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
