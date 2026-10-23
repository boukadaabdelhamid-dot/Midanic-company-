import { customFetch } from "./custom-fetch";

export type ManufacturingProduct = {
  id: number;
  nameAr: string;
  nameEn: string;
  barcode: string | null;
  reference: string | null;
  stock: number;
  costPrice: string | null;
  manufacturingRole: "raw_material" | "finished_good";
};

export type ManufacturingRecipeComponent = {
  recipeId: number;
  productId: number;
  quantity: number;
  nameAr: string;
  nameEn: string;
  stock: number;
};

export type ManufacturingRecipe = {
  id: number;
  outputProductId: number;
  yieldQuantity: number;
  instructions: string | null;
  isActive: boolean;
  createdAt: string;
  outputNameAr: string;
  outputNameEn: string;
  components: ManufacturingRecipeComponent[];
};

export type ManufacturingOrderMaterial = {
  orderId: number;
  productId: number;
  requiredQuantity: number;
  consumedQuantity: number | null;
  unitCost: string | null;
  lineCost: string | null;
  nameAr: string;
  nameEn: string;
};

export type ManufacturingOrder = {
  id: number;
  recipeId: number;
  status: "planned" | "completed" | "cancelled";
  quantity: number;
  totalMaterialCost: string;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  outputProductId: number;
  outputNameAr: string;
  outputNameEn: string;
  yieldQuantity: number;
  materials: ManufacturingOrderMaterial[];
};

export type ManufacturingRecipeInput = {
  outputProductId: number;
  yieldQuantity: number;
  instructions?: string | null;
  items: Array<{ productId: number; quantity: number }>;
};

export type ManufacturingRecipeUpdate = Partial<Omit<ManufacturingRecipeInput, "outputProductId">> & {
  isActive?: boolean;
};

export const manufacturingQueryKeys = {
  catalogue: ["/api/erp/manufacturing/catalogue"] as const,
  recipes: ["/api/erp/manufacturing/recipes"] as const,
  orders: ["/api/erp/manufacturing/orders"] as const,
};

export async function getManufacturingCatalogue(): Promise<ManufacturingProduct[]> {
  const response = await customFetch<{ products: ManufacturingProduct[] }>(
    "/api/erp/manufacturing/catalogue",
  );
  return response.products;
}

export async function getManufacturingRecipes(): Promise<ManufacturingRecipe[]> {
  const response = await customFetch<{ recipes: ManufacturingRecipe[] }>(
    "/api/erp/manufacturing/recipes",
  );
  return response.recipes;
}

export async function createManufacturingRecipe(
  input: ManufacturingRecipeInput,
): Promise<{ id: number }> {
  return customFetch("/api/erp/manufacturing/recipes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateManufacturingRecipe(
  id: number,
  input: ManufacturingRecipeUpdate,
): Promise<{ id: number; updated: boolean }> {
  return customFetch(`/api/erp/manufacturing/recipes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function getManufacturingOrders(): Promise<ManufacturingOrder[]> {
  const response = await customFetch<{ orders: ManufacturingOrder[] }>(
    "/api/erp/manufacturing/orders",
  );
  return response.orders;
}

export async function createManufacturingOrder(input: {
  recipeId: number;
  quantity: number;
  notes?: string | null;
}): Promise<{ id: number }> {
  return customFetch("/api/erp/manufacturing/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completeManufacturingOrder(id: number): Promise<{
  id: number;
  status: "completed";
  quantity: number;
  totalMaterialCost: number;
}> {
  return customFetch(`/api/erp/manufacturing/orders/${id}/complete`, {
    method: "POST",
    body: "{}",
  });
}

export async function cancelManufacturingOrder(
  id: number,
): Promise<{ id: number; status: "cancelled" }> {
  return customFetch(`/api/erp/manufacturing/orders/${id}/cancel`, {
    method: "POST",
    body: "{}",
  });
}
