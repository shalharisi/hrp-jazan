import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

type Section = {
  id: string;
  ar: string;
  en: string;
  subsections: { ar: string; en: string; content: { ar: string; en: string } }[];
};

const sections: Section[] = [
  {
    id: "s1",
    ar: "القسم الأول: نظرة عامة على المنظومة",
    en: "Section 1: System Overview",
    subsections: [
      { ar: "1.1 الهدف والغاية", en: "1.1 Purpose & Goals", content: { ar: "منظومة إلكترونية متكاملة لإدارة ومتابعة حالات الحمل عالي الخطورة في تجمع جازان الصحي، تستبدل العمل الورقي وملفات Excel بمنصة رقمية مركزية.", en: "An integrated digital platform for managing high-risk pregnancies across Jazan Health Cluster, replacing paper-based and Excel workflows." } },
      { ar: "1.2 الفوائد الرئيسية", en: "1.2 Key Benefits", content: { ar: "تتبع آني، تصنيف آلي لدرجة الخطورة، تنبيهات فورية للحالات الحرجة، لوحة إحصاءات شاملة، تصدير CSV، وواجهة ثنائية اللغة.", en: "Real-time tracking, automatic risk classification, instant critical-case alerts, comprehensive KPI dashboard, CSV export, and bilingual UI." } },
      { ar: "1.3 الفئات المستهدفة", en: "1.3 Target Users", content: { ar: "منسق الحوامل عالي الخطورة (وصول كامل)، الطبيب (إدارة سريرية)، المسؤول (كل الصلاحيات)، المشاهد (قراءة فقط).", en: "HRP Coordinator (full access), Doctor (clinical management), Admin (all permissions), Viewer (read-only)." } },
      { ar: "1.4 متطلبات التشغيل", en: "1.4 System Requirements", content: { ar: "متصفح Chrome/Edge/Firefox 110+، حاسب أو لابتوب، اتصال إنترنت مستقر.", en: "Chrome/Edge/Firefox 110+, desktop or laptop, stable internet connection." } },
    ],
  },
  {
    id: "s2",
    ar: "القسم الثاني: تسجيل الدخول وإدارة الجلسة",
    en: "Section 2: Login & Session Management",
    subsections: [
      { ar: "2.1 شاشة تسجيل الدخول", en: "2.1 Login Screen", content: { ar: "تعرض شعار تجمع جازان الصحي وحقلَي اسم المستخدم وكلمة المرور.", en: "Displays the Jazan Health Cluster logo and username/password fields." } },
      { ar: "2.2 خطوات تسجيل الدخول", en: "2.2 Login Steps", content: { ar: "أدخِل اسم المستخدم → أدخِل كلمة المرور → اضغط «تسجيل الدخول». عند صحة البيانات تنتقل مباشرةً إلى لوحة المعلومات.", en: "Enter username → Enter password → Click 'Login'. On success you are redirected to the dashboard." } },
      { ar: "2.3 سياسة الجلسة والأمان", en: "2.3 Session & Security Policy", content: { ar: "الجلسة نشطة طالما تتفاعل مع المنظومة. جميع العمليات مُسجَّلة وفق نظام حماية البيانات الشخصية (PDPL).", en: "Session stays active while you interact with the system. All actions are logged per PDPL regulations." } },
      { ar: "2.4 تبديل اللغة", en: "2.4 Language Toggle", content: { ar: "اضغط أيقونة اللغة في الشريط الجانبي للتبديل بين العربية والإنجليزية. يُحفَظ التفضيل تلقائيًا.", en: "Click the language icon in the sidebar to switch between Arabic and English. Preference is saved automatically." } },
    ],
  },
  {
    id: "s3",
    ar: "القسم الثالث: لوحة المعلومات",
    en: "Section 3: Dashboard",
    subsections: [
      { ar: "3.1 البطاقات الإحصائية الأربع", en: "3.1 Four KPI Cards", content: { ar: "إجمالي المرضى، إجمالي الحالات، الحالات الحرجة (مع عدد بلا موعد)، نسبة الالتزام بالمواعيد.", en: "Total patients, total pregnancy cases, critical cases (with count without appointments), booking compliance rate." } },
      { ar: "3.2 المخططات البيانية", en: "3.2 Charts", content: { ar: "مخطط دائري لتوزيع مستوى الخطورة، مخطط أعمدة لتوزيع القطاعات، مخطط نسبة الالتزام، مخطط حضور المستشفيات.", en: "Pie chart for risk level distribution, bar chart for sector distribution, compliance chart, hospital attendance chart." } },
      { ar: "3.3 لوحة التنبيهات الفورية", en: "3.3 Alerts Panel", content: { ar: "تُعرَض تنبيهات حالات VTE بدون إينوكسابارين، الحالات الحرجة بدون موعد، والمواعيد الفائتة.", en: "Shows alerts for VTE cases without Enoxaparin, critical cases without booked appointments, and missed appointments." } },
    ],
  },
  {
    id: "s4",
    ar: "القسم الرابع: إدارة الحوامل",
    en: "Section 4: Patient Management",
    subsections: [
      { ar: "4.1 قائمة الحوامل والبحث", en: "4.1 Patient List & Search", content: { ar: "بحث بالاسم أو الهوية الوطنية، فلترة حسب المركز الصحي أو القطاع.", en: "Search by name or national ID, filter by health center or sector." } },
      { ar: "4.2 تسجيل حامل جديدة", en: "4.2 Register New Patient", content: { ar: "أدخِل الاسم، الهوية الوطنية (10 أرقام فريدة)، تاريخ الميلاد، رقم الجوال، والمركز الصحي.", en: "Enter name, national ID (10-digit unique), date of birth, phone number, and health center." } },
      { ar: "4.3 تعديل بيانات الحامل", en: "4.3 Edit Patient", content: { ar: "اضغط أيقونة التعديل في صف المريضة لتعديل بياناتها الشخصية.", en: "Click the edit icon on the patient row to update her personal details." } },
      { ar: "4.4 ملف الحامل التفصيلي", en: "4.4 Patient Detail File", content: { ar: "يعرض بيانات الحامل الكاملة وجميع حالات حملها التاريخية مرتبةً زمنيًا.", en: "Shows the patient's full details and all her pregnancy cases sorted chronologically." } },
    ],
  },
  {
    id: "s5",
    ar: "القسم الخامس: إدارة حالات الحمل",
    en: "Section 5: Pregnancy Case Management",
    subsections: [
      { ar: "5.1 تسجيل حالة حمل جديدة", en: "5.1 Register Pregnancy", content: { ar: "تاريخ الزيارة، عمر الحمل، عوامل الخطورة، الأمراض المزمنة، الأدوية، وتوصية الإحالة.", en: "Visit date, gestational age, risk factors, chronic conditions, medications, and referral recommendation." } },
      { ar: "5.2 تصنيف الخطورة", en: "5.2 Risk Classification", content: { ar: "منخفض / متوسط / عالي / حرج — يُحسَب آليًا بناءً على عوامل الخطر المُدخَلة.", en: "Low / Medium / High / Critical — computed automatically from entered risk factors." } },
      { ar: "5.3 VTE والإينوكسابارين", en: "5.3 VTE & Enoxaparin", content: { ar: "حالات خطر التجلط الوريدي يجب أن يُوصَف لها Enoxaparin. يُولِّد النظام تنبيهًا إذا لم يُوصَف.", en: "VTE high-risk cases must be prescribed Enoxaparin. The system generates an alert if not prescribed." } },
      { ar: "5.4 توصية الإحالة", en: "5.4 Referral Recommendation", content: { ar: "متابعة في المركز / متابعة في المستشفى / تحويل لـ KFCH.", en: "Follow-up at center / Follow-up at hospital / Transfer to KFCH." } },
      { ar: "5.5 تعديل حالة الحمل", en: "5.5 Edit Pregnancy", content: { ar: "يمكن تعديل جميع بيانات الحالة بعد تسجيلها باستثناء الهوية الوطنية.", en: "All case fields can be edited after registration except the national ID." } },
    ],
  },
  {
    id: "s6",
    ar: "القسم السادس: المواعيد وبطاقة الالتزام",
    en: "Section 6: Appointments & Compliance",
    subsections: [
      { ar: "6.1 تسجيل الموعد", en: "6.1 Book Appointment", content: { ar: "أدخِل تاريخ الموعد في المستشفى لكل حالة حمل.", en: "Enter the hospital appointment date for each pregnancy case." } },
      { ar: "6.2 مؤشر الالتزام", en: "6.2 Compliance Indicator", content: { ar: "ملتزم (≤ يومَي عمل) / غير ملتزم (> يومَي عمل) / بانتظار موعد. أيام العمل تستثني الجمعة والسبت.", en: "Compliant (≤ 2 working days) / Non-compliant (> 2) / Pending. Working days exclude Friday and Saturday." } },
      { ar: "6.3 تسجيل الحضور", en: "6.3 Attendance Logging", content: { ar: "سجِّل حضور المريضة للموعد أو غيابها مع ملاحظة اختيارية.", en: "Log whether the patient attended her appointment, with an optional note." } },
    ],
  },
  {
    id: "s7",
    ar: "القسم السابع: التنبيهات السريرية",
    en: "Section 7: Clinical Alerts",
    subsections: [
      { ar: "7.1 أنواع التنبيهات", en: "7.1 Alert Types", content: { ar: "VTE بدون إينوكسابارين، حالات حرجة بدون موعد مسجَّل، مواعيد فائتة (لم يُسجَّل حضور).", en: "VTE without Enoxaparin, critical cases without a booked appointment, missed appointments (no attendance logged)." } },
      { ar: "7.2 التعامل مع التنبيهات", en: "7.2 Acting on Alerts", content: { ar: "اضغط على التنبيه للانتقال مباشرةً إلى بيانات المريضة لاتخاذ الإجراء المطلوب.", en: "Click an alert to navigate directly to the patient's record and take the required action." } },
    ],
  },
  {
    id: "s8",
    ar: "القسم الثامن: التقارير وتصدير البيانات",
    en: "Section 8: Reports & Data Export",
    subsections: [
      { ar: "8.1 تصدير قائمة الحوامل", en: "8.1 Export Patients CSV", content: { ar: "يصدِّر جميع بيانات الحوامل بصيغة CSV مع ترميز UTF-8 (BOM للعربية في Excel).", en: "Exports all patient data as CSV with UTF-8 encoding (BOM for Arabic in Excel)." } },
      { ar: "8.2 تصدير قائمة الحالات", en: "8.2 Export Pregnancies CSV", content: { ar: "يصدِّر جميع بيانات الحالات بما فيها درجة الخطورة، الالتزام، المستشفى، والقطاع.", en: "Exports all pregnancy case data including risk level, compliance, hospital, and sector." } },
    ],
  },
  {
    id: "s9",
    ar: "القسم التاسع: إدارة المستخدمين",
    en: "Section 9: User Administration",
    subsections: [
      { ar: "9.1 إضافة مستخدم جديد", en: "9.1 Add New User", content: { ar: "متاح للمسؤول (Admin) فقط. أدخِل اسم المستخدم، كلمة المرور، الدور، والقطاع (للمنسق).", en: "Admin only. Enter username, password, role, and sector (for coordinators)." } },
      { ar: "9.2 تعديل وتعطيل المستخدمين", en: "9.2 Edit & Deactivate Users", content: { ar: "يمكن للمسؤول تعديل بيانات المستخدمين أو تعطيل حساباتهم دون حذفها.", en: "Admin can edit user details or deactivate accounts without deleting them." } },
    ],
  },
  {
    id: "s10",
    ar: "القسم العاشر: الأمان والخصوصية",
    en: "Section 10: Security & Privacy",
    subsections: [
      { ar: "10.1 سجل العمليات (Audit Log)", en: "10.1 Audit Log", content: { ar: "يسجِّل النظام جميع عمليات تسجيل الدخول، الإضافة، التعديل، والحذف مع بيانات المستخدم والتوقيت.", en: "The system logs all login, create, update, and delete actions with user details and timestamps." } },
      { ar: "10.2 الامتثال لنظام PDPL", en: "10.2 PDPL Compliance", content: { ar: "جميع البيانات سرية ومخصصة للاستخدام الداخلي. يُحظر نشرها خارج نطاق المنظومة وفق نظام حماية البيانات الشخصية السعودي.", en: "All data is confidential and for internal use only, in compliance with Saudi Arabia's Personal Data Protection Law (PDPL)." } },
    ],
  },
];

