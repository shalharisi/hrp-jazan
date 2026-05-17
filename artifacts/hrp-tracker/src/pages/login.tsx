import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, KeyRound, ArrowRight } from "lucide-react";
import logoPath from "../assets/branding.jpg";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

type Mode = "login" | "changePassword";

export default function LoginPage() {
  const { login } = useAuth();
  const { lang, t } = useI18n();
  const ar = lang === "ar";

  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Change password state
  const [cpUsername, setCpUsername] = useState("");
  const [cpCurrentPassword, setCpCurrentPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setCpError("");

    if (cpNewPassword.length < 8) {
      setCpError(t("auth.passwordTooShort"));
      return;
    }
    if (cpNewPassword !== cpConfirm) {
      setCpError(t("auth.passwordMismatch"));
      return;
    }

    setCpLoading(true);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cpUsername,
          currentPassword: cpCurrentPassword,
          newPassword: cpNewPassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setCpError(data.error ?? "فشل تغيير كلمة المرور");
      } else {
        setCpSuccess(true);
      }
    } catch {
      setCpError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setCpLoading(false);
    }
  }

  function switchToChangePassword() {
    setMode("changePassword");
    setCpUsername(username);
    setCpCurrentPassword("");
    setCpNewPassword("");
    setCpConfirm("");
    setCpError("");
    setCpSuccess(false);
  }

  function switchToLogin() {
    setMode("login");
    setLoginError("");
    setCpSuccess(false);
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
          {ar ? "تجمع جازان الصحي" : "Jazan Health Cluster"}
        </span>
      </div>

      {/* Main card */}
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
              <h1 className="text-xl font-bold text-center" style={{ color: "#006633" }}>
                {ar ? "منظومة تتبع الحمل عالي الخطورة" : "High-Risk Pregnancy Tracker"}
              </h1>
              <p className="text-sm text-gray-500 mt-1 text-center">
                {ar ? "تجمع جازان الصحي 2026" : "Jazan Health Cluster 2026"}
              </p>
            </div>

            {mode === "login" ? (
              /* ── Login form ── */
              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-gray-700 font-medium">
                    {ar ? "اسم المستخدم" : "Username"}
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={ar ? "أدخل اسم المستخدم" : "Enter username"}
                    required
                    className="h-11 text-base"
                    style={{ borderColor: "#006633" }}
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={ar ? "أدخل كلمة المرور" : "Enter password"}
                    required
                    className="h-11 text-base"
                    style={{ borderColor: "#006633" }}
                    aria-label={ar ? "كلمة المرور" : "Password"}
                  />
                </div>

                {loginError && (
                  <Alert variant="destructive" role="alert" aria-live="polite">
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loginLoading || !username || !password}
                  className="w-full h-11 text-base font-semibold"
                  style={{ background: "#006633", color: "#fff" }}
                  aria-busy={loginLoading}
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="mx-2">{ar ? "جاري تسجيل الدخول..." : "Signing in..."}</span>
                    </>
                  ) : ar ? (
                    "تسجيل الدخول"
                  ) : (
                    "Sign In"
                  )}
                </Button>

                {/* Change password link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={switchToChangePassword}
                    className="text-sm font-medium hover:underline focus:outline-none"
                    style={{ color: "#006633" }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      {t("auth.changePassword")}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              /* ── Change password form ── */
              <div>
                {cpSuccess ? (
                  <div className="space-y-5">
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800 text-sm leading-relaxed">
                        {t("auth.changePasswordSuccess")}
                      </AlertDescription>
                    </Alert>
                    <Button
                      type="button"
                      onClick={switchToLogin}
                      className="w-full h-11 text-base font-semibold"
                      style={{ background: "#006633", color: "#fff" }}
                    >
                      {t("auth.backToLogin")}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                    <div className="flex items-center gap-2 mb-5">
                      <button
                        type="button"
                        onClick={switchToLogin}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label={t("auth.backToLogin")}
                      >
                        <ArrowRight
                          className="w-4 h-4"
                          style={{ transform: ar ? "none" : "rotate(180deg)" }}
                        />
                      </button>
                      <h2 className="text-base font-bold" style={{ color: "#006633" }}>
                        {t("auth.changePassword")}
                      </h2>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cp-username" className="text-gray-700 font-medium">
                        {ar ? "اسم المستخدم" : "Username"}
                      </Label>
                      <Input
                        id="cp-username"
                        type="text"
                        autoComplete="username"
                        value={cpUsername}
                        onChange={(e) => setCpUsername(e.target.value)}
                        placeholder={ar ? "أدخل اسم المستخدم" : "Enter username"}
                        required
                        className="h-11 text-base"
                        style={{ borderColor: "#006633" }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cp-current" className="text-gray-700 font-medium">
                        {t("auth.currentPassword")}
                      </Label>
                      <Input
                        id="cp-current"
                        type="password"
                        autoComplete="current-password"
                        value={cpCurrentPassword}
                        onChange={(e) => setCpCurrentPassword(e.target.value)}
                        placeholder={ar ? "أدخل كلمة المرور الحالية" : "Enter current password"}
                        required
                        className="h-11 text-base"
                        style={{ borderColor: "#006633" }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cp-new" className="text-gray-700 font-medium">
                        {t("auth.newPassword")}
                      </Label>
                      <Input
                        id="cp-new"
                        type="password"
                        autoComplete="new-password"
                        value={cpNewPassword}
                        onChange={(e) => setCpNewPassword(e.target.value)}
                        placeholder={ar ? "8 أحرف على الأقل" : "At least 8 characters"}
                        required
                        className="h-11 text-base"
                        style={{ borderColor: "#006633" }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cp-confirm" className="text-gray-700 font-medium">
                        {t("auth.confirmNewPassword")}
                      </Label>
                      <Input
                        id="cp-confirm"
                        type="password"
                        autoComplete="new-password"
                        value={cpConfirm}
                        onChange={(e) => setCpConfirm(e.target.value)}
                        placeholder={ar ? "أعد كتابة كلمة المرور الجديدة" : "Repeat new password"}
                        required
                        className="h-11 text-base"
                        style={{ borderColor: "#006633" }}
                      />
                    </div>

                    {cpError && (
                      <Alert variant="destructive" role="alert" aria-live="polite">
                        <AlertDescription>{cpError}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={
                        cpLoading ||
                        !cpUsername ||
                        !cpCurrentPassword ||
                        !cpNewPassword ||
                        !cpConfirm
                      }
                      className="w-full h-11 text-base font-semibold"
                      style={{ background: "#006633", color: "#fff" }}
                      aria-busy={cpLoading}
                    >
                      {cpLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="mx-2">{ar ? "جاري التغيير..." : "Changing..."}</span>
                        </>
                      ) : (
                        t("auth.changePasswordBtn")
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* Security notice */}
            {mode === "login" && (
              <div
                className="mt-6 flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200"
                role="note"
              >
                <ShieldCheck
                  className="w-4 h-4 text-green-700 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-xs text-green-800 leading-relaxed">
                  {ar
                    ? "هذا النظام مخصص للمستخدمين المصرح لهم فقط. جميع العمليات مسجّلة وفق أنظمة حماية البيانات الشخصية (نظام PDPL)."
                    : "This system is for authorized users only. All actions are logged in accordance with Saudi PDPL data protection regulations."}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 text-center text-xs text-gray-400 border-t">
            {ar
              ? "منظومة المعلومات الصحية | تجمع جازان الصحي 2026"
              : "Health Information System | Jazan Health Cluster 2026"}
          </div>
        </div>
      </div>

      {/* Government footer */}
      <div className="text-center py-3 text-white/50 text-xs">
        {ar
          ? "© 2026 تجمع جازان الصحي. جميع الحقوق محفوظة."
          : "© 2026 Jazan Health Cluster. All rights reserved."}
      </div>
    </div>
  );
}
