import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelManufacturingOrder,
  completeManufacturingOrder,
  createManufacturingOrder,
  createManufacturingRecipe,
  getManufacturingCatalogue,
  getManufacturingOrders,
  getManufacturingRecipes,
  manufacturingQueryKeys,
  updateManufacturingRecipe,
  type ManufacturingOrder,
  type ManufacturingProduct,
  type ManufacturingRecipe,
} from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentStore } from "@/hooks/use-current-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, ArrowUpRight, Beaker, Check, ChevronDown,
  CircleAlert, ClipboardList, Factory, History, Layers3, Plus, RefreshCw,
  Search, Settings2, ShieldCheck, X,
} from "lucide-react";

type Lang = "fr" | "ar" | "en";
type Copy = Record<string, Record<Lang, string>>;
const copy: Copy = {
  title: { fr: "Atelier de production", ar: "ورشة الإنتاج", en: "Production floor" },
  subtitle: { fr: "Formules, matières premières et traçabilité des lots.", ar: "الوصفات والمواد الأولية وتتبع دفعات الإنتاج.", en: "Formulas, raw materials and batch traceability." },
  recipes: { fr: "Formules", ar: "الوصفات", en: "Recipes" },
  orders: { fr: "Ordres de fabrication", ar: "أوامر التصنيع", en: "Production orders" },
  history: { fr: "Historique", ar: "السجل", en: "History" },
  newRecipe: { fr: "Nouvelle formule", ar: "وصفة جديدة", en: "New recipe" },
  newOrder: { fr: "Planifier un ordre", ar: "تخطيط أمر", en: "Plan an order" },
  activeRecipes: { fr: "Formules actives", ar: "الوصفات النشطة", en: "Active recipes" },
  planned: { fr: "Planifiés", ar: "مخططة", en: "Planned" },
  completed: { fr: "Terminés", ar: "مكتملة", en: "Completed" },
  materials: { fr: "Matières disponibles", ar: "المواد المتاحة", en: "Materials available" },
  recipeCatalog: { fr: "Bibliothèque des formules", ar: "مكتبة الوصفات", en: "Recipe library" },
  orderQueue: { fr: "File de production", ar: "قائمة الإنتاج", en: "Production queue" },
  traceLog: { fr: "Journal de traçabilité", ar: "سجل التتبع", en: "Traceability log" },
  product: { fr: "Produit fini", ar: "المنتج النهائي", en: "Finished product" },
  yield: { fr: "Rendement par formule", ar: "كمية إنتاج الوصفة", en: "Recipe yield" },
  component: { fr: "Matière première", ar: "المادة الأولية", en: "Raw material" },
  quantity: { fr: "Quantité", ar: "الكمية", en: "Quantity" },
  stock: { fr: "Stock disponible", ar: "المخزون المتاح", en: "Available stock" },
  actions: { fr: "Actions", ar: "الإجراءات", en: "Actions" },
  instructions: { fr: "Instructions de fabrication", ar: "تعليمات التصنيع", en: "Production instructions" },
  addMaterial: { fr: "Ajouter une matière", ar: "إضافة مادة", en: "Add material" },
  saveRecipe: { fr: "Enregistrer la formule", ar: "حفظ الوصفة", en: "Save recipe" },
  editRecipe: { fr: "Modifier la formule", ar: "تعديل الوصفة", en: "Edit recipe" },
  deactivate: { fr: "Désactiver", ar: "إيقاف", en: "Deactivate" },
  reactivate: { fr: "Réactiver", ar: "إعادة التفعيل", en: "Reactivate" },
  planTitle: { fr: "Planifier la fabrication", ar: "تخطيط التصنيع", en: "Plan production" },
  plannedQuantity: { fr: "Quantité à produire", ar: "كمية الإنتاج", en: "Output quantity" },
  notes: { fr: "Note interne", ar: "ملاحظة داخلية", en: "Internal note" },
  createOrder: { fr: "Créer l'ordre planifié", ar: "إنشاء أمر مخطط", en: "Create planned order" },
  plannedStatus: { fr: "Planifié", ar: "مخطط", en: "Planned" },
  completedStatus: { fr: "Terminé", ar: "مكتمل", en: "Completed" },
  cancelledStatus: { fr: "Annulé", ar: "ملغى", en: "Cancelled" },
  complete: { fr: "Terminer", ar: "إتمام", en: "Complete" },
  cancel: { fr: "Annuler", ar: "إلغاء", en: "Cancel" },
  confirmCancel: { fr: "Annuler cet ordre de fabrication ?", ar: "هل تريد إلغاء أمر التصنيع؟", en: "Cancel this production order?" },
  confirmComplete: { fr: "La validation consommera les matières et ajoutera le produit fini au stock. Continuer ?", ar: "سيؤدي الإتمام إلى استهلاك المواد وإضافة المنتج النهائي للمخزون. متابعة؟", en: "Completing consumes materials and adds finished goods to stock. Continue?" },
  noRecipes: { fr: "Aucune formule enregistrée", ar: "لا توجد وصفات محفوظة", en: "No recipes recorded" },
  noOrders: { fr: "Aucun ordre dans cette vue", ar: "لا توجد أوامر في هذا العرض", en: "No orders in this view" },
  loading: { fr: "Chargement des données de production…", ar: "جارٍ تحميل بيانات الإنتاج…", en: "Loading production data…" },
  loadError: { fr: "Les données de production n’ont pas pu être chargées.", ar: "تعذر تحميل بيانات الإنتاج.", en: "Production data could not be loaded." },
  retry: { fr: "Réessayer", ar: "إعادة المحاولة", en: "Try again" },
  unavailable: { fr: "Stock insuffisant", ar: "المخزون غير كافٍ", en: "Insufficient stock" },
  insufficientHint: { fr: "La disponibilité est vérifiée au moment de la validation.", ar: "يتم التحقق من التوفر عند الإتمام.", en: "Availability is checked when the order is completed." },
  scaleHint: { fr: "Les besoins sont calculés au prorata du rendement de la formule.", ar: "تُحسب الاحتياجات بالتناسب مع كمية إنتاج الوصفة.", en: "Requirements scale in proportion to the recipe yield." },
  noReservation: { fr: "Un ordre planifié ne réserve pas le stock.", ar: "الأمر المخطط لا يحجز المخزون.", en: "A planned order does not reserve stock." },
  completionNote: { fr: "À la clôture : consommation atomique, mouvements de stock et coût moyen pondéré mis à jour. Le coût couvre les matières uniquement.", ar: "عند الإتمام: استهلاك ذري، حركات مخزون، وتحديث متوسط التكلفة المرجح. التكلفة تشمل المواد فقط.", en: "On completion: atomic consumption, stock movements and weighted average cost update. Cost covers materials only." },
  required: { fr: "Requis", ar: "المطلوب", en: "Required" },
  estimatedCost: { fr: "Coût matières estimé", ar: "تكلفة المواد المقدرة", en: "Estimated material cost" },
  date: { fr: "Créé le", ar: "تاريخ الإنشاء", en: "Created" },
  order: { fr: "Ordre", ar: "الأمر", en: "Order" },
  all: { fr: "Tous", ar: "الكل", en: "All" },
  search: { fr: "Rechercher une formule…", ar: "البحث عن وصفة…", en: "Search recipes…" },
  allMaterials: { fr: "Produits au catalogue", ar: "منتجات الكتالوج", en: "Catalogue items" },
  selectProduct: { fr: "Choisir un produit", ar: "اختر منتجًا", en: "Select a product" },
  chooseRecipe: { fr: "Choisir une formule", ar: "اختر وصفة", en: "Choose a recipe" },
  selectMaterial: { fr: "Choisir une matière", ar: "اختر مادة", en: "Select material" },
  positiveYield: { fr: "Le rendement doit être supérieur à zéro.", ar: "يجب أن تكون كمية الإنتاج أكبر من صفر.", en: "Yield must be greater than zero." },
  positiveQty: { fr: "La quantité doit être supérieure à zéro.", ar: "يجب أن تكون الكمية أكبر من صفر.", en: "Quantity must be greater than zero." },
  needMaterial: { fr: "Ajoutez au moins une matière première.", ar: "أضف مادة أولية واحدة على الأقل.", en: "Add at least one raw material." },
  duplicateMaterial: { fr: "Cette matière est déjà dans la formule.", ar: "هذه المادة موجودة بالفعل في الوصفة.", en: "This material is already in the recipe." },
  chooseOutput: { fr: "Sélectionnez le produit fini.", ar: "اختر المنتج النهائي.", en: "Select a finished product." },
  chooseRecipeError: { fr: "Sélectionnez une formule active.", ar: "اختر وصفة نشطة.", en: "Select an active recipe." },
  adjust: { fr: "À vérifier", ar: "يحتاج مراجعة", en: "Review" },
  active: { fr: "Active", ar: "نشطة", en: "Active" },
  inactive: { fr: "Inactive", ar: "غير نشطة", en: "Inactive" },
  materialCost: { fr: "Coût matières", ar: "تكلفة المواد", en: "Material cost" },
  costInfo: { fr: "Le coût final est calculé lors de la clôture.", ar: "تُحسب التكلفة النهائية عند الإتمام.", en: "Final cost is calculated at completion." },
  details: { fr: "Détail des besoins", ar: "تفاصيل الاحتياجات", en: "Material requirements" },
  close: { fr: "Fermer", ar: "إغلاق", en: "Close" },
  noInstructions: { fr: "Aucune instruction renseignée.", ar: "لم يتم إدخال تعليمات.", en: "No instructions provided." },
  productSearch: { fr: "Produit", ar: "المنتج", en: "Product" },
  noMaterials: { fr: "Aucune matière disponible dans le catalogue.", ar: "لا توجد مواد في الكتالوج.", en: "No materials are available in the catalogue." },
  removed: { fr: "Retirer", ar: "إزالة", en: "Remove" },
  completedOn: { fr: "Terminé le", ar: "أُنجز في", en: "Completed" },
  historyHint: { fr: "Les lignes terminées détaillent les quantités réellement consommées.", ar: "تعرض الأوامر المكتملة الكميات المستهلكة فعليًا.", en: "Completed orders show the quantities actually consumed." },
};

