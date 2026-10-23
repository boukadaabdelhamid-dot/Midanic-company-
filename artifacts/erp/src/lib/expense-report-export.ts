import type { ExpenseReportItem } from "@workspace/erp-api-client-react";

type ExportOptions = {
  from: string;
  to: string;
  lang: string;
  storeName: string;
  items: ExpenseReportItem[];
  categoryFilter?: string;
  search?: string;
};

const translations = {
  fr: {
    title: "Détail des charges", from: "Du", to: "Au", store: "Magasin",
    date: "Date", category: "Catégorie", description: "Détail", reference: "Référence",
    amount: "Montant (DA)", total: "Total (DA)", empty: "Aucune charge pour cette période.",
    print: "Imprimer / PDF", categoryFilter: "Filtre catégorie", allCategories: "Toutes les catégories",
    search: "Recherche", allResults: "Tous les résultats",
  },
  ar: {
    title: "تفاصيل المصاريف", from: "من", to: "إلى", store: "المتجر",
    date: "التاريخ", category: "الفئة", description: "التفصيل", reference: "المرجع",
    amount: "المبلغ (دج)", total: "الإجمالي (دج)", empty: "لا توجد مصاريف في هذه الفترة.",
    print: "طباعة / PDF", categoryFilter: "تصفية الفئة", allCategories: "كل الفئات",
    search: "البحث", allResults: "كل النتائج",
  },
  en: {
    title: "Expense details", from: "From", to: "To", store: "Store",
    date: "Date", category: "Category", description: "Description", reference: "Reference",
    amount: "Amount (DA)", total: "Total (DA)", empty: "No expenses in this period.",
    print: "Print / PDF", categoryFilter: "Category filter", allCategories: "All categories",
    search: "Search", allResults: "All results",
  },
};

const categoryLabels: Record<string, [string, string, string]> = {
  salary: ["Salaire", "راتب", "Salary"],
  rent: ["Loyer", "إيجار", "Rent"],
  utilities: ["Services publics", "مرافق", "Utilities"],
  marketing: ["Marketing", "تسويق", "Marketing"],
  other: ["Autre", "أخرى", "Other"],
};

export function getExpenseCategoryLabel(category: string, lang: string) {
  const labels = categoryLabels[category];
  return labels ? labels[lang === "ar" ? 1 : lang === "en" ? 2 : 0] : category;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

export function filterExpenseReportItems(
  items: ExpenseReportItem[],
  search: string,
  category: string,
) {
  const query = normalizeSearch(search.trim());
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!query) return true;
    return normalizeSearch(`${item.description ?? ""} ${item.reference ?? ""}`).includes(query);
  });
}

function getReport(options: ExportOptions) {
  const lang = options.lang === "ar" || options.lang === "en" ? options.lang : "fr";
  const labels = translations[lang];
  const headers = [labels.date, labels.category, labels.description, labels.reference, labels.amount];
  const rows = options.items.map((item) => [
    item.createdAt.slice(0, 10),
    getExpenseCategoryLabel(item.category, lang),
    item.description || "—",
    item.reference || "—",
    Number(item.amount),
  ]);
  const total = options.items.reduce((sum, item) => sum + Number(item.amount), 0);
  const selectedCategory = options.categoryFilter && options.categoryFilter !== "all"
    ? getExpenseCategoryLabel(options.categoryFilter, lang) : labels.allCategories;
  const search = options.search?.trim() || labels.allResults;
  return { lang, labels, headers, rows, total, selectedCategory, search };
}

function csvCell(value: string | number) {
  if (typeof value === "number") return `"${value.toFixed(2)}"`;
  // Quoting alone does not stop spreadsheet formulas in user-entered text.
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value)
    ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildExpenseReportCsv(options: ExportOptions) {
  const { labels, headers, rows, total, selectedCategory, search } = getReport(options);
  const data = [
    [labels.title, "", "", "", ""],
    [labels.store, options.storeName, "", "", ""],
    [labels.from, options.from, labels.to, options.to, ""],
    [labels.categoryFilter, selectedCategory, "", "", ""],
    [labels.search, search, "", "", ""],
    headers,
    ...rows,
    [labels.total, "", "", "", total],
  ];
  return "\uFEFF" + data.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export function buildExpenseReportPrintHtml(options: ExportOptions) {
  const { lang, labels, headers, rows, total, selectedCategory, search } = getReport(options);
  const direction = lang === "ar" ? "rtl" : "ltr";
  const money = (value: number) => value.toLocaleString(
    lang === "ar" ? "ar-DZ" : lang === "en" ? "en-GB" : "fr-DZ",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  const body = rows.map((row) =>
    `<tr>${row.map((cell) => `<td${typeof cell === "number" ? ' class="number"' : ""}>${escapeHtml(typeof cell === "number" ? money(cell) : cell)}</td>`).join("")}</tr>`
  ).join("");

  return `<!doctype html>
<html lang="${lang}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(labels.title)} — ${escapeHtml(options.from)} — ${escapeHtml(options.to)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { color: #172033; font: 12px Arial, sans-serif; direction: ${direction}; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .meta { margin-bottom: 16px; line-height: 1.8; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: start; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
    th { background: #f1f5f9; }
    thead { display: table-header-group; break-inside: avoid; page-break-inside: avoid; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .number { direction: ltr; text-align: end; font-variant-numeric: tabular-nums; }
    .total { text-align: end; font-size: 15px; font-weight: bold; margin-top: 16px; }
    @media print { .print-button { display: none; } }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">${escapeHtml(labels.print)}</button>
  <h1>${escapeHtml(labels.title)}</h1>
  <div class="meta">
    <div>${escapeHtml(labels.store)}: ${escapeHtml(options.storeName)}</div>
    <div>${escapeHtml(labels.from)}: ${escapeHtml(options.from)} — ${escapeHtml(labels.to)}: ${escapeHtml(options.to)}</div>
    <div>${escapeHtml(labels.categoryFilter)}: ${escapeHtml(selectedCategory)}</div>
    <div>${escapeHtml(labels.search)}: ${escapeHtml(search)}</div>
  </div>
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${body || `<tr><td colspan="5">${escapeHtml(labels.empty)}</td></tr>`}</tbody>
  </table>
  <p class="total">${escapeHtml(labels.total)}: <bdi>${escapeHtml(money(total))}</bdi></p>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`;
}
