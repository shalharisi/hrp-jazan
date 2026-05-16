import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Users, Activity, BarChart3 } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("hrp_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function downloadCsv(url: string, filename: string) {
  const res = await fetch(url, { headers: getAuthHeaders(), credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "فشل التنزيل" }));
    throw new Error(err.error ?? "فشل التنزيل");
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

export default function ReportsPage() {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const ar = lang === "ar";

  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingPregnancies, setLoadingPregnancies] = useState(false);

  const today = new Date().toLocaleDateString(ar ? "ar-SA" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  async function handleExport(type: "patients" | "pregnancies") {
    const setter = type === "patients" ? setLoadingPatients : setLoadingPregnancies;
    const url = `${API}/export/${type}.csv`;
    const filename = `${type}_${new Date().toISOString().split("T")[0]}.csv`;
    setter(true);
    try {
      await downloadCsv(url, filename);
      toast({ title: ar ? "تم التنزيل بنجاح" : "Downloaded successfully", variant: "default" });
    } catch (e) {
      toast({
        title: ar ? "فشل التنزيل" : "Download failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setter(false);
    }
  }

  const canExport = user?.role === "admin" || user?.role === "coordinator" || user?.role === "doctor";

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ background: "#e8f5ee" }}>
          <BarChart3 className="h-6 w-6" style={{ color: "#006633" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#006633" }}>
            {t("reports.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
      </div>

      {!canExport ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {ar ? "ليس لديك صلاحية تصدير التقارير" : "You don't have permission to export reports"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Patients CSV */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5" style={{ color: "#006633" }} />
                <CardTitle className="text-base">{t("reports.exportPatients")}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {ar
                  ? "جميع بيانات الحوامل: الاسم، الهوية، المركز الصحي، القطاع"
                  : "All patient records: name, ID, health center, sector"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("reports.exportDescription")}
              </p>
              <Button
                className="w-full gap-2"
                style={{ background: "#006633", color: "#fff" }}
                onClick={() => handleExport("patients")}
                disabled={loadingPatients}
              >
                {loadingPatients ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t("reports.downloading")}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    {t("reports.download")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Pregnancies CSV */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-5 w-5" style={{ color: "#006633" }} />
                <CardTitle className="text-base">{t("reports.exportPregnancies")}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {ar
                  ? "جميع الحالات: درجة الخطورة، الالتزام، التجلط، الإحالة، المواعيد"
                  : "All cases: risk level, compliance, VTE, referral, appointments"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("reports.exportDescription")}
              </p>
              <Button
                className="w-full gap-2"
                style={{ background: "#006633", color: "#fff" }}
                onClick={() => handleExport("pregnancies")}
                disabled={loadingPregnancies}
              >
                {loadingPregnancies ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t("reports.downloading")}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    {t("reports.download")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info note */}
      <Card className="border border-dashed" style={{ borderColor: "#006633" }}>
        <CardContent className="py-4 px-5">
          <p className="text-sm" style={{ color: "#006633" }}>
            {ar
              ? "ملاحظة: يحتوي الملف على البيانات العربية والإنجليزية معاً. يُنصح بفتحه في Excel مع تحديد ترميز UTF-8 عند الاستيراد."
              : "Note: The file contains both Arabic and English data. When opening in Excel, select UTF-8 encoding for best results."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