type FileStatus = { docx: boolean; pdf: boolean } | null;

export default function UserGuide() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [status, setStatus] = useState<FileStatus>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    setChecking(true);
    fetch(`${API}/downloads/user-guide/status`)
      .then((res) => res.json())
      .then((data: FileStatus) => setStatus(data))
      .catch(() => setStatus({ docx: false, pdf: false }))
      .finally(() => setChecking(false));
  }, [user]);

  const anyAvailable = status && (status.pdf || status.docx);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("nav.guide")}</h1>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>{t("guide.downloadTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("guide.downloadDesc")}
            </p>
            {checking ? (
              <p className="text-sm text-muted-foreground">{t("guide.checking")}</p>
            ) : anyAvailable ? (
              <div className={`flex gap-3 flex-wrap ${lang === "ar" ? "flex-row-reverse justify-end" : ""}`}>
                {status?.pdf && (
                  <Button asChild variant="default">
                    <a href={`${API}/downloads/user-guide.pdf`} download>
                      {t("guide.downloadPdf")}
                    </a>
                  </Button>
                )}
                {status?.docx && (
                  <Button asChild variant="outline">
                    <a href={`${API}/downloads/user-guide.docx`} download>
                      {t("guide.downloadWord")}
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-600">{t("guide.filesNotReady")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {lang === "ar"
              ? "دليل المستخدم الشامل – منظومة تتبع الحمل عالي الخطورة"
              : "Comprehensive User Guide – High-Risk Pregnancy Tracker"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {lang === "ar"
              ? "يغطي هذا الدليل جميع وظائف المنظومة: تسجيل المرضى، إدارة الحالات، المواعيد، التنبيهات، التقارير، وإدارة المستخدمين. اضغط على أي قسم في الفهرس للانتقال إليه."
              : "This guide covers all system functions: patient registration, case management, appointments, alerts, reports, and user administration. Click any section in the TOC to jump to it."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {lang === "ar" ? "فهرس المحتويات" : "Table of Contents"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-none">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollTo(section.id)}
                  className="font-semibold text-base text-primary hover:underline text-start w-full"
                >
                  {lang === "ar" ? section.ar : section.en}
                </button>
                <ul className="space-y-0.5 ps-5 mt-1">
                  {section.subsections.map((sub, idx) => (
                    <li key={idx}>
                      <button
                        onClick={() => scrollTo(`${section.id}-${idx}`)}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline text-start"
                      >
                        {lang === "ar" ? sub.ar : sub.en}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.id} id={section.id} className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-lg">
              {lang === "ar" ? section.ar : section.en}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.subsections.map((sub, idx) => (
              <div key={idx} id={`${section.id}-${idx}`} className="scroll-mt-4">
                <h3 className="font-semibold text-sm mb-1">
                  {lang === "ar" ? sub.ar : sub.en}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? sub.content.ar : sub.content.en}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
