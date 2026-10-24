import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequestTrial, useListProducts } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { hasCompleteRequestAnswers, ProductRequestFields, type RequestAnswers, type RequestFieldConfig } from '@/components/product-request-fields';

const PRODUCT_CATALOG_MODE_FIELD: RequestFieldConfig = {
  key: 'product_catalog_mode',
  label: {
    en: 'If you have multiple stores, do they share the same products?',
    fr: 'Si vous avez plusieurs magasins, partagent-ils les mêmes produits ?',
    ar: 'إذا كان لديكم عدة متاجر، هل تتشارك المنتجات نفسها؟',
  },
  type: 'select',
  required: true,
  options: [
    {
      value: 'separate',
      label: {
        en: 'Each store has its own products',
        fr: 'Chaque magasin a ses propres produits',
        ar: 'لكل متجر منتجاته الخاصة',
      },
    },
    {
      value: 'shared',
      label: {
        en: 'All stores share the same products',
        fr: 'Tous les magasins partagent les mêmes produits',
        ar: 'جميع المتاجر تتشارك المنتجات نفسها',
      },
    },
  ],
};

const trialSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  companyName: z.string().min(1),
  phone: z.string().optional(),
  productId: z.coerce.number(),
  message: z.string().optional(),
});

type TrialForm = z.infer<typeof trialSchema>;

export default function Trial() {
  const { t, i18n } = useTranslation();
  const requestTrialMutation = useRequestTrial();
  const { data: products } = useListProducts();
  const [customAnswers, setCustomAnswers] = useState<RequestAnswers>({});

  const form = useForm<TrialForm>({
    resolver: zodResolver(trialSchema),
    defaultValues: {
      name: '',
      email: '',
      companyName: '',
      phone: '',
      productId: 0,
      message: '',
    },
  });

  const onSubmit = (data: TrialForm) => {
    const selectedProduct = products?.find((product) => product.id === data.productId);
    const fields = selectedProduct?.productType === 'erp'
      ? [
          ...selectedProduct.requestFormFields.filter((field) => field.key !== PRODUCT_CATALOG_MODE_FIELD.key),
          PRODUCT_CATALOG_MODE_FIELD,
        ]
      : [];
    if (!hasCompleteRequestAnswers(fields, customAnswers)) {
      toast.error(t('trial.required_product_fields'));
      return;
    }
    requestTrialMutation.mutate(
      { data: { ...data, customAnswers } },
      {
        onSuccess: () => {
          toast.success(t('trial.success'));
          form.reset();
          setCustomAnswers({});
        },
        onError: () => {
          toast.error(t('trial.error'));
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
              {t('trial.page_title')}
            </h1>
            <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
              {t('trial.page_subtitle')}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('trial.page_title')}</CardTitle>
              <CardDescription>{t('trial.page_subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-trial">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('trial.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('trial.email')}</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('trial.company')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('trial.phone')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('trial.product')}</FormLabel>
                          <Select onValueChange={(value) => { field.onChange(value); setCustomAnswers({}); }} value={field.value ? field.value.toString() : undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product">
                              <SelectValue placeholder={t('trial.product')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id.toString()}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(() => {
                    const selectedProduct = products?.find((product) => product.id === Number(form.watch('productId')));
                    return selectedProduct?.productType === 'erp' ? (
                      <ProductRequestFields
                        fields={[
                          ...selectedProduct.requestFormFields.filter((field) => field.key !== PRODUCT_CATALOG_MODE_FIELD.key),
                          PRODUCT_CATALOG_MODE_FIELD,
                        ]}
                        answers={customAnswers}
                        language={i18n.language}
                        onChange={(key, value) => setCustomAnswers((current) => ({ ...current, [key]: value }))}
                      />
                    ) : null;
                  })()}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('trial.message')}</FormLabel>
                        <FormControl>
                          <Textarea rows={4} {...field} data-testid="input-message" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={requestTrialMutation.isPending}
                    data-testid="button-submit"
                  >
                    {requestTrialMutation.isPending ? t('trial.submitting') : t('trial.submit')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
