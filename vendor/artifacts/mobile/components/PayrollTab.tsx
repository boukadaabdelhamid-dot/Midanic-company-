import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  CreatePayrollAdjustmentRequestType,
  type CreatePayrollAdjustmentRequestType as PayrollAdjustmentType,
  type Employee,
  type PayrollAdjustment,
  useCreatePayrollAdjustment,
  useDeletePayrollAdjustment,
  useGeneratePayroll,
  useGetPayrollAdjustments,
  useGetPayrollRuns,
  useGetPayslips,
  getGetPayrollAdjustmentsQueryKey,
  getGetPayrollRunsQueryKey,
  getGetPayslipsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { Card, Button, FormField, SectionTitle, Divider } from "@/components/ui";
import { PickerField } from "@/components/Picker";
import { DateField } from "@/components/DateField";
import { colors } from "@/lib/colors";

const ADJUSTMENT_LABELS: Record<PayrollAdjustmentType, [string, string]> = {
  advance: ["Avance", "سلفة"],
  deduction: ["Retenue", "اقتطاع"],
  bonus: ["Prime", "منحة"],
};

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseAmount(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatAmount(value: string | number | null | undefined, currency: string) {
  return `${Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(value: string | null | undefined, lang: "fr" | "ar") {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR");
}

export default function PayrollTab({
  employees,
  ready,
  canCreate,
  canDelete,
}: {
  employees: Employee[];
  ready: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const currency = lang === "ar" ? "دج" : "DA";
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [type, setType] = useState<PayrollAdjustmentType>(CreatePayrollAdjustmentRequestType.advance);
  const [amount, setAmount] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState<Date>(today);
  const [reason, setReason] = useState("");
  const [periodStart, setPeriodStart] = useState<Date>(firstDay);
  const [periodEnd, setPeriodEnd] = useState<Date>(lastDay);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const adjustmentsQuery = useGetPayrollAdjustments(undefined, {
    query: {
      enabled: ready,
      queryKey: getGetPayrollAdjustmentsQueryKey(),
    },
  });
  const runsQuery = useGetPayrollRuns({
    query: {
      enabled: ready,
      queryKey: getGetPayrollRunsQueryKey(),
    },
  });
  const payslipsQuery = useGetPayslips(undefined, {
    query: {
      enabled: ready,
      queryKey: getGetPayslipsQueryKey(),
    },
  });
  const createAdjustment = useCreatePayrollAdjustment();
  const deleteAdjustment = useDeletePayrollAdjustment();
  const generatePayroll = useGeneratePayroll();

  const adjustments = useMemo(
    () => (adjustmentsQuery.data ?? []).filter((item) => !historyEmployee || item.employeeId === historyEmployee.id),
    [adjustmentsQuery.data, historyEmployee],
  );
  const payslipsByRun = useMemo(() => {
    const grouped = new Map<number, typeof payslipsQuery.data>();
    for (const payslip of payslipsQuery.data ?? []) {
      const current = grouped.get(payslip.payrollRunId) ?? [];
      current.push(payslip);
      grouped.set(payslip.payrollRunId, current);
    }
    return grouped;
  }, [payslipsQuery.data]);

  function validateAdjustment() {
    const next: Record<string, string> = {};
    if (!employee) next.employee = t("Choisir un employé", "اختر موظفاً");
    if (!parseAmount(amount)) next.amount = t("Saisir un montant valide", "أدخل مبلغاً صحيحاً");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submitAdjustment() {
    if (!canCreate || !validateAdjustment()) return;
    createAdjustment.mutate(
      {
        data: {
          employeeId: employee!.id,
          type,
          amount: parseAmount(amount)!,
          reason: reason.trim() || undefined,
          date: dateOnly(adjustmentDate),
        },
      },
      {
        onSuccess: () => {
          feedback.success("Opération de paie ajoutée", "تمت إضافة عملية الراتب");
          setAmount("");
          setReason("");
          setErrors({});
          queryClient.invalidateQueries({ queryKey: getGetPayrollAdjustmentsQueryKey() });
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function submitPayroll() {
    if (!canCreate) return;
    if (periodEnd < periodStart) {
      feedback.error(null, "La fin doit être après le début", "يجب أن يكون تاريخ النهاية بعد البداية");
      return;
    }
    generatePayroll.mutate(
      {
        data: {
          periodStart: dateOnly(periodStart),
          periodEnd: dateOnly(periodEnd),
        },
      },
      {
        onSuccess: () => {
          feedback.success("Paie générée", "تم إنشاء الرواتب");
          queryClient.invalidateQueries({ queryKey: getGetPayrollAdjustmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPayrollRunsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPayslipsQueryKey() });
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function removeAdjustment(adjustment: PayrollAdjustment) {
    if (!canDelete || adjustment.payslipId) return;
    deleteAdjustment.mutate(
      { id: adjustment.id },
      {
        onSuccess: () => {
          feedback.success("Opération supprimée", "تم حذف العملية");
          queryClient.invalidateQueries({ queryKey: getGetPayrollAdjustmentsQueryKey() });
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  return (
    <Screen onRefresh={() => {
      adjustmentsQuery.refetch();
      runsQuery.refetch();
      payslipsQuery.refetch();
    }} refreshing={adjustmentsQuery.isRefetching || runsQuery.isRefetching || payslipsQuery.isRefetching}>
      <Card>
        <SectionTitle>{t("Générer la paie", "إنشاء الرواتب")}</SectionTitle>
        <Text style={styles.description}>
          {t(
            "Génère une fiche de paie pour chaque employé actif sur la période choisie. Les avances, retenues et primes non clôturées sont intégrées.",
            "ينشئ كشف راتب لكل موظف نشط خلال الفترة المختارة، مع إدماج السلف والاقتطاعات والمنح غير المغلقة.",
          )}
        </Text>
        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <DateField label={t("Début période", "بداية الفترة")} value={periodStart} onChange={setPeriodStart} maximumDate={periodEnd} />
          </View>
          <View style={styles.dateColumn}>
            <DateField label={t("Fin période", "نهاية الفترة")} value={periodEnd} onChange={setPeriodEnd} minimumDate={periodStart} />
          </View>
        </View>
        <Button
          label={t(`Générer (${employees.filter((e) => e.status === "active").length} employés)`, `إنشاء (${employees.filter((e) => e.status === "active").length} موظفين)`)}
          onPress={submitPayroll}
          loading={generatePayroll.isPending}
          disabled={!canCreate || employees.filter((e) => e.status === "active").length === 0}
          icon={<Feather name="play-circle" size={18} color="#fff" />}
          testID="button-generate-payroll"
        />
      </Card>

      <Card>
        <SectionTitle>{t("Avances, retenues et primes", "السلف والاقتطاعات والمنح")}</SectionTitle>
        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <PickerField<Employee>
              label={t("Employé", "الموظف")}
              value={employee}
              items={employees}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => item.name}
              subtitleExtractor={(item) => item.position}
              onChange={setEmployee}
              placeholder={t("Choisir", "اختر")}
              error={errors.employee}
              disabled={!canCreate}
            />
          </View>
          <View style={styles.dateColumn}>
            <Text style={styles.fieldLabel}>{t("Type", "النوع")}</Text>
            <View style={styles.typeButtons}>
              {(Object.keys(ADJUSTMENT_LABELS) as PayrollAdjustmentType[]).map((item) => (
                <Button
                  key={item}
                  label={t(...ADJUSTMENT_LABELS[item])}
                  variant={type === item ? "primary" : "secondary"}
                  onPress={() => setType(item)}
                  disabled={!canCreate}
                  style={styles.typeButton}
                  testID={`button-payroll-type-${item}`}
                />
              ))}
            </View>
          </View>
        </View>
        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <FormField
              label={t("Montant (DA)", "المبلغ (دج)")}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0,00"
              error={errors.amount}
              editable={canCreate}
            />
          </View>
          <View style={styles.dateColumn}>
            <DateField label={t("Date", "التاريخ")} value={adjustmentDate} onChange={setAdjustmentDate} disabled={!canCreate} />
          </View>
        </View>
        <FormField
          label={t("Motif (optionnel)", "السبب (اختياري)")}
          value={reason}
          onChangeText={setReason}
          editable={canCreate}
          placeholder={t("Motif", "السبب")}
        />
        <Button
          label={t("Ajouter l'opération", "إضافة العملية")}
          onPress={submitAdjustment}
          loading={createAdjustment.isPending}
          disabled={!canCreate}
          icon={<Feather name="plus" size={18} color="#fff" />}
          testID="button-add-payroll-adjustment"
        />

        <View style={styles.historyHeader}>
          <Text style={styles.historyLabel}>{t("Historique", "السجل")}</Text>
          <View style={styles.historyPicker}>
            <PickerField<Employee>
              label=""
              value={historyEmployee}
              items={employees}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => item.name}
              onChange={setHistoryEmployee}
              onClear={() => setHistoryEmployee(null)}
              allowClear
              placeholder={t("Tous les employés", "كل الموظفين")}
            />
          </View>
        </View>
        {adjustmentsQuery.isLoading ? (
          <Text style={styles.muted}>{t("Chargement...", "جار التحميل...")}</Text>
        ) : adjustments.length === 0 ? (
          <Text style={styles.muted}>{t("Aucune opération", "لا توجد عمليات")}</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.employeeColumn]}>{t("Employé", "الموظف")}</Text>
              <Text style={styles.tableHeaderText}>{t("Type", "النوع")}</Text>
              <Text style={styles.tableHeaderText}>{t("Montant", "المبلغ")}</Text>
              <Text style={styles.tableHeaderText}>{t("Date", "التاريخ")}</Text>
              {canDelete ? <Text style={styles.tableHeaderText} /> : null}
            </View>
            {adjustments.slice(0, 50).map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.employeeColumn]} numberOfLines={2}>
                    {item.employeeName ?? employees.find((employeeItem) => employeeItem.id === item.employeeId)?.name ?? `#${item.employeeId}`}
                  </Text>
                  <Text style={[styles.tableCell, styles.typeCell]}>{t(...ADJUSTMENT_LABELS[item.type])}</Text>
                  <Text style={[styles.tableCell, styles.amountCell]}>{formatAmount(item.amount, currency)}</Text>
                  <Text style={styles.tableCell}>{formatDate(item.date, lang)}</Text>
                  {canDelete ? (
                    item.payslipId ? (
                      <View style={styles.deleteButton} accessibilityLabel={t("Opération clôturée", "عملية مغلقة")}>
                        <Feather name="lock" size={15} color={colors.textMuted} />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => removeAdjustment(item)}
                        style={styles.deleteButton}
                        testID={`button-delete-payroll-${item.id}`}
                        accessibilityLabel={t("Supprimer l'opération", "حذف العملية")}
                      >
                        <Feather name="trash-2" size={16} color={colors.danger} />
                      </Pressable>
                    )
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle>{t("Historique des paies", "سجل الرواتب")}</SectionTitle>
        {runsQuery.isLoading || payslipsQuery.isLoading ? (
          <Text style={styles.muted}>{t("Chargement...", "جار التحميل...")}</Text>
        ) : (runsQuery.data ?? []).length === 0 ? (
          <Text style={styles.muted}>{t("Aucune paie générée", "لا توجد رواتب منشأة")}</Text>
        ) : (
          (runsQuery.data ?? []).map((run) => {
            const runPayslips = payslipsByRun.get(run.id) ?? [];
            return (
              <View key={run.id} style={styles.runBlock}>
                <View style={styles.runHeader}>
                  <Text style={styles.runPeriod}>
                    {formatDate(run.periodStart, lang)} → {formatDate(run.periodEnd, lang)}
                  </Text>
                  <Text style={styles.runSummary}>
                    {run.employeeCount ?? runPayslips.length} {t("employés", "موظفين")} · {formatAmount(run.totalNet, currency)}
                  </Text>
                </View>
                {runPayslips.map((payslip) => (
                  <View key={payslip.id} style={styles.payslipRow}>
                    <View style={styles.payslipName}>
                      <Text style={styles.payslipEmployee}>{payslip.employeeName ?? `#${payslip.employeeId}`}</Text>
                      <Text style={styles.payslipMeta}>
                        {t("Base", "الأساسي")}: {formatAmount(payslip.baseSalary, currency)}
                      </Text>
                    </View>
                    <View style={styles.payslipMetric}>
                      <Text style={styles.metricLabel}>{t("Prime", "منحة")}</Text>
                      <Text style={styles.metricValue}>{formatAmount(payslip.bonusAmount, currency)}</Text>
                    </View>
                    <View style={styles.payslipMetric}>
                      <Text style={styles.metricLabel}>{t("Avances", "السلف")}</Text>
                      <Text style={styles.metricValue}>{formatAmount(payslip.advancesAmount, currency)}</Text>
                    </View>
                    <View style={styles.payslipMetric}>
                      <Text style={styles.metricLabel}>{t("Net", "الصافي")}</Text>
                      <Text style={[styles.metricValue, styles.netValue]}>{formatAmount(payslip.netAmount, currency)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateColumn: { flex: 1, minWidth: 0 },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  typeButtons: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  typeButton: { flexGrow: 1, paddingHorizontal: 7, paddingVertical: 10 },
  historyHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  historyLabel: { color: colors.textMuted, fontSize: 14, marginTop: 13 },
  historyPicker: { flex: 1 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
  tableHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: colors.background },
  tableHeaderText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  tableCell: { flex: 1, color: colors.text, fontSize: 12 },
  employeeColumn: { flex: 1.35 },
  typeCell: { color: colors.success, fontWeight: "700" },
  amountCell: { fontWeight: "700" },
  deleteButton: { width: 24, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.textMuted, fontSize: 14, paddingVertical: 8 },
  runBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
  runHeader: { padding: 12, backgroundColor: colors.background, gap: 4 },
  runPeriod: { color: colors.text, fontSize: 15, fontWeight: "700" },
  runSummary: { color: colors.textMuted, fontSize: 13 },
  payslipRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border },
  payslipName: { flex: 1.5, minWidth: 90 },
  payslipEmployee: { color: colors.text, fontSize: 13, fontWeight: "600" },
  payslipMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  payslipMetric: { flex: 1, minWidth: 58 },
  metricLabel: { color: colors.textMuted, fontSize: 10, textTransform: "uppercase" },
  metricValue: { color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 3 },
  netValue: { fontWeight: "800" },
});