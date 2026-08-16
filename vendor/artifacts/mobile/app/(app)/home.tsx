import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useLang } from "@/contexts/lang-context";
import { useMe } from "@/hooks/use-me";
import { usePermissions } from "@/contexts/permissions-context";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { LoadingView } from "@/components/ui";
import { colors } from "@/lib/colors";
import type { PermSection } from "@/contexts/permissions-context";

type HomeModule = {
  labelFr: string;
  labelAr: string;
  href: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  section: PermSection;
  /** Backend route is `requireAdmin`-gated regardless of section permissions (e.g. /admin/low-stock). */
  adminOnly?: boolean;
};

const MODULES: HomeModule[] = [
  { labelFr: "Articles", labelAr: "المنتجات", href: "/products", icon: "package", color: "#06B6D4", section: "products" },
  { labelFr: "Ventes", labelAr: "المبيعات", href: "/orders", icon: "shopping-cart", color: "#10B981", section: "orders" },
  { labelFr: "Point de vente", labelAr: "نقطة البيع", href: "/pos", icon: "credit-card", color: "#0F766E", section: "orders" },
  { labelFr: "Achats", labelAr: "المشتريات", href: "/purchase-orders", icon: "file-text", color: "#F43F5E", section: "purchases" },
  { labelFr: "Besoin d'achats", labelAr: "ما ينقص", href: "/smart-purchase", icon: "shopping-bag", color: "#F97316", section: "purchases", adminOnly: true },
  { labelFr: "Caisse", labelAr: "الصندوق", href: "/caisse", icon: "credit-card", color: "#F59E0B", section: "caisse" },
  { labelFr: "Clients", labelAr: "العملاء", href: "/customers", icon: "user-check", color: "#0EA5E9", section: "customers" },
  { labelFr: "Fournisseurs", labelAr: "الموردون", href: "/suppliers", icon: "truck", color: "#8B5CF6", section: "suppliers" },
  { labelFr: "Employés", labelAr: "الموظفون", href: "/employees", icon: "users", color: "#6366F1", section: "employees" },
  { labelFr: "Tableau de bord", labelAr: "لوحة التحكم", href: "/dashboard", icon: "bar-chart-2", color: "#475569", section: "dashboard" },
  { labelFr: "Temps Réel", labelAr: "الوقت الفعلي", href: "/realtime", icon: "activity", color: "#EC4899", section: "realtime" },
  { labelFr: "Stock", labelAr: "المخزون", href: "/inventory", icon: "archive", color: "#2563EB", section: "inventory" },
  { labelFr: "Présences", labelAr: "الحضور", href: "/attendance", icon: "clock", color: "#14B8A6", section: "attendance" },
  { labelFr: "Congés", labelAr: "الإجازات", href: "/leaves", icon: "calendar", color: "#F97316", section: "leaves" },
  { labelFr: "Comptabilité", labelAr: "المحاسبة", href: "/accounting", icon: "trending-up", color: "#D946EF", section: "accounting" },
];

export default function Home() {
  const router = useRouter();
  const { t } = useLang();
  const { isAdmin } = useMe();
  const { can, isLoaded } = usePermissions();
  const { ready } = useProtectedRoute();

  if (!ready || (!isAdmin && !isLoaded)) return <LoadingView />;

  const visible = isAdmin ? MODULES : MODULES.filter((m) => !m.adminOnly && can(m.section, "view"));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {visible.map((m) => (
          <Pressable
            key={m.href}
            onPress={() => router.push(m.href as never)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: m.color },
              pressed && styles.tilePressed,
            ]}
            testID={`home-tile-${m.href.replace("/", "")}`}
          >
            <View style={styles.iconBadge}>
              <Feather name={m.icon} size={28} color="#fff" />
            </View>
            <View style={styles.tileFooter}>
              <Text style={styles.tileLabel} numberOfLines={2}>{t(m.labelFr, m.labelAr)}</Text>
              <Feather name="arrow-up-right" size={15} color="rgba(255,255,255,0.82)" />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  tile: {
    width: "48%",
    minHeight: 132,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: "rgba(0,0,0,0.2)",
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  tilePressed: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 2,
    shadowOpacity: 0.08,
    elevation: 1,
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  tileFooter: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  tileLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff", textAlign: "left" },
});
