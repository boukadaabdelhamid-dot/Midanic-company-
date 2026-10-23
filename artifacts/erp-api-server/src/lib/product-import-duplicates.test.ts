import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProductImportDuplicates,
  type ProductImportBarcodeRow,
} from "./product-import-duplicates";

function row(index: number, barcode: string, error: string | null = null): ProductImportBarcodeRow {
  return {
    index,
    barcode,
    error,
    isDuplicate: false,
    existingProductId: null,
    duplicateTargetIndex: null,
  };
}

test("marks repeated valid rows in the workbook and points to the first row", () => {
  const result = classifyProductImportDuplicates(
    [row(0, "7350071076231"), row(1, "7350071076231"), row(2, "0099001")],
    new Map(),
  );

  assert.equal(result[0].isDuplicate, false);
  assert.equal(result[1].isDuplicate, true);
  assert.equal(result[1].duplicateTargetIndex, 0);
  assert.equal(result[2].isDuplicate, false);
});

test("marks products already in the store as existing duplicates", () => {
  const result = classifyProductImportDuplicates(
    [row(0, " 7350071076231 "), row(1, "7350071076231")],
    new Map([["7350071076231", 42]]),
  );

  assert.deepEqual(
    result.map(({ isDuplicate, existingProductId, duplicateTargetIndex }) => ({
      isDuplicate,
      existingProductId,
      duplicateTargetIndex,
    })),
    [
      { isDuplicate: true, existingProductId: 42, duplicateTargetIndex: null },
      { isDuplicate: true, existingProductId: 42, duplicateTargetIndex: null },
    ],
  );
});

test("an invalid row does not claim a barcode from a later valid row", () => {
  const result = classifyProductImportDuplicates(
    [row(0, "ABC-1", "Price invalid"), row(1, "ABC-1")],
    new Map(),
  );

  assert.equal(result[0].isDuplicate, false);
  assert.equal(result[1].isDuplicate, false);
});

test("keeps leading zeroes and treats barcode values as strings", () => {
  const result = classifyProductImportDuplicates(
    [row(0, "001234"), row(1, "001234"), row(2, "1234")],
    new Map(),
  );

  assert.equal(result[1].duplicateTargetIndex, 0);
  assert.equal(result[2].isDuplicate, false);
});