type MaterialDraft = { productId: number; quantity: string };
type RecipeDraft = { outputProductId: string; yieldQuantity: string; instructions: string; items: MaterialDraft[] };
const blankRecipe = (): RecipeDraft => ({ outputProductId: "", yieldQuantity: "1", instructions: "", items: [] });

const prettyNumber = (value: number, lang: Lang) =>
  Number(value || 0).toLocaleString(lang === "ar" ? "ar-DZ" : lang === "en" ? "en-DZ" : "fr-DZ", { maximumFractionDigits: 3 });
const money = (value: number, lang: Lang) =>
  `${Number(value || 0).toLocaleString(lang === "ar" ? "ar-DZ" : lang === "en" ? "en-DZ" : "fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
const errorText = (error: unknown) => error instanceof Error ? error.message : "";

export default function Manufacturing() {
  const { lang } = useLang();
  const { can } = usePermissions();
  const store = useCurrentStore();
  const qc = useQueryClient();
  const t = (key: keyof typeof copy) => copy[key][lang];
  const name = (en: string, ar: string) => lang === "ar" ? ar || en : en || ar;
  const [tab, setTab] = useState<"recipes" | "orders" | "history">("recipes");
  const [filter, setFilter] = useState<"all" | "planned" | "completed" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [editing, setEditing] = useState<ManufacturingRecipe | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(blankRecipe);
  const [recipeError, setRecipeError] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderRecipe, setOrderRecipe] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderError, setOrderError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ManufacturingOrder | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "complete" | "cancel"; order: ManufacturingOrder } | null>(null);
  const [actionError, setActionError] = useState("");

  const catalogueQuery = useQuery({
    queryKey: [...manufacturingQueryKeys.catalogue, store?.id ?? null],
    queryFn: getManufacturingCatalogue,
  });
  const recipesQuery = useQuery({
    queryKey: [...manufacturingQueryKeys.recipes, store?.id ?? null],
    queryFn: getManufacturingRecipes,
  });
  const ordersQuery = useQuery({
    queryKey: [...manufacturingQueryKeys.orders, store?.id ?? null],
    queryFn: getManufacturingOrders,
  });
  const products = catalogueQuery.data ?? [];
  const recipes = recipesQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const activeRecipes = recipes.filter((r) => r.isActive);
  const plannedOrders = orders.filter((o) => o.status === "planned");
  const completedOrders = orders.filter((o) => o.status === "completed");
  const totalMaterials = products.length;
  const filteredRecipes = recipes.filter((r) => `${r.outputNameEn} ${r.outputNameAr}`.toLowerCase().includes(search.toLowerCase()));
  const visibleOrders = orders.filter((o) => filter === "all" || o.status === filter);
  const selectedRecipe = recipes.find((r) => r.id === Number(orderRecipe));
  const orderFactor = selectedRecipe && Number(orderQuantity) > 0 ? Number(orderQuantity) / selectedRecipe.yieldQuantity : 0;
  const requirements = selectedRecipe?.components.map((item) => ({
    ...item,
    needed: item.quantity * orderFactor,
    enough: item.stock >= item.quantity * orderFactor,
  })) ?? [];
  const estimatedCost = requirements.reduce((sum, item) => {
    const price = Number(productMap.get(item.productId)?.costPrice ?? 0);
    return sum + item.needed * price;
  }, 0);

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: manufacturingQueryKeys.catalogue }),
    qc.invalidateQueries({ queryKey: manufacturingQueryKeys.recipes }),
    qc.invalidateQueries({ queryKey: manufacturingQueryKeys.orders }),
  ]);
  const recipeMutation = useMutation({
    mutationFn: async (draft: RecipeDraft) => {
      const payload = {
        outputProductId: Number(draft.outputProductId),
        yieldQuantity: Number(draft.yieldQuantity),
        instructions: draft.instructions.trim() || null,
        items: draft.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      };
      return editing ? updateManufacturingRecipe(editing.id, {
        yieldQuantity: payload.yieldQuantity, instructions: payload.instructions, items: payload.items,
      }) : createManufacturingRecipe(payload);
    },
    onSuccess: () => { void refresh(); setRecipeOpen(false); setEditing(null); setRecipeDraft(blankRecipe()); setRecipeError(""); },
    onError: (error) => setRecipeError(errorText(error)),
  });
  const activeMutation = useMutation({
    mutationFn: (recipe: ManufacturingRecipe) => updateManufacturingRecipe(recipe.id, { isActive: !recipe.isActive }),
    onSuccess: () => { void refresh(); },
    onError: (error) => setActionError(errorText(error)),
  });
  const orderMutation = useMutation({
    mutationFn: () => createManufacturingOrder({ recipeId: Number(orderRecipe), quantity: Number(orderQuantity), notes: orderNotes.trim() || null }),
    onSuccess: () => { void refresh(); setOrderOpen(false); setOrderRecipe(""); setOrderQuantity(""); setOrderNotes(""); setOrderError(""); setTab("orders"); },
    onError: (error) => setOrderError(errorText(error)),
  });
  const completeMutation = useMutation({
    mutationFn: completeManufacturingOrder,
    onSuccess: () => { void refresh(); setConfirm(null); setActionError(""); },
    onError: (error) => { setActionError(errorText(error)); setConfirm(null); },
  });
  const cancelMutation = useMutation({
    mutationFn: cancelManufacturingOrder,
    onSuccess: () => { void refresh(); setConfirm(null); setActionError(""); },
    onError: (error) => { setActionError(errorText(error)); setConfirm(null); },
  });

  const openRecipe = (recipe?: ManufacturingRecipe) => {
    setEditing(recipe ?? null);
    setRecipeError("");
    setRecipeDraft(recipe ? {
      outputProductId: String(recipe.outputProductId), yieldQuantity: String(recipe.yieldQuantity),
      instructions: recipe.instructions ?? "", items: recipe.components.map((c) => ({ productId: c.productId, quantity: String(c.quantity) })),
    } : blankRecipe());
    setRecipeOpen(true);
  };
  const submitRecipe = () => {
    if (!editing && !recipeDraft.outputProductId) { setRecipeError(t("chooseOutput")); return; }
    if (!Number(recipeDraft.yieldQuantity) || Number(recipeDraft.yieldQuantity) <= 0) { setRecipeError(t("positiveYield")); return; }
    if (recipeDraft.items.length === 0 || recipeDraft.items.some((i) => !Number(i.quantity) || Number(i.quantity) <= 0)) { setRecipeError(t("needMaterial")); return; }
    recipeMutation.mutate(recipeDraft);
  };
  const submitOrder = () => {
    if (!orderRecipe) { setOrderError(t("chooseRecipeError")); return; }
    if (!Number(orderQuantity) || Number(orderQuantity) <= 0) { setOrderError(t("positiveQty")); return; }
    orderMutation.mutate();
  };
  const loading = catalogueQuery.isLoading || recipesQuery.isLoading || ordersQuery.isLoading;
  const failed = catalogueQuery.isError || recipesQuery.isError || ordersQuery.isError;
  const retry = () => { void Promise.all([catalogueQuery.refetch(), recipesQuery.refetch(), ordersQuery.refetch()]); };
  const dateLabel = (value: string | null) => value
    ? new Date(value).toLocaleString(useLang.locale(lang), { dateStyle: "medium", timeStyle: "short" })
    : "—";
  const translatedStatus = (status: ManufacturingOrder["status"]) => status === "planned" ? t("plannedStatus") : status === "completed" ? t("completedStatus") : t("cancelledStatus");
  const statusClass = (status: ManufacturingOrder["status"]) => status === "planned"
    ? "bg-[#fff3dc] text-[#875616] border-[#f1d8a8]"
    : status === "completed" ? "bg-[#e5f3ed] text-[#28664b] border-[#c4e2d3]" : "bg-[#f4e8e5] text-[#884d40] border-[#e6cbc4]";
  const addableProducts = products.filter((p) => !recipeDraft.items.some((i) => i.productId === p.id));

  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-[1500px] space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-xl border border-[#d8d7ce] bg-[#f7f5ed] px-5 py-6 sm:px-8 sm:py-7">
        <div className="absolute inset-y-0 right-0 hidden w-[34%] border-l border-[#e3e0d5] bg-[linear-gradient(135deg,transparent_49%,rgba(27,48,87,.045)_50%,transparent_51%)] bg-[length:18px_18px] md:block" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg rounded-s-sm border border-[#c9d4cf] border-s-4 border-s-[#c28b45] bg-[#eef4ef] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#365b4b]">
              <Factory className="h-3.5 w-3.5" /> {lang === "ar" ? "وحدة الإنتاج" : lang === "en" ? "Production unit" : "Unité de production"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#29483f] sm:text-[32px]">{t("title")}</h1>
            <p className="mt-1.5 max-w-xl text-sm text-[#667284]">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-[#ccd3d0] bg-[#fffefa] text-[#29483f] hover:bg-[#f0f3ef]" onClick={() => openRecipe()} disabled={!can("manufacturing", "create")} data-testid="button-new-recipe">
              <Beaker className="me-2 h-4 w-4" />{t("newRecipe")}
            </Button>
            <Button className="bg-[#29483f] text-white hover:bg-[#365b4b]" onClick={() => { setOrderError(""); setOrderOpen(true); }} disabled={!activeRecipes.length || !can("manufacturing", "create")} data-testid="button-new-production-order">
              <Plus className="me-2 h-4 w-4" />{t("newOrder")}
            </Button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Beaker} label={t("activeRecipes")} value={prettyNumber(activeRecipes.length, lang)} tint="sage" />
        <Metric icon={ClipboardList} label={t("planned")} value={prettyNumber(plannedOrders.length, lang)} tint="amber" />
        <Metric icon={Check} label={t("completed")} value={prettyNumber(completedOrders.length, lang)} tint="blue" />
        <Metric icon={Layers3} label={t("materials")} value={prettyNumber(totalMaterials, lang)} tint="sand" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbdcd5]">
        <nav className="flex gap-1" aria-label={lang === "ar" ? "أقسام الإنتاج" : lang === "en" ? "Production sections" : "Sections de production"}>
          {(["recipes", "orders", "history"] as const).map((item) => {
            const Icon = item === "recipes" ? Beaker : item === "orders" ? ClipboardList : History;
            return <button key={item} type="button" data-testid={`tab-manufacturing-${item}`} onClick={() => { setTab(item); setActionError(""); }}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === item ? "border-[#29483f] text-[#29483f]" : "border-transparent text-[#7b8490] hover:text-[#365b4b]"}`}>
              <Icon className="h-4 w-4" />{t(item)}
              {item === "orders" && plannedOrders.length > 0 && <span className="rounded-full bg-[#e9edf1] px-1.5 py-0.5 text-[10px] tabular-nums">{plannedOrders.length}</span>}
            </button>;
          })}
        </nav>
        <Button variant="ghost" size="sm" className="mb-1 text-[#687487]" onClick={retry} data-testid="button-refresh-manufacturing">
          <RefreshCw className="me-2 h-3.5 w-3.5" />{lang === "ar" ? "تحديث" : lang === "en" ? "Refresh" : "Actualiser"}
        </Button>
      </div>

      <div className="rounded-lg border border-[#d9ddd8] bg-[#f1f5f1] px-4 py-3 text-xs leading-relaxed text-[#4e645b]">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#477b61]" /><p><strong>{t("noReservation")}</strong> {t("completionNote")}</p></div>
      </div>

      {actionError && <div role="alert" className="flex items-start gap-2 rounded-md border border-[#e6c5ba] bg-[#fff4ef] px-4 py-3 text-sm text-[#8c4f40]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{actionError}</span><button type="button" onClick={() => setActionError("")} className="ms-auto" aria-label={lang === "ar" ? "إغلاق" : lang === "en" ? "Dismiss" : "Fermer"}><X className="h-4 w-4" /></button></div>}
      {failed ? (
        <Card className="border-[#e3c9c0] bg-[#fffaf7]"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-[#b46c50]" /><p className="font-semibold text-[#593e35]">{t("loadError")}</p>
          <Button variant="outline" onClick={retry}>{t("retry")}</Button>
        </CardContent></Card>
      ) : loading ? (
        <div className="space-y-3" aria-label={t("loading")}><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-36 w-full" /></div>
      ) : tab === "recipes" ? (
        <Card className="overflow-hidden border-[#d8dad3] shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e4e5df] bg-[#fbfaf6] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div><h2 className="font-semibold text-[#253b5c]">{t("recipeCatalog")}</h2><p className="mt-0.5 text-xs text-[#7b8490]">{recipes.length} {t("recipes").toLowerCase()}</p></div>
            <div className="relative w-full sm:max-w-[260px]"><Search className="absolute start-3 top-2.5 h-4 w-4 text-[#84909a]" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="h-9 border-[#d9ddd8] bg-white ps-9" data-testid="input-search-recipes" /></div>
          </div>
          {filteredRecipes.length === 0 ? <Empty icon={Beaker} title={t("noRecipes")} body={recipes.length ? t("search") : t("newRecipe")} /> : (
            <div className="divide-y divide-[#e9e9e3]">
              {filteredRecipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} lang={lang} t={t} name={name} format={prettyNumber} onEdit={() => openRecipe(recipe)} onToggle={() => activeMutation.mutate(recipe)} canEdit={can("manufacturing", "edit")} busy={activeMutation.isPending} />)}
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden border-[#d8dad3] shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e4e5df] bg-[#fbfaf6] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div><h2 className="font-semibold text-[#253b5c]">{tab === "history" ? t("traceLog") : t("orderQueue")}</h2><p className="mt-0.5 text-xs text-[#7b8490]">{tab === "history" ? t("historyHint") : t("scaleHint")}</p></div>
            <div className="flex flex-wrap gap-1 rounded-md border border-[#e0e2dc] bg-white p-1">
              {(["all", "planned", "completed", "cancelled"] as const).map((status) => <button type="button" key={status} onClick={() => setFilter(status)} className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${filter === status ? "bg-[#29483f] text-white" : "text-[#687487] hover:bg-[#f1f3ef]"}`}>{status === "all" ? t("all") : translatedStatus(status)}</button>)}
            </div>
          </div>
          {visibleOrders.length === 0 ? <Empty icon={ClipboardList} title={t("noOrders")} body={tab === "history" ? t("historyHint") : t("newOrder")} /> : (
            <div className="divide-y divide-[#e8e9e3]">
              {visibleOrders.map((order) => <OrderRow key={order.id} order={order} lang={lang} t={t} name={name} format={prettyNumber} money={money} statusLabel={translatedStatus} statusClass={statusClass} dateLabel={dateLabel} onComplete={() => setConfirm({ kind: "complete", order })} onCancel={() => setConfirm({ kind: "cancel", order })} onDetails={() => setSelectedOrder(order)} canComplete={can("manufacturing", "complete")} tab={tab} productMap={productMap} />)}
            </div>
          )}
        </Card>
      )}

      <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle className="text-[#29483f]">{editing ? t("editRecipe") : t("newRecipe")}</DialogTitle><DialogDescription>{t("scaleHint")}</DialogDescription></DialogHeader>
          <div className="space-y-5 py-2">
            {!editing && <div className="space-y-2"><Label>{t("product")}</Label><select value={recipeDraft.outputProductId} onChange={(e) => setRecipeDraft({ ...recipeDraft, outputProductId: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-recipe-output"><option value="">{t("selectProduct")}</option>{products.map((p) => <option key={p.id} value={p.id}>{name(p.nameEn, p.nameAr)}</option>)}</select></div>}
            <div className="space-y-2"><Label>{t("yield")}</Label><Input type="number" min="0.001" step="any" value={recipeDraft.yieldQuantity} onChange={(e) => setRecipeDraft({ ...recipeDraft, yieldQuantity: e.target.value })} data-testid="input-recipe-yield" /></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>{t("component")}</Label>{addableProducts.length > 0 && <button type="button" onClick={() => setRecipeDraft({ ...recipeDraft, items: [...recipeDraft.items, { productId: addableProducts[0].id, quantity: "1" }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-[#426b5f] hover:text-[#29483f]"><Plus className="h-3.5 w-3.5" />{t("addMaterial")}</button>}</div>
              {recipeDraft.items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid grid-cols-[1fr_110px_34px] items-end gap-2 rounded-md border border-[#e6e7e1] bg-[#fcfcf9] p-2">
                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{t("productSearch")}</Label><select value={item.productId} onChange={(e) => setRecipeDraft({ ...recipeDraft, items: recipeDraft.items.map((it, i) => i === index ? { ...it, productId: Number(e.target.value) } : it) })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">{products.map((p) => <option key={p.id} value={p.id}>{name(p.nameEn, p.nameAr)}</option>)}</select></div>
                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{t("quantity")}</Label><Input type="number" min="0.001" step="any" value={item.quantity} onChange={(e) => setRecipeDraft({ ...recipeDraft, items: recipeDraft.items.map((it, i) => i === index ? { ...it, quantity: e.target.value } : it) })} /></div>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-[#a05443]" aria-label={t("removed")} onClick={() => setRecipeDraft({ ...recipeDraft, items: recipeDraft.items.filter((_, i) => i !== index) })}><X className="h-4 w-4" /></Button>
              </div>)}
              {recipeDraft.items.length === 0 && <p className="rounded-md border border-dashed border-[#d9ddd8] px-3 py-4 text-center text-xs text-[#7b8490]">{t("needMaterial")}</p>}
            </div>
            <div className="space-y-2"><Label>{t("instructions")}</Label><textarea value={recipeDraft.instructions} onChange={(e) => setRecipeDraft({ ...recipeDraft, instructions: e.target.value })} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            {recipeError && <p role="alert" className="text-sm text-destructive">{recipeError}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRecipeOpen(false)}>{t("close")}</Button><Button onClick={submitRecipe} disabled={recipeMutation.isPending} className="bg-[#29483f] hover:bg-[#365b4b]" data-testid="button-save-recipe">{recipeMutation.isPending ? "…" : t("saveRecipe")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle className="text-[#29483f]">{t("planTitle")}</DialogTitle><DialogDescription>{t("noReservation")} {t("scaleHint")}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t("recipes")}</Label><select value={orderRecipe} onChange={(e) => { setOrderRecipe(e.target.value); setOrderError(""); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-order-recipe"><option value="">{t("chooseRecipe")}</option>{activeRecipes.map((r) => <option value={r.id} key={r.id}>{name(r.outputNameEn, r.outputNameAr)} · {t("yield")} {prettyNumber(r.yieldQuantity, lang)}</option>)}</select></div>
            <div className="space-y-2"><Label>{t("plannedQuantity")}</Label><Input type="number" min="0.001" step="any" value={orderQuantity} onChange={(e) => setOrderQuantity(e.target.value)} data-testid="input-order-quantity" /></div>
            {selectedRecipe && Number(orderQuantity) > 0 && <div className="rounded-lg border border-[#dce2dc] bg-[#f7f9f5] p-3">
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-[#314b43]">{t("details")}</h3><span className="text-[11px] text-[#77837e]">{t("required")} / {t("stock")}</span></div>
              <div className="space-y-2">{requirements.map((item) => <div key={item.productId} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{name(item.nameEn, item.nameAr)}</span><span className={`shrink-0 font-mono text-xs ${item.enough ? "text-[#456c57]" : "font-semibold text-[#a55240]"}`}>{prettyNumber(item.needed, lang)} / {prettyNumber(item.stock, lang)}</span></div>)}</div>
              <div className="mt-3 flex items-center justify-between border-t border-[#e0e5de] pt-2 text-xs"><span className="text-[#69776f]">{t("estimatedCost")}</span><span className="font-semibold tabular-nums text-[#314b43]">{money(estimatedCost, lang)}</span></div>
              {requirements.some((item) => !item.enough) && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#a55240]"><AlertTriangle className="h-3.5 w-3.5" />{t("unavailable")} · {t("insufficientHint")}</p>}
            </div>}
            <div className="space-y-2"><Label>{t("notes")}</Label><textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <p className="text-xs leading-relaxed text-[#687487]">{t("completionNote")}</p>
            {orderError && <p role="alert" className="text-sm text-destructive">{orderError}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOrderOpen(false)}>{t("close")}</Button><Button onClick={submitOrder} disabled={orderMutation.isPending} className="bg-[#29483f] hover:bg-[#365b4b]" data-testid="button-create-order">{orderMutation.isPending ? "…" : t("createOrder")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" dir={lang === "ar" ? "rtl" : "ltr"}>
          {selectedOrder && <><DialogHeader><DialogTitle className="text-[#29483f]">{t("order")} #{String(selectedOrder.id).padStart(5, "0")} · {name(selectedOrder.outputNameEn, selectedOrder.outputNameAr)}</DialogTitle><DialogDescription>{t("historyHint")}</DialogDescription></DialogHeader>
            <OrderDetails order={selectedOrder} lang={lang} t={t} name={name} format={prettyNumber} money={money} dateLabel={dateLabel} />
            <DialogFooter><Button variant="outline" onClick={() => setSelectedOrder(null)}>{t("close")}</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader><AlertDialogTitle>{confirm?.kind === "complete" ? t("complete") : t("confirmCancel")}</AlertDialogTitle><AlertDialogDescription>{confirm?.kind === "complete" ? t("confirmComplete") : `${t("order")} #${confirm?.order.id}`}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("close")}</AlertDialogCancel><AlertDialogAction className={confirm?.kind === "complete" ? "bg-[#29483f] hover:bg-[#365b4b]" : "bg-[#a55240] hover:bg-[#8e4435]"} onClick={(e) => { e.preventDefault(); if (!confirm) return; if (confirm.kind === "complete") completeMutation.mutate(confirm.order.id); else cancelMutation.mutate(confirm.order.id); }} disabled={completeMutation.isPending || cancelMutation.isPending}>{confirm?.kind === "complete" ? t("complete") : t("cancel")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tint }: { icon: typeof Beaker; label: string; value: string; tint: "sage" | "amber" | "blue" | "sand" }) {
  const styles = {
    sage: "bg-[#edf4ef] text-[#3b7358]",
    amber: "bg-[#fbf1df] text-[#99702e]",
    blue: "bg-[#edf1f6] text-[#425d80]",
    sand: "bg-[#f4f0e7] text-[#82704c]",
  };
  return <Card className="border-[#d9ddd6] shadow-sm"><CardContent className="flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${styles[tint]}`}><Icon className="h-[18px] w-[18px]" /></span><div className="min-w-0"><div className="text-xl font-bold leading-none tabular-nums text-[#29483f]">{value}</div><div className="mt-1 truncate text-[11px] font-medium text-[#75808c] sm:text-xs">{label}</div></div></CardContent></Card>;
}

function Empty({ icon: Icon, title, body }: { icon: typeof Beaker; title: string; body: string }) {
  return <div className="flex flex-col items-center px-6 py-14 text-center"><span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#f1f3ee] text-[#758577]"><Icon className="h-5 w-5" /></span><h3 className="text-sm font-semibold text-[#344661]">{title}</h3><p className="mt-1 max-w-sm text-xs text-[#7b8490]">{body}</p></div>;
}

function RecipeRow({ recipe, lang, t, name, format, onEdit, onToggle, canEdit, busy }: {
  recipe: ManufacturingRecipe; lang: Lang; t: (key: keyof typeof copy) => string;
  name: (en: string, ar: string) => string; format: (value: number, lang: Lang) => string;
  onEdit: () => void;
  onToggle: () => void; canEdit: boolean; busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return <article className="px-4 py-4 sm:px-5" data-testid={`recipe-${recipe.id}`}>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex min-w-0 items-center gap-3 text-start">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#e0e4dd] bg-[#f5f7f2] text-[#426c57]"><Beaker className="h-[18px] w-[18px]" /></span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-semibold text-[#293e5d]">{name(recipe.outputNameEn, recipe.outputNameAr)} <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${recipe.isActive ? "border-[#cfe1d5] bg-[#edf5ef] text-[#38704e]" : "border-[#e3dcd1] bg-[#f5f1e9] text-[#86765b]"}`}>{recipe.isActive ? t("active") : t("inactive")}</span></span>
          <span className="mt-1 block text-xs text-[#77818d]">{t("yield")}: <strong className="font-semibold text-[#46576e]">{format(recipe.yieldQuantity, lang)}</strong> · {recipe.components.length} {t("component").toLowerCase()}</span></span>
      </button>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Button size="sm" variant="outline" className="h-8 border-[#d9ddd8] text-[#40536d]" onClick={onEdit} disabled={!canEdit} data-testid={`button-edit-recipe-${recipe.id}`}><Settings2 className="me-1.5 h-3.5 w-3.5" />{t("editRecipe")}</Button>
        <Button size="sm" variant="ghost" className="h-8 text-[#75808c]" onClick={onToggle} disabled={!canEdit || busy} data-testid={`button-toggle-recipe-${recipe.id}`}>{recipe.isActive ? t("deactivate") : t("reactivate")}</Button>
        <button type="button" aria-label={t("details")} onClick={() => setExpanded(!expanded)} className="grid h-8 w-8 place-items-center rounded-md text-[#7c8792] hover:bg-[#f2f3ef]"><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
      </div>
    </div>
    {expanded && <div className="mt-4 grid gap-4 border-t border-[#e8e9e3] pt-4 md:grid-cols-[1.2fr_.8fr]">
      <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#85908d]">{t("component")}</div><div className="space-y-2">{recipe.components.map((item) => <div className="flex items-center justify-between gap-3 text-sm" key={item.productId}><span className="truncate text-[#43536a]">{name(item.nameEn, item.nameAr)}</span><span className="font-mono text-xs tabular-nums text-[#627266]">{format(item.quantity, lang)} <span className="text-[#9aa39b]">/ {format(item.stock, lang)}</span></span></div>)}</div></div>
      <div className="rounded-md bg-[#f7f7f2] p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#85908d]">{t("instructions")}</div><p className="whitespace-pre-wrap text-xs leading-relaxed text-[#59677a]">{recipe.instructions || t("noInstructions")}</p></div>
    </div>}
  </article>;
}

function OrderRow({ order, lang, t, name, format, money, statusLabel, statusClass, dateLabel, onComplete, onCancel, onDetails, canComplete, tab, productMap }: {
  order: ManufacturingOrder; lang: Lang; t: (key: keyof typeof copy) => string;
  name: (en: string, ar: string) => string; format: (value: number, lang: Lang) => string;
  money: (value: number, lang: Lang) => string; statusLabel: (status: ManufacturingOrder["status"]) => string;
  statusClass: (status: ManufacturingOrder["status"]) => string; dateLabel: (value: string | null) => string;
  onComplete: () => void; onCancel: () => void; onDetails: () => void; canComplete: boolean; tab: "orders" | "history";
  productMap: Map<number, ManufacturingProduct>;
}) {
  const factor = order.quantity / order.yieldQuantity;
  const needsAttention = order.status === "planned" && order.materials.some((m) => (productMap.get(m.productId)?.stock ?? 0) < m.requiredQuantity);
  return <article className="px-4 py-4 sm:px-5" data-testid={`row-manufacturing-order-${order.id}`}>
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <button type="button" onClick={onDetails} className="flex min-w-0 items-start gap-3 text-start">
        <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${order.status === "completed" ? "border-[#d3e5da] bg-[#eef5f0] text-[#4a795e]" : order.status === "planned" ? "border-[#eddfc4] bg-[#fbf5e9] text-[#9a773e]" : "border-[#e5d7d2] bg-[#f6efec] text-[#966658]"}`}>
          {order.status === "completed" ? <Check className="h-[18px] w-[18px]" /> : order.status === "planned" ? <ClipboardList className="h-[18px] w-[18px]" /> : <X className="h-[18px] w-[18px]" />}
        </span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-semibold text-[#293e5d]">{name(order.outputNameEn, order.outputNameAr)} <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span></span>
          <span className="mt-1 block text-xs text-[#77818d]">{t("order")} #{String(order.id).padStart(5, "0")} · {dateLabel(order.createdAt)}</span>
          <span className="mt-1.5 block text-xs text-[#506079]">{format(order.quantity, lang)} {lang === "ar" ? "وحدة" : lang === "en" ? "units" : "unités"} · {order.materials.length} {t("component").toLowerCase()}</span>
        </span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
        <div className="min-w-[120px] text-start lg:text-end"><div className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#8a939d]">{t("materialCost")}</div><div className="mt-0.5 text-sm font-bold tabular-nums text-[#344a63]">{order.status === "completed" ? money(Number(order.totalMaterialCost), lang) : t("costInfo")}</div></div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 border-[#d9ddd8] text-[#40536d]" onClick={onDetails} data-testid={`button-order-details-${order.id}`}>{tab === "history" ? t("details") : t("details")}</Button>
          {order.status === "planned" && <>
            <Button size="sm" className="h-8 bg-[#29483f] hover:bg-[#365b4b]" disabled={!canComplete} onClick={onComplete} data-testid={`button-complete-order-${order.id}`}><Check className="me-1.5 h-3.5 w-3.5" />{t("complete")}</Button>
            <Button size="sm" variant="ghost" className="h-8 text-[#985c4d]" onClick={onCancel} data-testid={`button-cancel-order-${order.id}`}>{t("cancel")}</Button>
          </>}
        </div>
      </div>
    </div>
    {order.status === "planned" && needsAttention && <div className="mt-3 flex items-center gap-2 rounded-md bg-[#fff8ea] px-3 py-2 text-[11px] text-[#90672e]"><AlertTriangle className="h-3.5 w-3.5" />{t("insufficientHint")}</div>}
    {order.status === "completed" && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#ecece6] pt-3 text-[11px] text-[#718078]"><span>{t("completedOn")}: {dateLabel(order.completedAt)}</span><span>{t("materialCost")}: {money(Number(order.totalMaterialCost), lang)}</span><span>{t("details")}: {order.materials.length} {t("component").toLowerCase()}</span></div>}
    {order.status === "planned" && <div className="mt-3 flex items-center gap-1.5 border-t border-[#ecece6] pt-3 text-[11px] text-[#7d887f]"><ArrowUpRight className="h-3.5 w-3.5" />{format(factor, lang)}× {t("yield").toLowerCase()} · {t("noReservation")}</div>}
  </article>;
}

function OrderDetails({ order, lang, t, name, format, money, dateLabel }: {
  order: ManufacturingOrder; lang: Lang; t: (key: keyof typeof copy) => string;
  name: (en: string, ar: string) => string; format: (value: number, lang: Lang) => string;
  money: (value: number, lang: Lang) => string; dateLabel: (value: string | null) => string;
}) {
  return <div className="space-y-4 py-2">
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#f6f7f2] p-3 text-xs">
      <div><span className="block text-[#86908c]">{t("plannedQuantity")}</span><strong className="mt-1 block text-sm text-[#344661]">{format(order.quantity, lang)}</strong></div>
      <div><span className="block text-[#86908c]">{t("date")}</span><strong className="mt-1 block text-sm text-[#344661]">{dateLabel(order.createdAt)}</strong></div>
      {order.completedAt && <div><span className="block text-[#86908c]">{t("completedOn")}</span><strong className="mt-1 block text-sm text-[#344661]">{dateLabel(order.completedAt)}</strong></div>}
      <div><span className="block text-[#86908c]">{t("materialCost")}</span><strong className="mt-1 block text-sm text-[#344661]">{order.status === "completed" ? money(Number(order.totalMaterialCost), lang) : t("costInfo")}</strong></div>
    </div>
    <div><h3 className="mb-2 text-sm font-semibold text-[#344661]">{t("component")}</h3>
      <div className="overflow-hidden rounded-md border border-[#e2e5df]">
        <div className="grid grid-cols-[1fr_repeat(2,minmax(64px,.5fr))] gap-2 bg-[#f5f6f1] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#7d8983]"><span>{t("productSearch")}</span><span className="text-end">{t("required")}</span><span className="text-end">{t("completed")}</span></div>
        {order.materials.map((material) => <div key={material.productId} className="grid grid-cols-[1fr_repeat(2,minmax(64px,.5fr))] gap-2 border-t border-[#eceee9] px-3 py-2.5 text-xs"><span className="truncate font-medium text-[#47576b]">{name(material.nameEn, material.nameAr)}</span><span className="text-end font-mono tabular-nums text-[#596b5f]">{format(material.requiredQuantity, lang)}</span><span className="text-end font-mono tabular-nums text-[#596b5f]">{material.consumedQuantity == null ? "—" : format(material.consumedQuantity, lang)}</span></div>)}
      </div>
    </div>
    {order.notes && <div className="rounded-md border border-[#e6e7e1] p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#89928d]">{t("notes")}</div><p className="whitespace-pre-wrap text-sm text-[#546379]">{order.notes}</p></div>}
    <p className="text-xs leading-relaxed text-[#78847d]">{t("completionNote")}</p>
  </div>;
}
