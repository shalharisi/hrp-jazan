import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function ConsentBanner() {
  const { user, giveConsent } = useAuth();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(false);
  const ar = lang === "ar";

  if (!user || user.consentGivenAt) return null;

  async function handleConsent() {
    setLoading(true);
    try {
      await giveConsent();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? "إشعار الخصوصية وحماية البيانات" : "Privacy & Data Protection Notice"}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        role="document"
      >
        <div style={{ height: 4, background: "linear-gradient(90deg, #006633, #00a651)" }} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "#006633" }}
            >
              <Shield className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: "#006633" }}>
                {ar ? "إشعار حماية البيانات الشخصية" : "Personal Data Protection Notice"}
              </h2>
              <p className="text-xs text-gray-500">
                {ar ? "نظام PDPL – المملكة العربية السعودية" : "Saudi PDPL Compliance"}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            {ar
              ? "بتسجيل دخولك إلى هذه المنظومة، تقرّ بأنك مصرح لك بالوصول إلى البيانات الصحية الحساسة وفق مهامك الوظيفية. يتم تسجيل جميع العمليات التي تجريها في سجل تدقيق آمن، وفق أحكام نظام حماية البيانات الشخصية السعودي."
              : "By logging into this system, you acknowledge that you are authorized to access sensitive health data in accordance with your job responsibilities. All actions you perform are recorded in a secure audit log, in compliance with the Saudi Personal Data Protection Law (PDPL)."}
          </p>

          <ul className="text-sm text-gray-600 space-y-1.5 mb-5 list-none">
            {(ar
              ? [
                  "لن أشارك البيانات مع جهات غير مصرح لها",
                  "سأستخدم النظام لأغراض الرعاية الصحية فحسب",
                  "أدرك أن مخالفة ذلك تستوجب المساءلة القانونية",
                ]
              : [
                  "I will not share data with unauthorized parties",
                  "I will use the system for healthcare purposes only",
                  "I understand that violations may result in legal consequences",
                ]
            ).map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span style={{ color: "#006633" }} aria-hidden="true">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <Button
              onClick={handleConsent}
              disabled={loading}
              className="flex-1 font-semibold"
              style={{ background: "#006633", color: "#fff" }}
              aria-busy={loading}
            >
              {ar ? "أوافق وأمضي" : "I Agree & Proceed"}
            </Button>
            <a
              href="/privacy"
              className="flex-1 text-center text-sm text-gray-500 underline flex items-center justify-center"
              style={{ color: "#006633" }}
            >
              {ar ? "اقرأ سياسة الخصوصية" : "Read Privacy Policy"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
