import React, { createContext, useContext, useState, useEffect } from "react";

export type StoreLanguage = "en" | "ar" | "fr";

type LangContextType = {
  lang: StoreLanguage;
  setLang: (lang: StoreLanguage) => void;
};

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<StoreLanguage>(() => {
    const saved = localStorage.getItem("midanic_lang");
    return saved === "ar" || saved === "fr" || saved === "en" ? saved : "en";
  });

  const setLang = (next: StoreLanguage) => {
    setLangState(next);
    localStorage.setItem("midanic_lang", next);
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

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang must be used within LangProvider");
  return context;
}
