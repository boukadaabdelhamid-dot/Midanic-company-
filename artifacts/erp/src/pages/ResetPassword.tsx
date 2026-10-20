import { useState } from "react";
import { Link } from "wouter";
import { useLang } from "@/hooks/use-lang";
import { getApiBase } from "@/lib/api-base";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export default function ResetPassword({ token }: { token: string }) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6 || password !== confirm) {
      setError(t("Saisissez deux mots de passe identiques d'au moins 6 caractères.", "أدخل كلمة مرور لا تقل عن 6 أحرف وأكدها بنفس القيمة."));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/reset-password/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(response.status === 400
          ? t("Ce lien est invalide ou expiré. Demandez un nouveau lien.", "رابط الاستعادة غير صالح أو منتهي. اطلب رابطًا جديدًا.")
          : t("Le service est indisponible. Réessayez plus tard.", "الخدمة غير متاحة حاليًا. أعد المحاولة لاحقًا."));
        return;
      }
      await qc.cancelQueries();
      logout();
      qc.clear();
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch {
      setError(t("Erreur réseau. Réessayez.", "تعذر الاتصال. أعد المحاولة."));
    } finally {
      setSaving(false);
    }
  }

  return <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Card className="w-full max-w-sm shadow-md">
      <CardHeader><CardTitle className="text-center text-primary">
        {t("Réinitialiser le mot de passe", "إعادة تعيين كلمة المرور")}
      </CardTitle></CardHeader>
      <CardContent>
        {done ? <div className="space-y-4 text-center">
          <p role="status">{t("Mot de passe modifié. Connectez-vous avec le nouveau mot de passe.", "تم تغيير كلمة المرور. سجل الدخول باستخدام كلمة المرور الجديدة.")}</p>
          <Link href="/login" className="text-primary underline">{t("Se connecter", "تسجيل الدخول")}</Link>
        </div> : <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">{t("Nouveau mot de passe", "كلمة المرور الجديدة")}</Label>
            <Input id="reset-password" type="password" minLength={6} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">{t("Confirmer le mot de passe", "تأكيد كلمة المرور")}</Label>
            <Input id="reset-confirm" type="password" minLength={6} autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button className="w-full" disabled={saving || !/^[a-f0-9]{64}$/i.test(token)}>
            {saving ? t("Enregistrement…", "جارٍ الحفظ…") : t("Enregistrer", "حفظ")}
          </Button>
          {!/^[a-f0-9]{64}$/i.test(token) && <p role="alert">{t("Lien invalide.", "الرابط غير صالح.")}</p>}
          <Link href="/forgot-password" className="block text-center text-sm text-primary underline">{t("Demander un nouveau lien", "طلب رابط جديد")}</Link>
        </form>}
      </CardContent>
    </Card>
  </div>;
}
