---
name: CSV BOM verification
description: Verify UTF-8 byte-order marks in generated CSV files without a text decoder hiding the marker.
---

When testing a generated CSV's UTF-8 BOM in Node, inspect its raw bytes (for example, convert `Blob.arrayBuffer()` with `Buffer`) rather than relying on `Blob.text()`.

**Why:** Node's UTF-8 text decoding can consume the leading BOM, making a correct CSV look as if its marker is missing.

**How to apply:** Use byte-level assertions for BOM checks; decode the rest of the CSV separately when asserting headers and cell contents.
