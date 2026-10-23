export type ProductImportBarcodeRow = {
  index: number;
  barcode: string;
  error: string | null;
  isDuplicate: boolean;
  existingProductId: number | null;
  duplicateTargetIndex: number | null;
};

/**
 * Mark barcodes already present in the store and repeated barcodes in the
 * uploaded workbook. For workbook duplicates, the first valid row is the
 * target so confirmation can update it instead of inserting another product.
 */
export function classifyProductImportDuplicates<T extends ProductImportBarcodeRow>(
  rows: T[],
  existingProducts: ReadonlyMap<string, number>,
): T[] {
  const firstRowByBarcode = new Map<string, number>();

  return rows.map((row) => {
    const barcode = row.barcode.trim();
    if (!barcode || row.error) {
      return {
        ...row,
        isDuplicate: false,
        existingProductId: null,
        duplicateTargetIndex: null,
      };
    }

    const existingProductId = existingProducts.get(barcode);
    if (existingProductId !== undefined) {
      return {
        ...row,
        isDuplicate: true,
        existingProductId,
        duplicateTargetIndex: null,
      };
    }

    const firstRowIndex = firstRowByBarcode.get(barcode);
    if (firstRowIndex !== undefined) {
      return {
        ...row,
        isDuplicate: true,
        existingProductId: null,
        duplicateTargetIndex: firstRowIndex,
      };
    }

    firstRowByBarcode.set(barcode, row.index);
    return {
      ...row,
      isDuplicate: false,
      existingProductId: null,
      duplicateTargetIndex: null,
    };
  });
}
