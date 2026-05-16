import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck } from "lucide-react";
import logoPath from "../assets/logo.jpg";

export default function LoginPage() {
  const { login } = useAuth();
  const { lang } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ar = lang === "ar";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #006633 0%, #004d26 60%, #003319 100%)" }}
      dir={ar ? "rtl" : "ltr"}
    >
      {/* Government header bar */}
      <div className="bg-white/10 backdrop-blur border-b border-white/20 py-2 px-6 flex items-center justify-between">
        <span className="text-white/80 text-xs font-medium">
          {ar ? "المملكة العربية السعودية" : "Kingdom of Saudi Arabia"}
        </span>
        <span className="text-white/80 text-xs">
          {ar ? "وزارة الصحة" : "Ministry of Health"}
        </span>
      </div>

      {/* Main login card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.35)" }}
        >
          {/* Card top accent */}
          <div style={{ height: 6, background: "linear-gradient(90deg, #006633, #00a651)" }} />

          <div className="p-8">
            {/* Logo + Title */}
            <div className="flex flex-col items-center mb-8">
              <img
                src={logoPath}
                alt={ar ? "شعار تجمع جازان الصحي" : "Jazan Health Cluster Logo"}
                className="w-20 h-20 object-contain mb-3"
              />
              <h1
                className="text-xl font-bold text-center"
                style={{ color: "#006633" }}
              >
                {ar ? "منظومة تتبع الحمل عالي الخطورة" : "High-Risk Pregnancy Tracker"}
              </h1>
              <p className="text-sm text-gray-500 mt-1 text-center">
                {ar ? "تجمع جازان الصحي 2026" : "Jazan Health Cluster 2026"}
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-gray-700 font-medium">
                  {ar ? "اسم المستخدم" : "Username"}
                </Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={ar ? "أدخل اسم المستخدم" : "Enter username"}
                  required
                  className="h-11 text-base"
                  style={{ borderColor: "#006633", outline: "none" }}
                  aria-label={ar ? "اسم المستخدم" : "Username"}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  {ar ? "كلمة المرور" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={ar ? "أدخل كلمة المرور" : "Enter password"}
                  required
                  className="h-11 text-base"
                  style={{ borderColor: "#006633" }}
                  aria-label={ar ? "كلمة المرور" : "Password"}
                />
              </div>

              {error && (
                <Alert variant="destructive" role="alert" aria-live="polite">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full h-11 text-base font-semibold"
                style={{ background: "#006633", color: "#fff" }}
                aria-busy={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span className="mx-2">{ar ? "جاري تسجيل الدخول..." : "Signing in..."}</span></>
                ) : (
                  ar ? "تسجيل الدخول" : "Sign In"
                )}
              </Button>
            </form>

            {/* Security notice */}
            <div className="mt-6 flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200" role="note">
              <ShieldCheck className="w-4 h-4 text-green-700 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-green-800 leading-relaxed">
                {ar
                  ? "هذا النظام مخصص للمستخدمين المصرح لهم فقط. جميع العمليات مسجّلة وفق أنظمة حماية البيانات الشخصية (نظام PDPL)."
                  : "This system is for authorized users only. All actions are logged in accordance with Saudi PDPL data protection regulations."}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-8 py-4 text-center text-xs text-gray-400 border-t"
          >
            {ar
              ? "منظومة المعلومات الصحية | تجمع جازان الصحي 2026"
              : "Health Information System | Jazan Health Cluster 2026"}
          </div>
        </div>
      </div>

      {/* Government footer */}
      <div className="text-center py-3 text-white/50 text-xs">
        {ar
          ? "© 2026 وزارة الصحة – المملكة العربية السعودية. جميع الحقوق محفوظة."
          : "© 2026 Ministry of Health – Kingdom of Saudi Arabia. All rights reserved."}
      </div>
    </div>
  );
}
