import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateErpStore, getGetErpStoresMineQueryKey, getGetErpStoresQueryKey,
  getGetMeQueryKey, type Store,
} from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function SingleSiteNameSettings({ store }: { store: Store }) {
  const { lang } = useLang();
  const text = (fr: string, ar: string, en: string) => lang === "ar" ? ar : lang === "en" ? en : fr;
  const qc = useQueryClient();
  const update = useUpdateErpStore();
  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [error, setError] = useState("");
  const startEditing = () => {
    setNameAr(store.nameAr);
    setNameEn(store.nameEn);
    setError("");
    setOpen(true);
  };
  const save = () => {
    if (!nameAr.trim() || !nameEn.trim()) return;
    setError("");
    update.mutate({ id: store.id, data: { nameAr: nameAr.trim(), nameEn: nameEn.trim() } }, {
      onSuccess: (updated) => {
        qc.setQueryData<Store[]>(getGetErpStoresMineQueryKey(), (old) =>
          old?.map((site) => site.id === updated.id ? { ...site, ...updated } : site),
        );
        void qc.invalidateQueries({ queryKey: getGetErpStoresMineQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetErpStoresQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        void qc.invalidateQueries({ queryKey: ["company-sites"] });
        setOpen(false);
      },
      onError: () => setError(text("Le nom n’a pas pu être enregistré.", "تعذر حفظ الاسم.", "Could not save the name.")),
    });
  };
  return (
    <Card data-testid="single-site-name-settings">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{text("Nom de l’établissement", "اسم الموقع", "Location name")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-medium">{store.nameEn}</p><p className="text-sm text-muted-foreground" dir="rtl">{store.nameAr}</p></div>
        <Button variant="outline" onClick={startEditing} data-testid="button-rename-single-site">
          {text("Modifier le nom", "تعديل الاسم", "Rename")}
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={(value) => { if (!update.isPending) setOpen(value); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{text("Modifier le nom", "تعديل الاسم", "Rename")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name-latin">{text("Nom (FR / EN)", "الاسم بالفرنسية / الإنجليزية", "Name (FR / EN)")}</Label>
              <Input id="site-name-latin" value={nameEn} onChange={(event) => setNameEn(event.target.value)} disabled={update.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-name-ar">{text("Nom (AR)", "الاسم بالعربية", "Name (AR)")}</Label>
              <Input id="site-name-ar" dir="rtl" value={nameAr} onChange={(event) => setNameAr(event.target.value)} disabled={update.isPending} />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={update.isPending}>{text("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={save} disabled={update.isPending || !nameAr.trim() || !nameEn.trim()}>
              {update.isPending ? text("Enregistrement…", "جارٍ الحفظ…", "Saving…") : text("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
