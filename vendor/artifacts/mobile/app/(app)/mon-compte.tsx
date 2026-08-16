import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getGetErpAccountMeQueryKey,
  getGetErpCaissesQueryKey,
  getGetErpCaisseTransfersQueryKey,
  GetErpCaisseTransfersBox,
  useAcceptErpCaisseTransfer,
  useCancelErpCaisseTransfer,
  useGetErpAccountMe,
  useGetErpCaisseTransfers,
  useRejectErpCaisseTransfer,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useMe } from "@/hooks/use-me";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useConfirm } from "@/contexts/confirm-context";
import { Screen } from "@/components/Screen";
import { Card, LoadingView, Badge } from "@/components/ui";
import { colors } from "@/lib/colors";

type TransferBox = "inbox" | "outbox" | "all";
const CASH_ACCENT = "#C56A00";

const STATUS_LABEL: Record<string, [string, string]> = {
  pending: ["En attente", "قيد الانتظار"],
  accepted: ["Acceptée", "مقبولة"],
  rejected: ["Rejetée", "مرفوضة"],
  cancelled: ["Annulée", "ملغاة"],
};

function statusTone(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "accepted") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "muted";
}

function money(value: unknown, currency: string) {
  return `${Number(value ?? 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function transferDate(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("en-US", { month: "short" })}\n${date.toLocaleString("en-US", {
    day: "2-digit",
  })}\n${date.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function personOrCaisse(caisse: any, t: (fr: string, ar: string) => string) {
  return caisse?.kind === "main"
    ? t("Caisse principale", "الصندوق الرئيسي")
    : caisse?.owner?.name ?? "—";
}

export default function MonCompte() {
  const { ready } = useProtectedRoute();
  const { t, lang } = useLang();
  const { isAdmin } = useMe();
  const router = useRouter();
  const feedback = useApiFeedback();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [box, setBox] = useState<TransferBox>("inbox");
  const currency = lang === "ar" ? "دج" : "DA";

  const { data: account, isLoading: accountLoading } = useGetErpAccountMe({
    query: { enabled: ready, queryKey: getGetErpAccountMeQueryKey() },
  });
  const transferParams = { box };
  const {
    data: transfers,
    isLoading: transfersLoading,
    refetch: refetchTransfers,
  } = useGetErpCaisseTransfers(transferParams, {
    query: {
      enabled: ready,
      queryKey: getGetErpCaisseTransfersQueryKey(transferParams),
    },
  });

  const accept = useAcceptErpCaisseTransfer();
  const reject = useRejectErpCaisseTransfer();
  const cancel = useCancelErpCaisseTransfer();

  if (!ready) return <LoadingView />;
  if (accountLoading) return <LoadingView />;

  const accountData = account as any;
  const currentUser = accountData?.user;
  const myId = currentUser?.id ?? null;
  const roleLabel =
    currentUser?.role === "admin"
      ? t("Administrateur", "مدير")
      : t("Employé", "موظف");
  const storeName =
    lang === "ar" ? accountData?.store?.nameAr : accountData?.store?.nameEn;
  const rows = (transfers ?? []) as any[];

  function invalidateTransfers() {
    queryClient.invalidateQueries({ queryKey: getGetErpCaisseTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetErpCaissesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetErpAccountMeQueryKey() });
    refetchTransfers();
  }

  function handleAccept(id: number) {
    accept.mutate(
      { id },
      {
        onSuccess: () => {
          feedback.success("Transfert accepté", "تم قبول التحويل");
          invalidateTransfers();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  async function handleReject(id: number) {
    const confirmed = await confirm({
      title: t("Rejeter le virement", "رفض التحويل"),
      message: t("Les fonds seront retournés à l'expéditeur.", "ستتم إعادة الأموال إلى المرسل."),
      destructive: true,
    });
    if (!confirmed) return;
    reject.mutate(
      { id },
      {
        onSuccess: () => {
          feedback.success("Transfert rejeté", "تم رفض التحويل");
          invalidateTransfers();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  async function handleCancel(id: number) {
    const confirmed = await confirm({
      title: t("Annuler le virement", "إلغاء التحويل"),
      message: t("Les fonds retourneront dans votre caisse.", "ستعود الأموال إلى صندوقك."),
      destructive: true,
    });
    if (!confirmed) return;
    cancel.mutate(
      { id },
      {
        onSuccess: () => {
          feedback.success("Transfert annulé", "تم إلغاء التحويل");
          invalidateTransfers();
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <View style={styles.pageIntro}>
        <View style={styles.pageTitleRow}>
          <Feather name="user" size={27} color={colors.primary} />
          <Text style={styles.pageTitle}>{t("Mon Compte", "حسابي")}</Text>
        </View>
        <Text style={styles.pageSubtitle}>
          {t(
            "Votre profil, le solde de votre caisse et l'historique de vos virements.",
            "ملفك الشخصي ورصيد صندوقك وسجل تحويلاتك.",
          )}
        </Text>
      </View>

      <Card style={styles.profileCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Feather name="user" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t("Profil", "الملف الشخصي")}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings/profile" as never)}
            style={styles.linkButton}
            testID="button-edit-account"
          >
            <Feather name="edit-2" size={19} color={colors.textMuted} />
            <Text style={styles.linkText}>{t("Modifier", "تعديل")}</Text>
          </Pressable>
        </View>

        <ProfileRow label={t("Nom", "الاسم")} value={currentUser?.name ?? "—"} />
        <ProfileRow label={t("Rôle", "الدور")} value={roleLabel} />
        <ProfileRow label={t("Magasin", "المتجر")} value={storeName ?? "—"} icon="shopping-bag" />
        <ProfileRow label="Email" value={currentUser?.email ?? "—"} />

        <Pressable
          onPress={() => router.push("/settings/profile" as never)}
          style={styles.passwordButton}
          testID="button-account-password"
        >
          <Feather name="key" size={20} color={colors.text} />
          <Text style={styles.passwordText}>{t("Changer le mot de passe", "تغيير كلمة المرور")}</Text>
        </Pressable>
      </Card>

      <Card style={styles.cashCard}>
        <View style={styles.cashTitleRow}>
          <Feather name="briefcase" size={24} color={CASH_ACCENT} />
          <Text style={styles.cashTitle}>{t("Ma caisse", "صندوقي")}</Text>
        </View>
        <Text style={styles.cashBalance}>
          {money(accountData?.caisse?.balance, currency)}
        </Text>
        <Text style={styles.cashSubtitle}>{t("Solde actuel", "الرصيد الحالي")}</Text>
        <Pressable
          onPress={() => router.push("/caisse/transfer-new" as never)}
          style={styles.sendButton}
          testID="button-send-money"
        >
          <Feather name="send" size={18} color="#fff" />
          <Text style={styles.sendButtonText}>{t("Envoyer de l'argent", "إرسال الأموال")}</Text>
        </Pressable>
      </Card>

      <View style={styles.transferSection}>
        <View style={styles.tabs}>
          <TransferTab
            active={box === "inbox"}
            icon="inbox"
            label={t("Reçus", "الواردة")}
            onPress={() => setBox("inbox")}
          />
          <TransferTab
            active={box === "outbox"}
            icon="send"
            label={t("Envoyés", "الصادرة")}
            onPress={() => setBox("outbox")}
          />
          <TransferTab
            active={box === "all"}
            icon="columns"
            label={t("Tout", "الكل")}
            onPress={() => setBox("all")}
          />
        </View>

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <TableCell label="#" width={48} />
                <TableCell label={t("Date", "التاريخ")} width={86} />
                <TableCell label={t("De", "من")} width={150} />
                <TableCell label={t("À", "إلى")} width={150} />
                <TableCell label={t("Montant", "المبلغ")} width={132} align="right" />
                <TableCell label={t("Statut", "الحالة")} width={124} />
                <TableCell label={t("Actions", "الإجراءات")} width={174} />
              </View>
              {transfersLoading ? (
                <View style={styles.tableMessage}>
                  <LoadingView />
                </View>
              ) : rows.length === 0 ? (
                <View style={styles.tableMessage}>
                  <Text style={styles.emptyText}>{t("Aucun virement en attente", "لا توجد تحويلات")}</Text>
                </View>
              ) : (
                rows.map((tr) => {
                  const sender = personOrCaisse(tr.senderCaisse, t);
                  const recipient = personOrCaisse(tr.recipientCaisse, t);
                  const [statusFr, statusAr] = STATUS_LABEL[tr.status] ?? [tr.status, tr.status];
                  const isRecipient =
                    tr.recipientCaisse?.ownerUserId === myId ||
                    (isAdmin && tr.recipientCaisse?.kind === "main");
                  const isSender =
                    tr.senderCaisse?.ownerUserId === myId ||
                    (isAdmin && tr.senderCaisse?.kind === "main");

                  return (
                    <View key={tr.id} style={styles.tableRow}>
                      <TableCell label={`#${tr.id}`} width={48} />
                      <TableCell label={transferDate(tr.createdAt)} width={86} multiline />
                      <TableCell label={sender} width={150} multiline />
                      <TableCell label={recipient} width={150} multiline />
                      <TableCell label={money(tr.amount, currency)} width={132} align="right" strong multiline />
                      <View style={[styles.tableCell, { width: 124 }]}>
                        <Badge label={t(statusFr, statusAr)} tone={statusTone(tr.status)} />
                      </View>
                      <View style={[styles.tableCell, styles.actionsCell, { width: 174 }]}>
                        {tr.status === "pending" && isRecipient ? (
                          <>
                            <TableAction
                              icon="check"
                              label={t("Accepter", "قبول")}
                              tone="success"
                              onPress={() => handleAccept(tr.id)}
                            />
                            <TableAction
                              icon="x"
                              label={t("Refuser", "رفض")}
                              tone="danger"
                              onPress={() => handleReject(tr.id)}
                            />
                          </>
                        ) : tr.status === "pending" && isSender ? (
                          <TableAction
                            icon="x-circle"
                            label={t("Annuler", "إلغاء")}
                            tone="danger"
                            onPress={() => handleCancel(tr.id)}
                          />
                        ) : (
                          <Text style={styles.actionDash}>—</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
}

function ProfileRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileLabelRow}>
        {icon ? <Feather name={icon} size={17} color={colors.textMuted} /> : null}
        <Text style={styles.profileLabel}>{label}</Text>
      </View>
      <Text style={styles.profileValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function TransferTab({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
      <Feather name={icon} size={18} color={active ? colors.text : colors.textMuted} />
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

function TableCell({
  label,
  width,
  align = "left",
  strong = false,
  multiline = false,
}: {
  label: string;
  width: number;
  align?: "left" | "right";
  strong?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.tableCell, { width, alignItems: align === "right" ? "flex-end" : "flex-start" }]}>
      <Text style={[styles.tableText, strong && styles.tableStrong]} numberOfLines={multiline ? 3 : 1}>
        {label}
      </Text>
    </View>
  );
}

function TableAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  tone: "success" | "danger";
  onPress: () => void;
}) {
  const color = tone === "success" ? "#16794C" : colors.danger;
  return (
    <Pressable onPress={onPress} style={[styles.tableAction, { borderColor: color }]}>
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.tableActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: 20, paddingBottom: 40, gap: 20 },
  pageIntro: { gap: 2 },
  pageTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageTitle: { color: colors.primary, fontSize: 29, fontWeight: "700" },
  pageSubtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
  profileCard: { padding: 30, borderRadius: 15, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700" },
  linkButton: { flexDirection: "row", alignItems: "center", gap: 8, padding: 4 },
  linkText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  profileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  profileLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  profileLabel: { color: colors.textMuted, fontSize: 16 },
  profileValue: { color: colors.text, fontSize: 16, fontWeight: "600", textAlign: "right", flex: 1.75 },
  passwordButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingVertical: 11, marginTop: 15 },
  passwordText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  cashCard: { backgroundColor: "#FFFCF5", borderColor: "#F5DF65", borderWidth: 2, padding: 30, borderRadius: 15 },
  cashTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cashTitle: { color: colors.text, fontSize: 19, fontWeight: "700" },
  cashBalance: { color: "#C55F08", fontSize: 39, lineHeight: 48, fontWeight: "800", marginTop: 14 },
  cashSubtitle: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  sendButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.primary, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 16, alignSelf: "flex-start", marginTop: 16 },
  sendButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  transferSection: { gap: 12 },
  tabs: { flexDirection: "row", backgroundColor: "#EEF0EE", borderRadius: 8, padding: 4, gap: 2 },
  tab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 6, borderRadius: 6 },
  activeTab: { backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  activeTabText: { color: colors.text },
  tableCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, overflow: "hidden" },
  table: { minWidth: 804 },
  tableRow: { flexDirection: "row", minHeight: 72, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeader: { minHeight: 50, backgroundColor: "#FAFAFA" },
  tableCell: { justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 },
  tableText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  tableStrong: { fontWeight: "700", textAlign: "right" },
  tableMessage: { minHeight: 150, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  actionsCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionDash: { color: colors.textMuted, fontSize: 15 },
  tableAction: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 5 },
  tableActionText: { fontSize: 11, fontWeight: "700" },
});