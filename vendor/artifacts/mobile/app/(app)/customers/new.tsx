import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateErpCustomer,
  getGetErpCustomersQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { ErrorState } from "@/components/ui";
import {
  CustomerForm,
  customerFormToRequest,
  emptyCustomerForm,
  type CustomerFormValues,
} from "@/components/CustomerForm";

export default function NewCustomer() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "customers" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const [values, setValues] = useState<CustomerFormValues>(emptyCustomerForm());
  const createCustomer = useCreateErpCustomer();

  if (!ready) return null;

  const canCreate = isAdmin || can("customers", "create");
  if (!canCreate) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function handleSubmit() {
    createCustomer.mutate(
      { data: customerFormToRequest(values) },
      {
        onSuccess: (customer) => {
          feedback.success("Client créé", "تم إنشاء الزبون");
          queryClient.invalidateQueries({ queryKey: getGetErpCustomersQueryKey() });
          router.replace(`/customers/${customer.id}` as never);
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  return (
    <Screen>
      <CustomerForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitting={createCustomer.isPending}
        submitLabel={t("Créer le client", "إنشاء الزبون")}
      />
    </Screen>
  );
}