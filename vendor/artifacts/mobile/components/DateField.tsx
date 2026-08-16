import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors } from "@/lib/colors";
import { useLang } from "@/contexts/lang-context";

function formatDate(date: Date, lang: "fr" | "ar"): string {
  return date.toLocaleDateString(lang === "ar" ? "ar" : "fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatInputDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseInputDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * Single date input. Tapping opens the native date picker (inline on
 * Android via a dialog, inline on iOS via a popover-style spinner shown
 * below the field). On web, use the browser's native date input because
 * @react-native-community/datetimepicker has no web implementation.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { isRTL, lang, t } = useLang();
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed") return;
    if (date) onChange(date);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {Platform.OS === "web" ? (
        <View
          style={[
            styles.trigger,
            isRTL && styles.triggerRTL,
            error && { borderColor: colors.danger },
            disabled && { backgroundColor: colors.background },
          ]}
          testID="web-date-field"
        >
          {React.createElement("input", {
            type: "date",
            value: value ? formatInputDate(value) : "",
            min: minimumDate ? formatInputDate(minimumDate) : undefined,
            max: maximumDate ? formatInputDate(maximumDate) : undefined,
            disabled,
            "aria-label": label,
            onChange: (event: { target?: { value?: string } }) => {
              const selected = parseInputDate(event.target?.value ?? "");
              if (selected) onChange(selected);
            },
            style: {
              appearance: "none",
              WebkitAppearance: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              color: value ? colors.text : colors.textMuted,
              flex: 1,
              minWidth: 0,
              fontFamily: "inherit",
              fontSize: 15,
              padding: 0,
            },
          })}
          <Feather name="calendar" size={18} color={colors.textMuted} />
        </View>
      ) : (
        <Pressable
          onPress={() => !disabled && setOpen(true)}
          disabled={disabled}
          style={[
            styles.trigger,
            isRTL && styles.triggerRTL,
            error && { borderColor: colors.danger },
            disabled && { backgroundColor: colors.background },
          ]}
          testID="button-open-date-field"
        >
          <Text style={[styles.triggerText, !value && { color: colors.textMuted }]}>
            {value ? formatDate(value, lang) : placeholder ?? t("Sélectionner une date", "اختر تاريخاً")}
          </Text>
          <Feather name="calendar" size={18} color={colors.textMuted} />
        </Pressable>
      )}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {Platform.OS !== "web" && open ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
    </View>
  );
}

/** Paired start/end date inputs for report filters, leave requests, etc. */
export function DateRangeField({
  label,
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  error,
}: {
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  onChangeStart: (date: Date) => void;
  onChangeEnd: (date: Date) => void;
  error?: string;
}) {
  const { isRTL, t } = useLang();
  return (
    <View style={[styles.rangeRow, isRTL && styles.rangeRowRTL]}>
      <View style={{ flex: 1 }}>
        <DateField
          label={t(`${label} — début`, `${label} — من`)}
          value={startDate}
          onChange={onChangeStart}
          maximumDate={endDate ?? undefined}
        />
      </View>
      <View style={{ flex: 1 }}>
        <DateField
          label={t(`${label} — fin`, `${label} — إلى`)}
          value={endDate}
          onChange={onChangeEnd}
          minimumDate={startDate ?? undefined}
          error={error}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: "500" },
  trigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  triggerRTL: { flexDirection: "row-reverse" },
  triggerText: { flex: 1, fontSize: 15, color: colors.text },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  rangeRow: { flexDirection: "row", gap: 12 },
  rangeRowRTL: { flexDirection: "row-reverse" },
});
