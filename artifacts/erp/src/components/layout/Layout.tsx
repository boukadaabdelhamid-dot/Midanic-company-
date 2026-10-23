import React from "react";
import { Factory } from "lucide-react";
import { useLang } from "@/hooks/use-lang";
import { useStoreContext } from "@/hooks/use-store";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const { currentStoreId, stores } = useStoreContext();
  const currentStore = stores.find((store) => store.id === currentStoreId);
  const isFactory = currentStore?.kind === "factory";
  const productionLabel = lang === "ar" ? "وحدة الإنتاج" : lang === "en" ? "Production unit" : "Unité de production";

  return (
    <div className={`flex h-screen overflow-hidden bg-background ${isFactory ? "erp-factory-mode" : ""}`}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background pt-14 lg:pt-0">
        {isFactory && (
          <div
            className="flex min-h-11 items-center gap-2 border-b border-[#d7d9cf] bg-[#edf1e9] px-4 text-xs text-[#29483f] md:px-6"
            dir={lang === "ar" ? "rtl" : "ltr"}
            data-testid="banner-production-unit"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#c28b45] text-[#263b35]">
              <Factory className="h-4 w-4" />
            </span>
            <span className="font-bold uppercase tracking-[.12em]">{productionLabel}</span>
            {currentStore?.nameEn && (
              <span className="truncate border-s border-[#c9cabb] ps-2 font-medium text-[#596b60]">
                {currentStore.nameEn}
              </span>
            )}
          </div>
        )}
        <div className="p-4 md:p-6 max-w-screen-xl">
          {children}
        </div>
      </main>
    </div>
  );
}
