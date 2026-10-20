import React, { createContext, useContext, useState, useEffect } from "react";
import { enTranslations } from "@/lib/en-translations";

export type ErpLang = "fr" | "ar" | "en";

type LangContextType = {
  lang: ErpLang;
  setLang: (lang: ErpLang) => void;
};

const STORAGE_KEY = "midanic_erp_lang";

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<ErpLang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "fr" || saved === "ar" || saved === "en" ? saved : "fr";
  });

  const setLang = (next: ErpLang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextType {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

export function translateUi(lang: string, fr: string, ar: string): string {
  if (lang === "ar") return ar;
  if (lang === "en") return Object.hasOwn(enTranslations, fr) ? enTranslations[fr] : fr;
  return fr;
}

export namespace useLang {
  export const translate = translateUi;

  export function locale(lang?: string): string {
    const stored = lang ?? (
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : "fr"
    );
    return stored === "ar" ? "ar-DZ" : stored === "en" ? "en-DZ" : "fr-DZ";
  }
}
