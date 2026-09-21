import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "../lib/api-base";
import { getExplicitStoreSlug, getStoreRequestHeaders } from "../lib/store-headers";

const API_BASE = getApiBase();

export type StoreConfig = {
  nameAr: string;
  nameEn: string;
  logoUrl: string | null;
  showPrices: boolean;
  showStock: boolean;
  acceptOrders: boolean;
  minOrderAmount: number;
  bannerUrl: string | null;
  description: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  whatsappNumber: string | null;
  featuredProductIds: number[];
  featuredCategoryIds: number[];
};

const SAFE_DEFAULTS: StoreConfig = {
  nameAr: "ميدانيك",
  nameEn: "Midanic",
  logoUrl: null,
  showPrices: true,
  showStock: true,
  acceptOrders: true,
  minOrderAmount: 0,
  bannerUrl: null,
  description: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  whatsappNumber: null,
  featuredProductIds: [],
  featuredCategoryIds: [],
};

const StoreConfigContext = createContext<StoreConfig>(SAFE_DEFAULTS);

export function StoreConfigProvider({ children }: { children: React.ReactNode }) {
  const slug = getExplicitStoreSlug();

  const { data } = useQuery<StoreConfig>({
    queryKey: ["store-config", slug],
    queryFn: async () => {
      const endpoint = slug
        ? `/api/stores/${encodeURIComponent(slug)}/config`
        : "/api/stores/public/config";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: getStoreRequestHeaders(),
      });
      if (!res.ok) return SAFE_DEFAULTS;
      const json = await res.json();
      return {
        nameAr: json.nameAr ?? "ميدانيك",
        nameEn: json.nameEn ?? "Midanic",
        logoUrl: json.logoUrl ?? null,
        showPrices: json.showPrices ?? true,
        showStock: json.showStock ?? true,
        acceptOrders: json.acceptOrders ?? true,
        minOrderAmount: Number(json.minOrderAmount ?? 0),
        bannerUrl: json.bannerUrl ?? null,
        description: json.description ?? null,
        facebookUrl: json.facebookUrl ?? null,
        instagramUrl: json.instagramUrl ?? null,
        tiktokUrl: json.tiktokUrl ?? null,
        whatsappNumber: json.whatsappNumber ?? null,
        featuredProductIds: Array.isArray(json.featuredProductIds) ? json.featuredProductIds : [],
        featuredCategoryIds: Array.isArray(json.featuredCategoryIds) ? json.featuredCategoryIds : [],
      };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const config = useMemo(() => data ?? SAFE_DEFAULTS, [data]);

  return (
    <StoreConfigContext.Provider value={config}>
      {children}
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig(): StoreConfig {
  return useContext(StoreConfigContext);
}
