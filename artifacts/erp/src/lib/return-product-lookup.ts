import type { Product } from "@workspace/erp-api-client-react";

type ProductPageLoader = (params: {
  filterCode?: string;
  filterId?: string;
  page: number;
  limit: number;
}) => Promise<{ products: Product[]; total: number }>;

const normalize = (value: string) => value.trim().toLowerCase();

/** Search the store on demand, rather than relying on the dialog's first catalog page. */
export async function findReturnProductByCode(
  input: string,
  loadPage: ProductPageLoader,
  loadExtraBarcodes: () => Promise<{ barcode: string; productId: number }[]>,
): Promise<Product | null> {
  const code = normalize(input);
  if (!code) return null;

  const find = async (
    filter: { filterCode?: string; filterId?: string },
    matches: (product: Product) => boolean,
  ) => {
    const limit = 100;
    for (let page = 1; ; page++) {
      const result = await loadPage({ ...filter, page, limit });
      const match = result.products.find(matches);
      if (match) return match;
      if (result.products.length === 0 || page * limit >= result.total) return null;
    }
  };

  const primary = await find({ filterCode: input.trim() }, (product) =>
    normalize(product.barcode ?? "") === code || normalize(product.reference ?? "") === code,
  );
  if (primary) return primary;

  const aliases = await loadExtraBarcodes();
  const alias = aliases.find((item) => normalize(item.barcode) === code);
  if (!alias) return null;
  return find({ filterId: String(alias.productId) }, (product) => product.id === alias.productId);
}
