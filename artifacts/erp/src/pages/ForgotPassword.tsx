import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/hooks/use-lang";
import { getApiBase } from "@/lib/api-base";

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => lang === "ar" ? ar : fr;
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormData) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${getApiBase()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email.trim().toLowerCase() }),
      });
      if (!response.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(t("Impossible de traiter la demande. Veuillez réessayer.", "تعذر إكمال الطلب. حاول مرة أخرى."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            {t("Mot de passe oublié ?", "هل نسيت كلمة المرور؟")}
          </CardTitle>
          <CardDescription>
            {t("Saisissez votre e-mail pour recevoir un lien de réinitialisation.", "أدخل بريدك الإلكتروني لاستلام رابط إعادة التعيين.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div className="text-3xl text-green-600" aria-hidden="true">✓</div>
              <p className="text-sm text-muted-foreground">
                {t("Si cette adresse est enregistrée, vous recevrez bientôt les instructions.", "إذا كان البريد مسجلاً لدينا، ستصلك التعليمات قريبًا.")}
              </p>
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                {t("Retour à la connexion", "العودة إلى تسجيل الدخول")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir={lang === "ar" ? "rtl" : "ltr"} data-testid="form-forgot-password">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">{t("Email", "البريد الإلكتروني")}</Label>
                <Input id="forgot-email" type="email" autoComplete="email" {...register("email")} data-testid="input-forgot-email" />
                {errors.email && <p className="text-sm text-destructive">{t("Adresse e-mail invalide.", "البريد الإلكتروني غير صالح.")}</p>}
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-forgot-submit">
                {loading ? t("Envoi...", "جارٍ الإرسال...") : t("Envoyer le lien", "إرسال رابط الإعادة")}
              </Button>
              <div className="pt-2 text-center">
                <Link href="/login" className="text-sm text-primary hover:underline">
                  {t("Retour à la connexion", "العودة إلى تسجيل الدخول")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}