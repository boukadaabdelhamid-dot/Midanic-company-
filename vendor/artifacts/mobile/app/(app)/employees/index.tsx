import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetEmployees, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { ListScreen } from "@/components/ListScreen";
import { EntityRow } from "@/components/EntityRow";
import { Badge } from "@/components/ui";
import { Fab } from "@/components/Fab";
import PayrollTab from "@/components/PayrollTab";
import { colors } from "@/lib/colors";

const STATUS_TONE: Record<string, "success" | "warning" | "muted"> = {
  active: "success",
  on_leave: "warning",
  inactive: "muted",
};

export default function EmployeesList() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "employees" });
  const { t, lang } = useLang();
  const router = useRouter();
  const [tab, setTab] = useState<"employees" | "payroll">("employees");
  const currency = lang === "ar" ? "دج" : "DA";

  const { data, isLoading, refetch, isRefetching } = useGetEmployees({
    query: { enabled: ready, queryKey: getGetEmployeesQueryKey() },
  });

  if (!ready) return null;
  const canCreate = isAdmin || can("employees", "create");
  const canEdit = isAdmin || can("employees", "edit");
  const canViewPayroll = isAdmin || can("payroll", "view");

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("employees")}
          style={[styles.tab, tab === "employees" && styles.activeTab]}
          testID="tab-employees"
        >
          <Feather name="users" size={17} color={tab === "employees" ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, tab === "employees" && styles.activeTabText]}>
            {t("Employés", "الموظفون")}
          </Text>
        </Pressable>
        {canViewPayroll ? (
          <Pressable
            onPress={() => setTab("payroll")}
            style={[styles.tab, tab === "payroll" && styles.activeTab]}
            testID="tab-payroll"
          >
            <Feather name="briefcase" size={17} color={tab === "payroll" ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabText, tab === "payroll" && styles.activeTabText]}>
              {t("Paie", "الرواتب")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {tab === "payroll" && canViewPayroll ? (
        <PayrollTab employees={data ?? []} ready={ready} canCreate={isAdmin || can("payroll", "create")} canDelete={isAdmin || can("payroll", "delete")} />
      ) : (
        <>
          <ListScreen
            data={data ?? []}
            isLoading={isLoading}
            onRefresh={refetch}
            refreshing={isRefetching}
            keyExtractor={(e: any) => String(e.id)}
            emptyTitle={t("Aucun employé", "لا يوجد موظفون")}
            renderItem={(e: any) => (
              <EntityRow
                onPress={canEdit ? () => router.push(`/employees/${e.id}/edit` as never) : undefined}
                title={e.name}
                subtitle={`${e.position} · ${Number(e.salary).toLocaleString("fr-FR")} ${currency}`}
                right={<Badge label={e.status} tone={STATUS_TONE[e.status] ?? "muted"} />}
              />
            )}
          />
          {canCreate ? <Fab onPress={() => router.push("/employees/new" as never)} testID="button-new-employee" /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 3,
    borderRadius: 10,
    backgroundColor: colors.border,
    gap: 3,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  activeTabText: { color: colors.primary },
});
