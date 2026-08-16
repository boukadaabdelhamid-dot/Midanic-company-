import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/colors";

type ContactHistoryRowProps = {
  title: string;
  subtitle?: string;
  amount?: string;
  onPress?: () => void;
};

export function ContactHistoryRow({
  title,
  subtitle,
  amount,
  onPress,
}: ContactHistoryRowProps) {
  const content = (
    <View style={styles.content}>
      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {amount ? <Text style={styles.amount}>{amount}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.textMuted} /> : null}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={styles.pressable} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: 8 },
  content: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  details: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 14, fontWeight: "600" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  amount: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});