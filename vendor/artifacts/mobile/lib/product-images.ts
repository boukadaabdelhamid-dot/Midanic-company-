import type { Product, ProductImage } from "@workspace/api-client-react";
import { Platform } from "react-native";
import { getActiveBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";

export function normalizeProductImages(product: Pick<Product, "images" | "imageUrl">): ProductImage[] {
  if (product.images?.length) {
    return product.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image, index) => ({ ...image, sortOrder: index }));
  }
  return product.imageUrl
    ? [{ id: -1, productId: 0, url: product.imageUrl, sortOrder: 0, isPrimary: true }]
    : [];
}

export function normalizeLocalImages(images: ProductImage[], productId = 0): ProductImage[] {
  const next = images.map((image, index) => ({
    ...image,
    productId,
    sortOrder: index,
    isPrimary: index === 0 ? image.isPrimary || !images.some((item) => item.isPrimary) : image.isPrimary,
  }));
  if (next.length && !next.some((image) => image.isPrimary)) {
    next[0] = { ...next[0], isPrimary: true };
  }
  return next;
}

export function moveProductImage(images: ProductImage[], index: number, direction: -1 | 1, productId = 0): ProductImage[] {
  const nextIndex = index + direction;
  if (index < 0 || index >= images.length || nextIndex < 0 || nextIndex >= images.length) return images;
  const next = images.slice();
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return normalizeLocalImages(next, productId);
}

export async function uploadProductImage(uri: string): Promise<string> {
  const formData = new FormData();
  if (Platform.OS === "web") {
    // Expo Web gives us a browser URI/blob URL. A React Native-style
    // { uri, type, name } object is not treated as a file by browser FormData.
    const fileResponse = await fetch(uri);
    if (!fileResponse.ok) {
      throw new Error(`Impossible de lire l'image: ${fileResponse.status}`);
    }
    const blob = await fileResponse.blob();
    const mimeType = blob.type || "image/jpeg";
    const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    formData.append("file", blob, `product.${extension}`);
  } else {
    formData.append("file", {
      uri,
      type: "image/jpeg",
      name: "product.jpg",
    } as unknown as Blob);
  }

  const token = getToken();
  const response = await fetch(`${getActiveBaseUrl()}/api/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    let detail = "";
    try {
      const errorBody = (await response.json()) as { error?: string };
      detail = errorBody.error ? ` — ${errorBody.error}` : "";
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(`Upload failed: ${response.status}${detail}`);
  }

  const data = (await response.json()) as { url?: string; publicUrl?: string };
  const url = data.publicUrl ?? data.url;
  if (!url) throw new Error("No URL in upload response");
  return url;
}