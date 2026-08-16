import React, { useState } from "react";
import { View } from "react-native";
import type { CreateCustomerRequest } from "@workspace/api-client-react";
import { useLang } from "@/contexts/lang-context";
import { Card, Button, FormField, SectionTitle } from "@/components/ui";

export type CustomerFormValues = {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  city: string;
  wilaya: string;
  commune: string;
  notes: string;
};

export function emptyCustomerForm(): CustomerFormValues {
  return {
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: "",
    wilaya: "",
    commune: "",
    notes: "",
  };
}

export function customerFormToRequest(values: CustomerFormValues): CreateCustomerRequest {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    password: values.password.trim() || undefined,
    phone: values.phone.trim() || undefined,
    address: values.address.trim() || undefined,
    city: values.city.trim() || undefined,
    wilaya: values.wilaya.trim() || null,
    commune: values.commune.trim() || null,
    notes: values.notes.trim() || undefined,
    contactType: "customer",
    preferredLang: "ar",
  };
}

export function CustomerForm({
  values,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
}: {
  values: CustomerFormValues;
  onChange: (next: CustomerFormValues) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const { t } = useLang();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = t("Requis", "مطلوب");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit();
  }

  return (
    <View>
      <Card>
        <SectionTitle>{t("Informations du client", "معلومات الزبون")}</SectionTitle>
        <FormField
          label={t("Nom", "الاسم")}
          value={values.name}
          onChangeText={(value) => set("name", value)}
          error={errors.name}
          autoCapitalize="words"
        />
        <FormField
          label={t("Email (optionnel)", "البريد الإلكتروني (اختياري)")}
          value={values.email}
          onChangeText={(value) => set("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
        <FormField
          label={t("Téléphone", "الهاتف")}
          value={values.phone}
          onChangeText={(value) => set("phone", value)}
          keyboardType="phone-pad"
        />
        <FormField
          label={t("Mot de passe (optionnel)", "كلمة المرور (اختيارية)")}
          value={values.password}
          onChangeText={(value) => set("password", value)}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
        />
      </Card>

      <Card>
        <SectionTitle>{t("Adresse", "العنوان")}</SectionTitle>
        <FormField
          label={t("Adresse", "العنوان")}
          value={values.address}
          onChangeText={(value) => set("address", value)}
        />
        <FormField
          label={t("Ville", "المدينة")}
          value={values.city}
          onChangeText={(value) => set("city", value)}
        />
        <FormField
          label={t("Wilaya", "الولاية")}
          value={values.wilaya}
          onChangeText={(value) => set("wilaya", value)}
        />
        <FormField
          label={t("Commune", "البلدية")}
          value={values.commune}
          onChangeText={(value) => set("commune", value)}
        />
        <FormField
          label={t("Notes", "ملاحظات")}
          value={values.notes}
          onChangeText={(value) => set("notes", value)}
          multiline
        />
      </Card>

      <Button
        label={submitLabel}
        onPress={handleSubmit}
        loading={submitting}
        testID="button-submit-customer"
      />
    </View>
  );
}