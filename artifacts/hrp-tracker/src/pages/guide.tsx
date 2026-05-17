import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronUp, List, Loader2, Printer } from "lucide-react";
import { type TranslationKey } from "@/i18n";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

const GUIDE_DURATION_KEY = "guideExpectedDuration";
const FALLBACK_DURATION_S = 20;
const GUIDE_BC_CHANNEL = "hrp-guide-generation";
const GUIDE_LS_SIGNAL_KEY = "hrp-guide-generation-signal";

function getExpectedDuration(): number {
  try {
    const stored = localStorage.getItem(GUIDE_DURATION_KEY);
    if (stored) {
      const n = Number(stored);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  return FALLBACK_DURATION_S;
}

type FileStatus = { docx: boolean; pdf: boolean; docxMtime?: string | null; pdfMtime?: string | null; generating?: boolean } | null;

// ─── Bilingual cell and row types ─────────────────────────────────────────────
type BiStr = string | { ar: string; en: string };
function cell(ar: string, en: string): BiStr { return { ar, en }; }
function resolveCell(c: BiStr, lang: string): string {
  if (typeof c === "string") return c;
  return lang === "ar" ? c.ar : c.en;
}
// ─── Rich content block types ────────────────────────────────────────────────
type ContentBlock =
  | { type: "para"; ar: string; en: string }
  | { type: "bullets"; items: { ar: string; en: string }[] }
  | { type: "note"; variant: "info" | "warning" | "tip"; ar: string; en: string }
  | { type: "table"; headerAr?: string; headerEn?: string; rows: [BiStr, BiStr][] }
  | { type: "table4"; headerAr?: string; headerEn?: string; colsAr: string[]; colsEn: string[]; rows: [BiStr, BiStr, BiStr, BiStr][] }
  | { type: "faq"; items: { qAr: string; qEn: string; aAr: string; aEn: string }[] }
  | { type: "heading3"; ar: string; en: string };

type SubSection = { ar: string; en: string; blocks: ContentBlock[] };
type Section = { id: string; ar: string; en: string; subsections: SubSection[] };

// ─── Content data ─────────────────────────────────────────────────────────────
const sections: Section[] = [
  {
    id: "s1",
    ar: "القسم الأول: نظرة عامة على المنظومة",
    en: "Section 1: System Overview",
    subsections: [
      {
        ar: "1.1 الهدف والغاية",
        en: "1.1 Purpose & Goals",
        blocks: [
          {
            type: "para",
            ar: "منظومة تتبع الحمل عالي الخطورة هي نظام إلكتروني متكامل يهدف إلى استبدال نموذج العمل القائم على ملفات Excel والنماذج الورقية (Microsoft Forms) بمنصة رقمية مركزية لإدارة ومتابعة حالات الحمل عالي الخطورة في تجمع جازان الصحي.",
            en: "The High-Risk Pregnancy Tracker is an integrated digital platform that replaces Excel-based and paper-based workflows (Microsoft Forms) with a centralised system for managing high-risk pregnancies across Jazan Health Cluster.",
          },
        ],
      },
      {
        ar: "1.2 الفوائد الرئيسية",
        en: "1.2 Key Benefits",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "تتبع آني لحالات الحمل عالي الخطورة عبر جميع المراكز الصحية والمستشفيات في المنطقة", en: "Real-time tracking of high-risk pregnancies across all health centers and hospitals in the region" },
              { ar: "تصنيف آلي لدرجة الخطورة وحساب مؤشر الالتزام بالمواعيد", en: "Automatic risk classification and appointment compliance calculation" },
              { ar: "تنبيهات فورية للحالات الحرجة التي تحتاج تدخلًا طارئًا", en: "Instant alerts for critical cases requiring urgent intervention" },
              { ar: "لوحة إحصاءات شاملة تعكس الأداء الصحي للقطاع", en: "Comprehensive KPI dashboard reflecting sector health performance" },
              { ar: "تصدير البيانات بصيغة CSV للتحليل والتقارير الدورية", en: "CSV data export for analysis and periodic reports" },
              { ar: "واجهة ثنائية اللغة (العربية / الإنجليزية) مع دعم اتجاه RTL", en: "Bilingual interface (Arabic/English) with full RTL support" },
            ],
          },
        ],
      },
      {
        ar: "1.3 الفئات المستهدفة والأدوار",
        en: "1.3 Target Users & Roles",
        blocks: [
          {
            type: "table",
            headerAr: "الأدوار والصلاحيات",
            headerEn: "Roles & Permissions",
            rows: [
              [cell("منسق الحوامل عالي الخطورة", "HRP Coordinator"), cell("الوصول الكامل: تسجيل المرضى، إدارة الحالات، المواعيد، التقارير", "Full access: patient registration, case management, appointments, reports")],
              [cell("الطبيب (Doctor)", "Doctor"), cell("إدارة الحالات السريرية، تسجيل الزيارات، تصدير البيانات", "Clinical case management, visit logging, data export")],
              [cell("المسؤول (Admin)", "Admin"), cell("كل الصلاحيات + إدارة المستخدمين والحسابات", "All permissions + user and account management")],
              [cell("المشاهد (Viewer)", "Viewer"), cell("قراءة البيانات فقط، بدون تعديل", "Read-only access, no modifications allowed")],
            ],
          },
        ],
      },
      {
        ar: "1.4 متطلبات التشغيل",
        en: "1.4 System Requirements",
        blocks: [
          {
            type: "table",
            rows: [
              [cell("المتصفح", "Browser"), cell("Chrome 110+ أو Edge 110+ أو Firefox 110+ (يُوصى بـ Chrome)", "Chrome 110+, Edge 110+, or Firefox 110+ (Chrome recommended)")],
              [cell("الجهاز", "Device"), cell("حاسب مكتبي أو لابتوب أو جهاز لوحي (الشاشة لا تقل عن 10 بوصة)", "Desktop, laptop, or tablet (screen ≥ 10 inches)")],
              [cell("الاتصال", "Connection"), cell("اتصال بإنترنت مستقر (الشبكة الداخلية للمنشأة مُفضَّلة)", "Stable internet connection (internal facility network preferred)")],
              [cell("التطبيق المحمول", "Mobile app"), cell("Android 8+ أو iOS 13+ عبر تطبيق Expo المرافق", "Android 8+ or iOS 13+ via the companion Expo app")],
            ],
          },
          {
            type: "note",
            variant: "tip",
            ar: "لا يلزم تثبيت أي برنامج على الجهاز للنسخة الإلكترونية؛ يكفي فتح الرابط في المتصفح.",
            en: "No software installation is needed for the web version — simply open the link in your browser.",
          },
        ],
      },
    ],
  },
  {
    id: "s2",
    ar: "القسم الثاني: تسجيل الدخول وإدارة الجلسة",
    en: "Section 2: Login & Session Management",
    subsections: [
      {
        ar: "2.1 شاشة تسجيل الدخول",
        en: "2.1 Login Screen",
        blocks: [
          {
            type: "para",
            ar: "عند فتح رابط المنظومة يظهر للمستخدم شاشة تسجيل الدخول الآمنة. تعرض الشاشة شعار تجمع جازان الصحي، واسم المنظومة، وحقلَي اسم المستخدم وكلمة المرور.",
            en: "Opening the system URL shows the secure login screen displaying the Jazan Health Cluster logo, the system name, and username/password fields.",
          },
        ],
      },
      {
        ar: "2.2 خطوات تسجيل الدخول",
        en: "2.2 Login Steps",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "أدخِل اسم المستخدم المُخصَّص لك في حقل «اسم المستخدم»", en: "Enter your assigned username in the username field" },
              { ar: "أدخِل كلمة المرور السرية في حقل «كلمة المرور»", en: "Enter your password in the password field" },
              { ar: "اضغط زر «تسجيل الدخول»", en: "Click the 'Login' button" },
              { ar: "في حال صحة البيانات، ستنتقل مباشرةً إلى لوحة المعلومات الرئيسية", en: "On success you are immediately redirected to the main dashboard" },
            ],
          },
          {
            type: "note",
            variant: "warning",
            ar: "إذا نسيت كلمة المرور، تواصل مع مسؤول المنظومة (Admin) لإعادة تعيينها.",
            en: "If you forget your password, contact the system administrator (Admin) to reset it.",
          },
        ],
      },
      {
        ar: "2.3 سياسة الجلسة والأمان",
        en: "2.3 Session & Security Policy",
        blocks: [
          {
            type: "table",
            rows: [
              [cell("مدة الجلسة", "Session duration"), cell("تبقى الجلسة نشطة ما دمت تتفاعل مع المنظومة", "Session stays active as long as you are interacting with the system")],
              [cell("انتهاء الجلسة", "Session expiry"), cell("تنتهي الجلسة تلقائيًا عند توقف النشاط لفترة طويلة", "Session expires automatically after a prolonged period of inactivity")],
              [cell("تسجيل الخروج", "Logout"), cell("اضغط على أيقونة المستخدم في أعلى الشريط الجانبي ثم «تسجيل الخروج»", "Click the user icon at the top of the sidebar then 'Logout'")],
              [cell("الأمان", "Security"), cell("جميع العمليات مُسجَّلة وفق نظام PDPL", "All operations are logged in compliance with the PDPL")],
            ],
          },
        ],
      },
      {
        ar: "2.4 تبديل اللغة",
        en: "2.4 Language Toggle",
        blocks: [
          {
            type: "para",
            ar: "يمكن التبديل بين العربية والإنجليزية من أيقونة اللغة الموجودة في أعلى الشريط الجانبي. تُحفَظ تفضيلات اللغة تلقائيًا في المتصفح.",
            en: "Switch between Arabic and English using the language icon at the top of the sidebar. The preference is saved automatically in the browser.",
          },
        ],
      },
    ],
  },
  {
    id: "s3",
    ar: "القسم الثالث: لوحة المعلومات",
    en: "Section 3: Dashboard",
    subsections: [
      {
        ar: "نظرة عامة",
        en: "Overview",
        blocks: [
          {
            type: "para",
            ar: "لوحة المعلومات هي الصفحة الرئيسية التي تعرض فور تسجيل الدخول. تُلخِّص الوضع الصحي الحالي لجميع حالات الحمل عالي الخطورة في المنطقة من خلال بطاقات إحصائية ومخططات بيانية.",
            en: "The dashboard is the home page shown immediately after login. It summarises the current health status of all high-risk pregnancy cases in the region through KPI cards and charts.",
          },
        ],
      },
      {
        ar: "3.1 البطاقات الإحصائية الأربع",
        en: "3.1 Four KPI Cards",
        blocks: [
          {
            type: "table",
            headerAr: "البطاقات الإحصائية ومعانيها",
            headerEn: "KPI Cards & Their Meanings",
            rows: [
              [cell("إجمالي المرضى", "Total patients"), cell("عدد جميع الحوامل المسجلات في المنظومة", "Total number of all registered pregnant patients in the system")],
              [cell("إجمالي الحالات", "Total cases"), cell("عدد حالات الحمل المُسجَّلة (قد تتعدد الحالات للمريضة الواحدة)", "Number of registered pregnancy cases (a single patient may have multiple cases)")],
              [cell("الحالات الحرجة", "Critical cases"), cell("عدد الحالات ذات مستوى الخطورة «حرج»، مع عرض عدد من ليس لديها موعد", "Count of 'critical'-level cases, showing how many have no appointment booked")],
              [cell("نسبة الالتزام بالمواعيد", "Booking compliance rate"), cell("نسبة الحالات التي حجزت موعدًا خلال يومَي عمل من تاريخ الزيارة", "Percentage of cases with an appointment booked within 2 working days of the visit date")],
            ],
          },
        ],
      },
      {
        ar: "3.2 المخططات البيانية",
        en: "3.2 Charts",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "مخطط دائري: يوضح توزيع الحالات حسب مستوى الخطورة الأربعة — منخفض (أخضر)، متوسط (أصفر)، عالٍ (برتقالي)، حرج (أحمر)", en: "Pie chart: shows case distribution by risk level — low (green), medium (yellow), high (orange), critical (red)" },
              { ar: "مخطط أعمدة الالتزام: يعرض عدد الحالات الملتزمة (أخضر)، غير الملتزمة (أحمر)، والمعلقة (رمادي) انتظارًا لموعد", en: "Compliance bar chart: displays compliant (green), non-compliant (red), and pending (grey) case counts" },
              { ar: "توزيع القطاعات: يعرض عدد الحالات لكل قطاع", en: "Sector distribution: shows case counts by sector" },
              { ar: "حضور المستشفيات: نسبة الحضور لكل مستشفى", en: "Hospital attendance: attendance rate per hospital" },
            ],
          },
        ],
      },
      {
        ar: "3.3 شريط التنبيه العاجل",
        en: "3.3 Urgent Alert Banner",
        blocks: [
          {
            type: "para",
            ar: "يظهر شريط تنبيه برتقالي في أعلى الصفحة عندما يتجاوز عدد المواعيد المنقضية غير المُسجَّل حضورها حدَّ الإنذار (الافتراضي: 5 مواعيد). يمكن الضغط على «عرض المواعيد» للانتقال مباشرةً لقائمة الحالات التي تحتاج متابعة.",
            en: "An orange alert banner appears at the top of the page when the number of overdue unattended appointments exceeds the configured threshold (default: 5). Click 'View Appointments' to go directly to cases needing follow-up.",
          },
          {
            type: "note",
            variant: "info",
            ar: "حدّ الإنذار قابل للتخصيص من صفحة الإعدادات من قِبَل المسؤول أو المنسق.",
            en: "The alert threshold can be customised from the Settings page by the administrator or coordinator.",
          },
        ],
      },
    ],
  },
  {
    id: "s4",
    ar: "القسم الرابع: إدارة المرضى",
    en: "Section 4: Patient Management",
    subsections: [
      {
        ar: "4.1 قائمة المرضى والبحث",
        en: "4.1 Patient List & Search",
        blocks: [
          {
            type: "para",
            ar: "تعرض صفحة «المرضى» قائمةً كاملةً بجميع الحوامل المُسجَّلات. تشمل كل بطاقة: الاسم، رقم الهوية الوطنية، رقم الجوال، المركز الصحي، والقطاع.",
            en: "The Patients page shows a complete list of all registered patients. Each card includes: name, national ID, phone number, health center, and sector.",
          },
          {
            type: "table",
            headerAr: "خيارات البحث والتصفية",
            headerEn: "Search & Filter Options",
            rows: [
              [cell("البحث النصي", "Text search"), cell("البحث باسم المريضة أو رقم هويتها في حقل البحث", "Search by patient name or national ID in the search field")],
              [cell("تصفية بالمستشفى", "Filter by hospital"), cell("اختر مستشفى لعرض مريضات مرتبطات بقطاعاته", "Select a hospital to see patients linked to its sectors")],
              [cell("تصفية بالقطاع", "Filter by sector"), cell("تصفية تبعية للمستشفى المختار", "Cascading filter dependent on the selected hospital")],
              [cell("تصفية بالمركز الصحي", "Filter by health center"), cell("تصفية تبعية للقطاع المختار", "Cascading filter dependent on the selected sector")],
              [cell("إزالة الفلاتر", "Clear filters"), cell("زر «مسح الفلاتر» يُعيد عرض جميع المرضى", "'Clear filters' button restores the full patient list")],
            ],
          },
        ],
      },
      {
        ar: "4.2 تسجيل مريضة جديدة",
        en: "4.2 Register New Patient",
        blocks: [
          {
            type: "para",
            ar: "اضغط زر «تسجيل مريضة جديدة» (الأخضر) في أعلى يمين الصفحة للانتقال إلى نموذج التسجيل.",
            en: "Click the green 'Register New Patient' button at the top right of the page to open the registration form.",
          },
          {
            type: "heading3",
            ar: "الحقول المطلوبة (*)",
            en: "Required Fields (*)",
          },
          {
            type: "table",
            rows: [
              [cell("رقم الهوية الوطنية (*)", "National ID (*)"), cell("10 أرقام فقط – لا يمكن تكراره في المنظومة", "10 digits only — must be unique in the system")],
              [cell("الاسم بالعربية (*)", "Name in Arabic (*)"), cell("الاسم الكامل", "Full name")],
              [cell("رقم الجوال (*)", "Phone number (*)"), cell("بصيغة 05XXXXXXXX", "Format: 05XXXXXXXX")],
              [cell("القطاع (*)", "Sector (*)"), cell("اختر من القائمة المنسدلة", "Select from the dropdown list")],
              [cell("المركز الصحي (*)", "Health center (*)"), cell("يظهر بعد اختيار القطاع – اختر المركز المناسب", "Appears after selecting a sector — choose the appropriate center")],
            ],
          },
          {
            type: "heading3",
            ar: "الحقول الاختيارية",
            en: "Optional Fields",
          },
          {
            type: "table",
            rows: [
              [cell("تاريخ الميلاد", "Date of birth"), cell("يُحسَب العمر تلقائيًا من هذا التاريخ", "Age is computed automatically from this date")],
              [cell("جوال الطبيب", "Doctor's phone"), cell("رقم تواصل الطبيب المسؤول", "Contact number of the responsible doctor")],
              [cell("العنوان", "Address"), cell("عنوان السكن", "Residential address")],
            ],
          },
          {
            type: "note",
            variant: "tip",
            ar: "بعد حفظ البيانات، تنتقل مباشرةً إلى ملف المريضة حيث يمكنك إضافة حالة حمل جديدة.",
            en: "After saving, you are taken directly to the patient file where you can add a new pregnancy case.",
          },
        ],
      },
      {
        ar: "4.3 ملف المريضة التفصيلي",
        en: "4.3 Patient Detail File",
        blocks: [
          {
            type: "para",
            ar: "اضغط على اسم المريضة في القائمة للانتقال إلى ملفها الكامل. يعرض الملف:",
            en: "Click the patient's name in the list to open her full file. The file shows:",
          },
          {
            type: "bullets",
            items: [
              { ar: "بيانات المريضة الشخصية مع إمكانية التعديل بالضغط على «تعديل»", en: "Patient personal details with an 'Edit' button to update them" },
              { ar: "قائمة جميع حالات الحمل المُسجَّلة لها مع مستوى الخطورة وحالة الالتزام", en: "List of all her registered pregnancy cases with risk level and compliance status" },
              { ar: "زر «إضافة حالة حمل جديدة»", en: "An 'Add New Pregnancy Case' button" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "s5",
    ar: "القسم الخامس: إدارة حالات الحمل",
    en: "Section 5: Pregnancy Case Management",
    subsections: [
      {
        ar: "5.1 إضافة حالة حمل جديدة",
        en: "5.1 Register a New Pregnancy Case",
        blocks: [
          {
            type: "para",
            ar: "يمكن إضافة حالة حمل جديدة بطريقتين: من ملف المريضة مباشرةً بالضغط «إضافة حالة حمل»، أو من قائمة «الحالات» ثم «حالة جديدة». في كلتا الحالتين يظهر نموذج البحث عن المريضة أولًا (برقم الهوية الوطنية).",
            en: "A new pregnancy case can be added in two ways: from the patient file by clicking 'Add Pregnancy Case', or from the Cases list then 'New Case'. Either way, a patient search form (by national ID) appears first.",
          },
        ],
      },
      {
        ar: "5.2 مستويات تصنيف الخطورة",
        en: "5.2 Risk Classification Levels",
        blocks: [
          {
            type: "table",
            headerAr: "مستويات الخطورة ومعاييرها",
            headerEn: "Risk Levels & Criteria",
            rows: [
              [cell("منخفض (Low)", "Low"), cell("لا توجد عوامل خطر مؤثرة – متابعة روتينية في المركز الصحي", "No significant risk factors — routine follow-up at the health center")],
              [cell("متوسط (Medium)", "Medium"), cell("عوامل خطر محدودة – متابعة مكثفة في المركز الصحي", "Limited risk factors — intensive follow-up at the health center")],
              [cell("عالٍ (High)", "High"), cell("عوامل خطر متعددة أو حادة – إحالة للمستشفى", "Multiple or severe risk factors — referral to hospital")],
              [cell("حرج (Critical)", "Critical"), cell("حالة طارئة تستدعي تدخلًا فوريًا – إحالة لـ KFCH أو أقرب مستشفى", "Emergency case requiring immediate intervention — transfer to KFCH or nearest hospital")],
            ],
          },
        ],
      },
      {
        ar: "5.3 عوامل الخطر",
        en: "5.3 Risk Factors",
        blocks: [
          {
            type: "heading3",
            ar: "المجموعة الأولى – عوامل سابقة للحمل",
            en: "Group 1 – Pre-existing factors",
          },
          {
            type: "bullets",
            items: [
              { ar: "تعدد الأجنة", en: "Multiple gestation" },
              { ar: "عمر الأم فوق 40 أو أقل من 16", en: "Maternal age >40 or <16" },
              { ar: "BMI 35 أو أكثر", en: "BMI ≥ 35" },
              { ar: "حمل IVF أو تدخين", en: "IVF pregnancy or smoking" },
              { ar: "نتائج فحص الفصل الأول إيجابية", en: "Positive first-trimester screening results" },
              { ar: "3 إجهاضات أو أكثر، ولادة مبكرة سابقة، وفاة جنينية سابقة", en: "3 or more miscarriages, prior preterm birth, prior fetal death" },
              { ar: "عملية قيصرية سابقة، سوابق تسمم الحمل، جلطات وريدية سابقة", en: "Prior C-section, history of pre-eclampsia, prior VTE" },
              { ar: "سابقة إصابة بنزيف ما بعد الولادة", en: "Prior postpartum haemorrhage" },
            ],
          },
          {
            type: "heading3",
            ar: "المجموعة الثانية – مضاعفات الحمل الحالي",
            en: "Group 2 – Current pregnancy complications",
          },
          {
            type: "bullets",
            items: [
              { ar: "ارتفاع ضغط الدم الحملي", en: "Gestational hypertension" },
              { ar: "تسمم الحمل / الإرعاش", en: "Pre-eclampsia / eclampsia" },
              { ar: "داء السكري الحملي", en: "Gestational diabetes" },
              { ar: "انفصال المشيمة، المشيمة المنزاحة", en: "Placental abruption, placenta praevia" },
              { ar: "تأخر النمو داخل الرحم (IUGR)", en: "Intrauterine growth restriction (IUGR)" },
              { ar: "نقص أو زيادة السائل الأمنيوسي", en: "Oligo- or polyhydramnios" },
              { ar: "تمزق الأغشية المبكر (PPROM)، نزيف ما قبل الولادة", en: "Preterm prelabour rupture of membranes (PPROM), antepartum haemorrhage" },
              { ar: "هيموغلوبين منخفض (Hb < 9)", en: "Low haemoglobin (Hb < 9)" },
            ],
          },
          {
            type: "heading3",
            ar: "المجموعة الثالثة – الأمراض المزمنة",
            en: "Group 3 – Chronic conditions",
          },
          {
            type: "bullets",
            items: [
              { ar: "داء السكري النوع الأول أو الثاني، ارتفاع ضغط الدم المزمن", en: "Type 1 or Type 2 diabetes, chronic hypertension" },
              { ar: "أمراض القلب، الكلى، الغدة الدرقية، الكبد", en: "Heart, kidney, thyroid, or liver disease" },
              { ar: "الصرع، الأمراض المناعية الذاتية، الربو الشديد", en: "Epilepsy, autoimmune diseases, severe asthma" },
              { ar: "الاكتئاب والاضطرابات النفسية", en: "Depression and psychiatric disorders" },
              { ar: "فقر الدم المنجلي أو الثلاسيميا، السرطان", en: "Sickle cell anaemia or thalassaemia, cancer" },
            ],
          },
        ],
      },
      {
        ar: "5.4 الحقول السريرية في نموذج الحمل",
        en: "5.4 Clinical Fields in the Pregnancy Form",
        blocks: [
          {
            type: "table",
            headerAr: "الحقول السريرية",
            headerEn: "Clinical Fields",
            rows: [
              [cell("تاريخ الزيارة (*)", "Visit date (*)"), cell("تاريخ الفحص السريري الأول – يُحسَب الالتزام انطلاقًا منه", "Date of first clinical examination — compliance is calculated from this date")],
              [cell("تاريخ آخر دورة شهرية (LMP)", "Last menstrual period (LMP)"), cell("اختياري – يُستخدم لحساب عمر الحمل", "Optional — used to calculate gestational age")],
              [cell("عمر الحمل (أسابيع)", "Gestational age (weeks)"), cell("اختياري – بالأسابيع", "Optional — in weeks")],
              [cell("درجة الخطورة (*)", "Risk level (*)"), cell("اختر من: منخفض / متوسط / عالٍ / حرج", "Select from: Low / Medium / High / Critical")],
              [cell("اسم الطبيب", "Doctor name"), cell("اختياري", "Optional")],
              [cell("VTE عالي الخطورة", "High-risk VTE"), cell("مربع اختيار – للحالات ذات خطر التجلط الوريدي", "Checkbox — for cases with venous thromboembolism risk")],
              [cell("Enoxaparin موصوف", "Enoxaparin prescribed"), cell("مربع اختيار – هل وُصف دواء إنوكساباريين؟", "Checkbox — has Enoxaparin been prescribed?")],
              [cell("توصية الإحالة (*)", "Referral recommendation (*)"), cell("متابعة في المركز / في المستشفى / تحويل لـ KFCH", "Follow-up at center / at hospital / transfer to KFCH")],
              [cell("المستشفى المُحوَّل إليه", "Referral hospital"), cell("اختياري عند الإحالة", "Optional — complete when a referral is made")],
              [cell("تاريخ موعد المستشفى", "Hospital appointment date"), cell("تاريخ الموعد المحجوز في المستشفى", "The booked hospital appointment date")],
              [cell("الأدوية", "Medications"), cell("اذكر الأدوية الموصوفة إن وُجدت", "List any prescribed medications")],
              [cell("ملاحظات عامة", "General notes"), cell("أي ملاحظات سريرية إضافية", "Any additional clinical notes")],
              [cell("ملاحظات المتابعة والتواصل", "Follow-up & contact notes"), cell("سجّل هنا ردود المريضة على التواصل", "Record patient responses to follow-up contact here")],
            ],
          },
        ],
      },
      {
        ar: "5.5 حساب مؤشر الالتزام بالمواعيد",
        en: "5.5 Appointment Compliance Indicator",
        blocks: [
          {
            type: "para",
            ar: "تحسب المنظومة تلقائيًا مؤشر الالتزام بناءً على الفرق بين تاريخ الزيارة وتاريخ الموعد المحجوز، مع استثناء أيام الجمعة والسبت (عطلة نهاية الأسبوع السعودية).",
            en: "The system automatically calculates the compliance indicator based on the difference between the visit date and the booked appointment date, excluding Fridays and Saturdays (Saudi weekend).",
          },
          {
            type: "table",
            headerAr: "قيم مؤشر الالتزام",
            headerEn: "Compliance Indicator Values",
            rows: [
              [cell("ملتزم ✅", "Compliant ✅"), cell("تم حجز الموعد في غضون يومَي عمل أو أقل من تاريخ الزيارة", "Appointment booked within 2 working days or fewer from the visit date")],
              [cell("غير ملتزم ❌", "Non-compliant ❌"), cell("تم حجز الموعد بعد أكثر من يومَي عمل من تاريخ الزيارة", "Appointment booked more than 2 working days after the visit date")],
              [cell("بانتظار موعد ⏳", "Pending ⏳"), cell("لم يُحجز أي موعد بعد", "No appointment has been booked yet")],
            ],
          },
        ],
      },
      {
        ar: "5.6 تصدير ملف المريضة بصيغة PDF",
        en: "5.6 Export Patient File as PDF",
        blocks: [
          {
            type: "para",
            ar: "من صفحة تفاصيل الحالة، اضغط زر «تصدير PDF» لفتح نافذة طباعة تحتوي على الملف الكامل للمريضة: البيانات الشخصية، المعلومات السريرية، عوامل الخطر، الأدوية، المواعيد. يمكن طباعته أو حفظه بصيغة PDF.",
            en: "From the case detail page, click 'Export PDF' to open a print window containing the patient's full file: personal data, clinical information, risk factors, medications, and appointments. You can print it or save as PDF.",
          },
        ],
      },
    ],
  },
  {
    id: "s6",
    ar: "القسم السادس: المواعيد",
    en: "Section 6: Appointments",
    subsections: [
      {
        ar: "نظرة عامة",
        en: "Overview",
        blocks: [
          {
            type: "para",
            ar: "صفحة المواعيد هي المحور الرئيسي لمتابعة حضور الحوامل في المستشفيات. تعرض جميع المواعيد المحجوزة مع إمكانية التصفية والبحث وتسجيل الحضور والتصدير.",
            en: "The Appointments page is the main hub for tracking patient hospital attendance. It shows all booked appointments with filtering, search, attendance logging, and export options.",
          },
        ],
      },
      {
        ar: "6.1 خيارات التصفية",
        en: "6.1 Filter Options",
        blocks: [
          {
            type: "table",
            headerAr: "خيارات التصفية المتاحة",
            headerEn: "Available Filter Options",
            rows: [
              [cell("تصفية بالتاريخ", "Date filter"), cell("اليوم / هذا الأسبوع / كل المواعيد / نطاق مخصص", "Today / This week / All appointments / Custom range")],
              [cell("تصفية بالحالة", "Status filter"), cell("كل المواعيد / مجدول ⏳ / حضر ✅ / غائب ❌ / تحتاج متابعة", "All / Scheduled ⏳ / Attended ✅ / Absent ❌ / Needs follow-up")],
              [cell("تصفية بالقطاع", "Sector filter"), cell("اختر قطاعًا لعرض مواعيد قطاع محدد", "Select a sector to show only appointments from that sector")],
              [cell("تصفية بمستوى الخطورة", "Risk level filter"), cell("حرج / عالٍ / متوسط / منخفض", "Critical / High / Medium / Low")],
            ],
          },
          {
            type: "note",
            variant: "warning",
            ar: "فلتر «تحتاج متابعة» يعرض المواعيد المنقضية التي لم يُسجَّل فيها حضور أو غياب – هذه هي الأولوية القصوى.",
            en: "'Needs follow-up' filter shows overdue appointments with no attendance logged — these are the highest priority.",
          },
        ],
      },
      {
        ar: "6.2 تسجيل الحضور",
        en: "6.2 Attendance Logging",
        blocks: [
          {
            type: "para",
            ar: "لتسجيل حضور مريضة أو غيابها، ابحث عنها في القائمة ثم:",
            en: "To log a patient's attendance or absence, find her in the list then:",
          },
          {
            type: "bullets",
            items: [
              { ar: "اضغط أيقونة ✅ لتسجيل الحضور، أو ❌ لتسجيل الغياب", en: "Click ✅ to log attendance, or ❌ to log absence" },
              { ar: "تظهر نافذة تأكيد تتيح لك إضافة ملاحظة حضور (مثل: «حضرت متأخرة» أو «اعتذرت لظرف طارئ»)", en: "A confirmation dialog appears where you can add an attendance note (e.g., 'Arrived late' or 'Excused for emergency')" },
              { ar: "اضغط «حفظ» لتثبيت حالة الحضور", en: "Click 'Save' to confirm the attendance status" },
            ],
          },
        ],
      },
      {
        ar: "6.3 الإحصاءات الآنية",
        en: "6.3 Live Statistics",
        blocks: [
          {
            type: "para",
            ar: "يعرض أعلى الصفحة ثلاث بطاقات إحصائية تُحدَّث فور تطبيق أي فلتر:",
            en: "Three statistics cards at the top of the page update immediately when any filter is applied:",
          },
          {
            type: "bullets",
            items: [
              { ar: "عدد المواعيد المجدولة ⏳", en: "Number of scheduled appointments ⏳" },
              { ar: "عدد من حضروا ✅", en: "Number who attended ✅" },
              { ar: "عدد الغائبين ❌", en: "Number of absences ❌" },
            ],
          },
        ],
      },
      {
        ar: "6.4 تصدير وطباعة",
        en: "6.4 Export & Print",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "زر «تصدير CSV»: يُنزِّل جميع المواعيد المعروضة حاليًا (بعد تطبيق الفلاتر) في ملف CSV يشمل: اسم المريضة، الهوية، القطاع، المستشفى، التاريخ، الحالة، الملاحظة", en: "CSV Export button: downloads all currently shown appointments (after filters) as a CSV file with: patient name, ID, sector, hospital, date, status, note" },
              { ar: "زر «طباعة»: يفتح نافذة طباعة جاهزة تعرض جدول المواعيد مع ملخص الفلاتر المطبقة وتاريخ الطباعة", en: "Print button: opens a print-ready window showing the appointments table with applied filter summary and print date" },
            ],
          },
          {
            type: "note",
            variant: "tip",
            ar: "يُنصح بفتح ملف CSV في Excel باستخدام ترميز UTF-8 للحصول على النص العربي بشكل صحيح.",
            en: "Open CSV files in Excel using UTF-8 encoding to display Arabic text correctly.",
          },
        ],
      },
    ],
  },
  {
    id: "s7",
    ar: "القسم السابع: التنبيهات السريرية",
    en: "Section 7: Clinical Alerts",
    subsections: [
      {
        ar: "نظرة عامة",
        en: "Overview",
        blocks: [
          {
            type: "para",
            ar: "صفحة التنبيهات تعرض الحالات التي تستوجب تدخلًا عاجلًا. تُحسَب التنبيهات تلقائيًا في كل طلب دون الحاجة لجدولة وظائف مستقلة.",
            en: "The Alerts page shows cases requiring urgent action. Alerts are computed automatically on every request with no need for scheduled background jobs.",
          },
        ],
      },
      {
        ar: "7.1 أنواع التنبيهات",
        en: "7.1 Alert Types",
        blocks: [
          {
            type: "table",
            headerAr: "أنواع التنبيهات",
            headerEn: "Alert Types",
            rows: [
              [cell("VTE بدون إنوكساباريين", "VTE without Enoxaparin"), cell("حالة مصنفة كـ VTE عالي الخطورة لكن لم يُوصَف لها إنوكساباريين", "Case classified as high-risk VTE without Enoxaparin being prescribed")],
              [cell("حرج بدون موعد", "Critical without appointment"), cell("حالة بمستوى «حرج» ليس لها أي موعد مستشفى مسجّل", "A 'critical'-level case with no hospital appointment recorded")],
              [cell("موعد فائت", "Missed appointment"), cell("موعد انقضى تاريخه دون تسجيل حضور أو غياب", "An appointment whose date has passed with no attendance logged")],
              [cell("متأخر حرج", "Overdue critical"), cell("حالة حرجة بموعد منقضٍ لم يُعالج", "A critical case with an overdue appointment that has not been actioned")],
            ],
          },
        ],
      },
      {
        ar: "7.2 كيفية معالجة التنبيه",
        en: "7.2 Acting on Alerts",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "اضغط على اسم المريضة في التنبيه للانتقال مباشرةً إلى ملف حالتها", en: "Click the patient name in the alert to navigate directly to her case file" },
              { ar: "راجع البيانات السريرية وأكمل المعلومات الناقصة (موعد، دواء، ملاحظة)", en: "Review the clinical data and complete any missing information (appointment, medication, note)" },
              { ar: "بعد تحديث الحالة سيختفي التنبيه تلقائيًا عند تحديث الصفحة", en: "After updating the case, the alert disappears automatically on page refresh" },
            ],
          },
          {
            type: "note",
            variant: "tip",
            ar: "إذا كانت صفحة التنبيهات فارغة، فهذا يعني أن كل الحالات مستوفية المتطلبات – وهو الهدف المثالي.",
            en: "If the Alerts page is empty, all cases are fully compliant — this is the ideal state.",
          },
        ],
      },
    ],
  },
  {
    id: "s8",
    ar: "القسم الثامن: التقارير وتصدير البيانات",
    en: "Section 8: Reports & Data Export",
    subsections: [
      {
        ar: "نظرة عامة",
        en: "Overview",
        blocks: [
          {
            type: "para",
            ar: "صفحة التقارير توفر أدوات تصدير بيانات المنظومة بصيغة CSV (متوافقة مع Excel) وطباعة/حفظ كـ PDF، لاستخدامها في التحليل والتقارير الدورية.",
            en: "The Reports page provides tools to export system data as CSV (Excel-compatible) and print/save as PDF, for use in analysis and periodic reporting.",
          },
        ],
      },
      {
        ar: "8.1 تقرير بيانات المرضى (CSV)",
        en: "8.1 Patients Data Report (CSV)",
        blocks: [
          {
            type: "para",
            ar: "اضغط «تنزيل» في بطاقة «بيانات المرضى» للحصول على ملف CSV يحتوي على:",
            en: "Click 'Download' in the Patients Data card to get a CSV file containing:",
          },
          {
            type: "bullets",
            items: [
              { ar: "الاسم بالعربية والإنجليزية", en: "Name in Arabic and English" },
              { ar: "رقم الهوية الوطنية", en: "National ID number" },
              { ar: "رقم الجوال، تاريخ الميلاد، العمر", en: "Phone number, date of birth, age" },
              { ar: "المركز الصحي والقطاع والمستشفى", en: "Health center, sector, and hospital" },
            ],
          },
        ],
      },
      {
        ar: "8.2 تقرير حالات الحمل (CSV)",
        en: "8.2 Pregnancy Cases Report (CSV)",
        blocks: [
          {
            type: "para",
            ar: "اضغط «تنزيل» في بطاقة «حالات الحمل» للحصول على ملف CSV يحتوي على:",
            en: "Click 'Download' in the Pregnancy Cases card to get a CSV file containing:",
          },
          {
            type: "bullets",
            items: [
              { ar: "بيانات المريضة المرتبطة", en: "Associated patient details" },
              { ar: "تاريخ الزيارة، عمر الحمل، درجة الخطورة", en: "Visit date, gestational age, risk level" },
              { ar: "مستوى الالتزام، توصية الإحالة", en: "Compliance level, referral recommendation" },
              { ar: "VTE، Enoxaparin، الأدوية، المستشفى المُحوَّل إليه وتاريخ الموعد", en: "VTE, Enoxaparin, medications, referral hospital and appointment date" },
            ],
          },
        ],
      },
      {
        ar: "8.3 ملاحظات تقنية للتصدير",
        en: "8.3 Technical Export Notes",
        blocks: [
          {
            type: "note",
            variant: "info",
            ar: "ملفات CSV مُشفَّرة بـ UTF-8 مع BOM لضمان ظهور النص العربي بشكل صحيح في Excel. عند فتح الملف في Excel اختر «استيراد بيانات» وحدد ترميز UTF-8 إذا طُلب منك ذلك.",
            en: "CSV files are encoded as UTF-8 with BOM to ensure Arabic text displays correctly in Excel. When opening in Excel, choose 'Import Data' and select UTF-8 encoding if prompted.",
          },
          {
            type: "note",
            variant: "tip",
            ar: "لحفظ PDF: افتح نافذة الطباعة (Ctrl+P أو ⌘+P) ← اختر «Microsoft Print to PDF» أو «حفظ كـ PDF» ← اضبط الحجم A4 ← «حفظ».",
            en: "To save as PDF: open the print dialog (Ctrl+P or ⌘+P) → select 'Microsoft Print to PDF' or 'Save as PDF' → set A4 size → 'Save'.",
          },
        ],
      },
    ],
  },
  {
    id: "s9",
    ar: "القسم التاسع: إدارة المستخدمين",
    en: "Section 9: User Administration",
    subsections: [
      {
        ar: "9.1 الوصول لصفحة إدارة المستخدمين",
        en: "9.1 Accessing User Management",
        blocks: [
          {
            type: "para",
            ar: "يمكن للمسؤول (Admin) فقط الوصول إلى صفحة «إدارة المستخدمين» من الشريط الجانبي.",
            en: "Only the Admin role can access the User Management page from the sidebar.",
          },
        ],
      },
      {
        ar: "9.2 إضافة مستخدم جديد",
        en: "9.2 Add New User",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "اضغط «إضافة مستخدم» في أعلى الصفحة", en: "Click 'Add User' at the top of the page" },
              { ar: "أدخِل اسم المستخدم وكلمة المرور", en: "Enter the username and password" },
              { ar: "أدخِل الاسم بالعربية (والإنجليزية اختياريًا)", en: "Enter the name in Arabic (and English, optionally)" },
              { ar: "حدد الدور: مدير / منسق / طبيب / عارض", en: "Select the role: Admin / Coordinator / Doctor / Viewer" },
              { ar: "اضغط «إنشاء الحساب»", en: "Click 'Create Account'" },
            ],
          },
        ],
      },
      {
        ar: "9.3 تعديل وتعطيل المستخدمين",
        en: "9.3 Edit & Deactivate Users",
        blocks: [
          {
            type: "bullets",
            items: [
              { ar: "تغيير الدور: اضغط أيقونة القلم بجانب المستخدم، اختر الدور الجديد، ثم «حفظ»", en: "Change role: click the pencil icon next to the user, select the new role, then 'Save'" },
              { ar: "إيقاف الحساب مؤقتًا: اضغط أيقونة ✓ الخضراء لتحويلها إلى ✗ (الحساب يصبح موقوفًا)", en: "Deactivate account: click the green ✓ icon to turn it into ✗ (account becomes inactive)" },
              { ar: "تفعيل الحساب: اضغط أيقونة ✗ الحمراء لإعادة تفعيله", en: "Reactivate account: click the red ✗ icon to reactivate it" },
            ],
          },
          {
            type: "note",
            variant: "warning",
            ar: "لا يمكن حذف حساب نهائيًا من الواجهة – الإيقاف هو الخيار الأنسب للحسابات غير الفعّالة.",
            en: "Accounts cannot be permanently deleted from the UI — deactivation is the correct approach for inactive accounts.",
          },
        ],
      },
    ],
  },
  {
    id: "s10",
    ar: "القسم العاشر: الأمان والخصوصية",
    en: "Section 10: Security & Privacy",
    subsections: [
      {
        ar: "10.1 سجل العمليات (Audit Log)",
        en: "10.1 Audit Log",
        blocks: [
          {
            type: "para",
            ar: "يسجِّل النظام جميع عمليات تسجيل الدخول، الإضافة، التعديل، والحذف مع بيانات المستخدم والتوقيت الدقيق وفق متطلبات نظام حماية البيانات الشخصية (PDPL).",
            en: "The system logs all login, create, update, and delete operations with user details and exact timestamps, complying with Saudi Arabia's Personal Data Protection Law (PDPL).",
          },
        ],
      },
      {
        ar: "10.2 الامتثال لنظام PDPL",
        en: "10.2 PDPL Compliance",
        blocks: [
          {
            type: "para",
            ar: "جميع البيانات سرية ومخصصة للاستخدام الداخلي. يُحظر نشرها أو توزيعها خارج نطاق المنظومة وفق نظام حماية البيانات الشخصية السعودي.",
            en: "All data is confidential and for internal use only. Sharing or distributing it outside the system is prohibited under Saudi Arabia's PDPL.",
          },
        ],
      },
    ],
  },
];

// ─── Appendix sections ───────────────────────────────────────────────────────
const appendixSections: Section[] = [
  {
    id: "app-a",
    ar: "ملحق أ: المستشفيات والقطاعات الثمانية",
    en: "Appendix A: Hospitals & Eight Sectors",
    subsections: [
      {
        ar: "توزيع القطاعات على المستشفيات",
        en: "Sector-to-Hospital Mapping",
        blocks: [
          {
            type: "para",
            ar: "يضم تجمع جازان الصحي 8 قطاعات مرتبطة بـ 6 مستشفيات رئيسية، تشرف على ما يزيد على 165 مركزًا صحيًا.",
            en: "Jazan Health Cluster comprises 8 sectors linked to 6 main hospitals, overseeing more than 165 health centers.",
          },
          {
            type: "table4",
            headerAr: "القطاعات والمستشفيات وعدد المراكز",
            headerEn: "Sectors, Hospitals & Health Center Counts",
            colsAr: ["رقم القطاع", "اسم القطاع", "المستشفى المرجعي", "عدد المراكز"],
            colsEn: ["Sector No.", "Sector Name", "Reference Hospital", "Centers"],
            rows: [
              [cell("1", "1"), cell("المركزي", "Al-Markazi (Central)"), cell("مستشفى جازان العام", "Jazan General Hospital"), cell("23", "23")],
              [cell("2", "2"), cell("الغربي", "Al-Gharbi (Western)"), cell("مستشفى صبيا العام", "Sabya General Hospital"), cell("30", "30")],
              [cell("3", "3"), cell("الأوسط", "Al-Awsat (Middle)"), cell("مستشفى أبو عريش العام", "Abu Arish General Hospital"), cell("33", "33")],
              [cell("4", "4"), cell("الجنوبي", "Al-Janubi (Southern)"), cell("مستشفى صامطة العام", "Samtah General Hospital"), cell("43", "43")],
              [cell("5", "5"), cell("الشمالي", "Al-Shamali (Northern)"), cell("مستشفى بيش العام", "Baysh General Hospital"), cell("25", "25")],
              [cell("6", "6"), cell("الجبلي", "Al-Jabali (Mountain)"), cell("مستشفى صبيا العام", "Sabya General Hospital"), cell("13", "13")],
              [cell("7", "7"), cell("بني مالك", "Bani Malik"), cell("مستشفى أبو عريش العام", "Abu Arish General Hospital"), cell("13", "13")],
              [cell("8", "8"), cell("فرسان", "Farasan"), cell("مستشفى جازان العام", "Jazan General Hospital"), cell("4", "4")],
            ],
          },
          {
            type: "table",
            headerAr: "المستشفيات الستة في تجمع جازان الصحي",
            headerEn: "Six Hospitals in Jazan Health Cluster",
            rows: [
              [cell("مستشفى جازان العام", "Jazan General Hospital"), cell("يخدم قطاعَي المركزي وفرسان", "Serves Al-Markazi and Farasan sectors")],
              [cell("مستشفى صبيا العام", "Sabya General Hospital"), cell("يخدم قطاعَي الغربي والجبلي", "Serves Al-Gharbi and Al-Jabali sectors")],
              [cell("مستشفى أبو عريش العام", "Abu Arish General Hospital"), cell("يخدم قطاعَي الأوسط وبني مالك", "Serves Al-Awsat and Bani Malik sectors")],
              [cell("مستشفى صامطة العام", "Samtah General Hospital"), cell("يخدم القطاع الجنوبي", "Serves Al-Janubi (Southern) sector")],
              [cell("مستشفى بيش العام", "Baysh General Hospital"), cell("يخدم القطاع الشمالي", "Serves Al-Shamali (Northern) sector")],
              [cell("مستشفى الملك فهد المركزي (KFCH)", "King Fahd Central Hospital (KFCH)"), cell("مستشفى تخصصي يستقبل تحويلات الحالات الحرجة من جميع القطاعات", "Specialist hospital receiving critical-case transfers from all sectors")],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "app-b",
    ar: "ملحق ب: حساب أيام الالتزام",
    en: "Appendix B: Compliance Days Calculation",
    subsections: [
      {
        ar: "قاعدة الحساب",
        en: "Calculation Rule",
        blocks: [
          {
            type: "table",
            rows: [
              [cell("أيام العمل", "Working days"), cell("الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس", "Sunday, Monday, Tuesday, Wednesday, Thursday")],
              [cell("أيام العطلة (مستثناة)", "Weekend (excluded)"), cell("الجمعة والسبت", "Friday and Saturday")],
              [cell("حد الالتزام", "Compliance threshold"), cell("≤ 2 يوم عمل من تاريخ الزيارة", "≤ 2 working days from the visit date")],
            ],
          },
          {
            type: "heading3",
            ar: "أمثلة تطبيقية",
            en: "Practical Examples",
          },
          {
            type: "table",
            headerAr: "أمثلة على حساب الالتزام",
            headerEn: "Compliance Calculation Examples",
            rows: [
              [cell("زيارة الأحد + موعد الاثنين", "Sunday visit + Monday appointment"), cell("1 يوم عمل → ملتزم ✅", "1 working day → Compliant ✅")],
              [cell("زيارة الأحد + موعد الثلاثاء", "Sunday visit + Tuesday appointment"), cell("2 يوم عمل → ملتزم ✅", "2 working days → Compliant ✅")],
              [cell("زيارة الأحد + موعد الأربعاء", "Sunday visit + Wednesday appointment"), cell("3 أيام عمل → غير ملتزم ❌", "3 working days → Non-compliant ❌")],
              [cell("زيارة الخميس + موعد الأحد التالي", "Thursday visit + following Sunday appointment"), cell("1 يوم عمل (الجمعة والسبت مستثنيان) → ملتزم ✅", "1 working day (Friday & Saturday excluded) → Compliant ✅")],
              [cell("لا يوجد موعد محجوز", "No appointment booked"), cell("بانتظار موعد ⏳", "Pending ⏳")],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "app-c",
    ar: "ملحق ج: الأسئلة الشائعة",
    en: "Appendix C: Frequently Asked Questions",
    subsections: [
      {
        ar: "الأسئلة الشائعة",
        en: "FAQ",
        blocks: [
          {
            type: "faq",
            items: [
              {
                qAr: "لماذا لا تظهر المريضة في نتائج البحث؟",
                qEn: "Why doesn't the patient appear in search results?",
                aAr: "تأكد من إدخال رقم الهوية الوطنية كاملًا (10 أرقام). إذا لم تُسجَّل بعد، اضغط «تسجيل مريضة جديدة».",
                aEn: "Verify that you entered the full 10-digit national ID. If she hasn't been registered yet, click 'Register New Patient'.",
              },
              {
                qAr: "هل يمكن للمريضة أن يكون لها أكثر من حالة حمل؟",
                qEn: "Can a patient have more than one pregnancy case?",
                aAr: "نعم، يمكن إضافة حالات حمل متعددة لنفس المريضة عبر ملفها الشخصي.",
                aEn: "Yes, multiple pregnancy cases can be added to the same patient via her patient file.",
              },
              {
                qAr: "كيف أُعدِّل بيانات حالة حمل بعد حفظها؟",
                qEn: "How do I edit a pregnancy case after saving?",
                aAr: "افتح تفاصيل الحالة، ثم اضغط «تعديل الحالة» لتفعيل وضع التعديل. عدّل ما تريد ثم اضغط «حفظ».",
                aEn: "Open the case details, then click 'Edit Case' to enable edit mode. Make your changes then click 'Save'.",
              },
              {
                qAr: "لماذا تظهر تنبيهات VTE على حالة بدون إنوكساباريين؟",
                qEn: "Why does a VTE alert appear on a case without Enoxaparin?",
                aAr: "لأن الحالة مصنفة كـ VTE عالي الخطورة دون وصف الدواء المناسب. راجع الحالة مع الطبيب المسؤول.",
                aEn: "Because the case is classified as high-risk VTE without the required medication being prescribed. Review with the responsible doctor.",
              },
              {
                qAr: "هل تُحذَف التنبيهات تلقائيًا؟",
                qEn: "Are alerts automatically cleared?",
                aAr: "نعم، عند معالجة سبب التنبيه (وصف الدواء، حجز موعد، تسجيل حضور) يختفي التنبيه عند تحديث الصفحة.",
                aEn: "Yes, once the cause is resolved (medication prescribed, appointment booked, attendance logged), the alert disappears on page refresh.",
              },
              {
                qAr: "كيف أُغيِّر لغة الواجهة؟",
                qEn: "How do I change the interface language?",
                aAr: "اضغط على أيقونة اللغة (عربي/English) في أعلى الشريط الجانبي. يُحفَظ الاختيار تلقائيًا.",
                aEn: "Click the language icon (عربي/English) at the top of the sidebar. The choice is saved automatically.",
              },
              {
                qAr: "ماذا أفعل إذا نسيت كلمة المرور؟",
                qEn: "What should I do if I forget my password?",
                aAr: "تواصل مع مسؤول المنظومة (Admin) لإعادة تعيين كلمة المرور. لا توجد خاصية «نسيت كلمة المرور» ذاتية حاليًا.",
                aEn: "Contact the system administrator (Admin) to reset your password. There is no self-service 'forgot password' feature currently.",
              },
              {
                qAr: "كيف أتواصل مع الدعم التقني؟",
                qEn: "How do I contact technical support?",
                aAr: "عبر البريد الإلكتروني: his@jazan-health.gov.sa أو الهاتف الداخلي في ساعات الدوام (الأحد – الخميس).",
                aEn: "Via email: his@jazan-health.gov.sa or the internal phone during working hours (Sunday – Thursday).",
              },
            ],
          },
        ],
      },
    ],
  },
];

const allSections = [...sections, ...appendixSections];

// ─── Block renderers ──────────────────────────────────────────────────────────
function NoteBox({ block, lang }: { block: Extract<ContentBlock, { type: "note" }>; lang: string }) {
  const icons = { info: "ℹ️", warning: "⚠️", tip: "💡" };
  const styles = {
    info: "bg-blue-50 border-blue-300 text-blue-900",
    warning: "bg-amber-50 border-amber-300 text-amber-900",
    tip: "bg-green-50 border-green-300 text-green-900",
  };
  return (
    <div className={`rounded-md border px-3 py-2 text-sm flex gap-2 ${styles[block.variant]}`}>
      <span className="shrink-0">{icons[block.variant]}</span>
      <span>{lang === "ar" ? block.ar : block.en}</span>
    </div>
  );
}

function InfoTable({ block, lang }: { block: Extract<ContentBlock, { type: "table" }>; lang: string }) {
  const header = lang === "ar" ? block.headerAr : block.headerEn;
  return (
    <div className="overflow-x-auto rounded-md border border-border text-sm">
      {header && (
        <div className="bg-emerald-800 text-white font-semibold px-3 py-2">{header}</div>
      )}
      <table className="w-full">
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-emerald-50" : "bg-background"}>
              <td className="border-b border-border px-3 py-2 font-semibold text-foreground w-2/5 align-top">{resolveCell(row[0], lang)}</td>
              <td className="border-b border-border px-3 py-2 text-muted-foreground">{resolveCell(row[1], lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoTable4({ block, lang }: { block: Extract<ContentBlock, { type: "table4" }>; lang: string }) {
  const header = lang === "ar" ? block.headerAr : block.headerEn;
  const cols = lang === "ar" ? block.colsAr : block.colsEn;
  return (
    <div className="overflow-x-auto rounded-md border border-border text-sm">
      {header && (
        <div className="bg-emerald-800 text-white font-semibold px-3 py-2">{header}</div>
      )}
      <table className="w-full">
        <thead>
          <tr className="bg-emerald-700 text-white">
            {cols.map((h, i) => (
              <th key={i} className="px-3 py-2 text-start font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-emerald-50" : "bg-background"}>
              {row.map((c, j) => (
                <td key={j} className="border-b border-border px-3 py-2 text-muted-foreground">{resolveCell(c, lang)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: ContentBlock, lang: string, idx: number) {
  switch (block.type) {
    case "para":
      return (
        <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
          {lang === "ar" ? block.ar : block.en}
        </p>
      );
    case "bullets":
      return (
        <ul key={idx} className="space-y-1 list-none ps-4">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground flex gap-2">
              <span className="text-emerald-700 shrink-0">•</span>
              <span>{lang === "ar" ? item.ar : item.en}</span>
            </li>
          ))}
        </ul>
      );
    case "note":
      return <NoteBox key={idx} block={block} lang={lang} />;
    case "table":
      return <InfoTable key={idx} block={block} lang={lang} />;
    case "table4":
      return <InfoTable4 key={idx} block={block} lang={lang} />;
    case "heading3":
      return (
        <h4 key={idx} className="font-semibold text-sm text-emerald-800 mt-2">
          {lang === "ar" ? block.ar : block.en}
        </h4>
      );
    case "faq":
      return (
        <div key={idx} className="space-y-4">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-md bg-muted/40 border border-border p-3 space-y-1">
              <p className="text-sm font-semibold text-emerald-800">
                {lang === "ar" ? `س: ${item.qAr}` : `Q: ${item.qEn}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? `ج: ${item.aAr}` : `A: ${item.aEn}`}
              </p>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function UserGuide() {
  const { t, lang } = useI18n();
  const { user, isAdmin } = useAuth();
  const [status, setStatus] = useState<FileStatus>(null);
  const [checking, setChecking] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<"success" | "error" | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Tracks whether the current generating state was triggered by the button (SSE stream
  // is active) vs detected from the server's status response (startup auto-generation).
  const buttonGeneratingRef = useRef(false);

  const GUIDE_SESSION_KEY = "guide-last-section";
  const [showJumpMenu, setShowJumpMenu] = useState(false);
  const jumpMenuRef = useRef<HTMLDivElement>(null);

  const bcRef = useRef<BroadcastChannel | null>(null);

  // Broadcast "generation done" to other same-origin tabs (BroadcastChannel with
  // localStorage storage-event as fallback for browsers that don't support it).
  const broadcastGenerationDone = () => {
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({ type: "guide-generation-done" });
      } catch {
        // ignore
      }
    }
    // localStorage fallback: toggling the value triggers a storage event in other tabs.
    try {
      localStorage.setItem(GUIDE_LS_SIGNAL_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  // Listen for cross-tab "done" signals and immediately re-fetch status.
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(GUIDE_BC_CHANNEL);
      bcRef.current = bc;
      bc.onmessage = (ev: MessageEvent) => {
        if (ev.data?.type === "guide-generation-done") {
          fetchStatus();
        }
      };
    } catch {
      bcRef.current = null;
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === GUIDE_LS_SIGNAL_KEY) {
        fetchStatus();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        bc?.close();
      } catch {
        // ignore
      }
      bcRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const savedId = sessionStorage.getItem(GUIDE_SESSION_KEY);
    if (!savedId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(savedId);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const sectionIds = allSections.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            sessionStorage.setItem(GUIDE_SESSION_KEY, entry.target.id);
          }
        }
      },
      { threshold: 0.1, rootMargin: "-80px 0px -55% 0px" },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!user) return;
    setChecking(true);
    fetchStatus();
  }, [user]);

  const fetchStatus = () => {
    fetch(`${API}/downloads/user-guide/status`)
      .then((res) => res.json())
      .then((data: FileStatus) => {
        setStatus(data);
        // If the server is already generating (e.g. startup auto-regen) and we haven't
        // triggered it ourselves via the button, reflect that state in the UI.
        if (data?.generating && !buttonGeneratingRef.current) {
          setGenerating(true);
        }
      })
      .catch(() => setStatus({ docx: false, pdf: false, docxMtime: null, pdfMtime: null }))
      .finally(() => setChecking(false));
  };

  // Poll status every 3 s while another tab/session is generating, so this page
  // updates automatically once the generation completes.
  useEffect(() => {
    if (!status?.generating || generating) return;
    const id = setInterval(() => {
      fetch(`${API}/downloads/user-guide/status`)
        .then((res) => res.json())
        .then((data: FileStatus) => setStatus(data))
        .catch(() => {/* ignore transient errors */});
    }, 3000);
    return () => clearInterval(id);
  }, [status?.generating, generating]);

  // Poll the status endpoint every 3 s while server-side startup generation is running
  // so the UI clears automatically once the background job finishes.
  useEffect(() => {
    if (!generating || buttonGeneratingRef.current) return;
    const interval = setInterval(() => {
      fetch(`${API}/downloads/user-guide/status`)
        .then((res) => res.json())
        .then((data: FileStatus) => {
          setStatus(data);
          if (!data?.generating) {
            setGenerating(false);
            setGenerateResult("success");
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [generating]);

  useEffect(() => {
    if (!generating) return;
    setElapsedSeconds(0);
    setProgressPct(0);
    const interval = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = (s ?? 0) + 1;
        setProgressPct(Math.min(90, (next / getExpectedDuration()) * 90));
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [generating]);

  const handleGenerate = async () => {
    buttonGeneratingRef.current = true;
    setGenerating(true);
    setGenerateResult(null);
    setCurrentStep(null);
    startTimeRef.current = Date.now();
    try {
      const res = await fetch(`${API}/downloads/user-guide/generate`, { method: "POST" });
      if (!res.ok) {
        setGenerateResult("error");
        return;
      }

      const computeElapsed = () =>
        Math.max(1, Math.round((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));

      const saveDuration = (elapsed: number) => {
        try {
          localStorage.setItem(GUIDE_DURATION_KEY, String(elapsed));
        } catch {
        }
      };

      const finishSuccess = async () => {
        const elapsed = computeElapsed();
        setElapsedSeconds(elapsed);
        setProgressPct(100);
        try {
          localStorage.setItem(GUIDE_DURATION_KEY, String(elapsed));
        } catch {
          // ignore
        }
        broadcastGenerationDone();
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
        setGenerateResult("success");
        fetchStatus();
      };

      // Stream SSE events from the server; fall back gracefully if body is unavailable.
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let settled = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            try {
              const event = JSON.parse(trimmed.slice(5).trim()) as {
                step?: string;
                done?: boolean;
                error?: boolean;
              };
              if (event.step) {
                setCurrentStep(event.step);
              } else if (event.done) {
                settled = true;
                await finishSuccess();
              } else if (event.error) {
                settled = true;
                setGenerateResult("error");
              }
            } catch {
              // ignore malformed lines
            }
          }
        }

        // If the stream ended without an explicit done/error event, treat as success.
        if (!settled) {
          await finishSuccess();
        }
      } else {
        // No streaming support — treat the completed response as success.
        await finishSuccess();
      }
    } catch {
      setGenerateResult("error");
    } finally {
      buttonGeneratingRef.current = false;
      setGenerating(false);
      setCurrentStep(null);
    }
  };
  const anyAvailable = status && (status.pdf || status.docx);

  const formatMtime = (isoString: string | null | undefined): string => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!showJumpMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (jumpMenuRef.current && !jumpMenuRef.current.contains(e.target as Node)) {
        setShowJumpMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showJumpMenu]);

  // Inject a portrait @page override while the guide is mounted so both the
  // "Print Guide" button and the browser's native Ctrl/Cmd+P produce portrait A4.
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "guide-print-portrait";
    style.textContent = "@page { size: A4 portrait; margin: 15mm 20mm; }";
    document.head.appendChild(style);
    return () => {
      document.getElementById("guide-print-portrait")?.remove();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintSection = (section: Section) => {
    const el = document.getElementById(section.id);
    if (!el) return;

    const sectionTitle = lang === "ar" ? section.ar : section.en;
    const orgLine =
      lang === "ar"
        ? `تجمع جازان الصحي — طُبع بتاريخ: ${printDate}`
        : `Jazan Health Cluster — Printed: ${printDate}`;
    const dir = lang === "ar" ? "rtl" : "ltr";

    const contentHtml = el.innerHTML;

    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${sectionTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4 portrait; margin: 15mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Tajawal', sans-serif;
    font-size: 11pt;
    color: #111;
    background: white;
    margin: 0;
    padding: 0;
    direction: ${dir};
  }
  .section-print-header {
    text-align: center;
    border-bottom: 2px solid #005a2e;
    padding-bottom: 8pt;
    margin-bottom: 14pt;
  }
  .section-print-header h1 {
    font-size: 13pt;
    font-weight: bold;
    color: #005a2e;
    margin: 0 0 4pt 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .section-print-header p {
    font-size: 9pt;
    color: #555;
    margin: 0;
  }
  .section-print-footer {
    margin-top: 18pt;
    border-top: 1px solid #ccc;
    padding-top: 6pt;
    font-size: 9pt;
    color: #555;
    text-align: center;
  }
  /* Card shell — strip it visually */
  [data-slot="card"] { box-shadow: none !important; border: none !important; background: white !important; padding: 0; }
  [data-slot="card-header"] { padding: 0 0 8pt 0; }
  [data-slot="card-content"] { padding: 0; }
  /* Section title */
  .text-emerald-800, .text-emerald-700 { color: #005a2e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Headings */
  h2, h3, h4 { margin: 6pt 0 3pt 0; }
  h3 { font-size: 11pt; border-bottom: 1px solid #ddd; padding-bottom: 3pt; }
  h4 { font-size: 10pt; color: #005a2e; }
  /* Body text */
  p { margin: 3pt 0; line-height: 1.6; }
  .text-muted-foreground { color: #333 !important; }
  /* Lists */
  ul { margin: 3pt 0; padding-${dir === "rtl" ? "right" : "left"}: 14pt; list-style: none; }
  li { margin: 2pt 0; }
  /* Tables */
  .overflow-x-auto { overflow: visible !important; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 6pt 0; }
  th, td { border: 1px solid #bbb; padding: 4px 8px; text-align: ${dir === "rtl" ? "right" : "left"}; }
  thead tr { background: #005a2e !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg-emerald-50 { background: #f0faf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg-emerald-700, .bg-emerald-800 { background: #005a2e !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Note boxes */
  .rounded-md { break-inside: avoid; }
  .bg-blue-50 { background: #eff6ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg-amber-50 { background: #fffbeb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg-emerald-50 { background: #f0faf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .border { border: 1px solid #ccc; }
  .border-blue-200 { border-color: #bfdbfe; }
  .border-amber-200 { border-color: #fde68a; }
  .border-emerald-200 { border-color: #a7f3d0; }
  .p-3 { padding: 8px; }
  .px-3 { padding-left: 8px; padding-right: 8px; }
  .py-2 { padding-top: 5px; padding-bottom: 5px; }
  .space-y-1 > * + * { margin-top: 4px; }
  .space-y-2 > * + * { margin-top: 6px; }
  .space-y-3 > * + * { margin-top: 8px; }
  .space-y-4 > * + * { margin-top: 10px; }
  .space-y-6 > * + * { margin-top: 14px; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-sm { font-size: 10pt; }
  .text-lg { font-size: 12pt; }
  .text-base { font-size: 11pt; }
  .gap-2 { gap: 6px; }
  .flex { display: flex; }
  .shrink-0 { flex-shrink: 0; }
  .leading-relaxed { line-height: 1.7; }
  .mt-2 { margin-top: 6pt; }
  .pb-1 { padding-bottom: 3pt; }
  .border-b { border-bottom: 1px solid #ddd; }
  .scroll-mt-4 { break-inside: avoid-page; }
  /* Hide section-level card title (we show it in the header) */
  [data-slot="card-header"] .text-lg { display: none; }
  /* Hide print button itself if somehow rendered */
  button { display: none !important; }
  /* FAQ boxes */
  .bg-muted\\/40 { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
<div class="section-print-header">
  <h1>${sectionTitle}</h1>
  <p>${orgLine}</p>
</div>
<div>${contentHtml}</div>
<div class="section-print-footer">${orgLine}</div>
<script>
  window.onload = function() {
    window.print();
    setTimeout(function() { window.close(); }, 500);
  };
</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const printDate = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 guide-page">
      {/* Print-only header — hidden on screen */}
      <div className="guide-print-header hidden" aria-hidden="true">
        <h2>
          {lang === "ar"
            ? "دليل المستخدم الشامل – منظومة تتبع الحمل عالي الخطورة"
            : "Comprehensive User Guide – High-Risk Pregnancy Tracker"}
        </h2>
        <p>
          {lang === "ar"
            ? `تجمع جازان الصحي — طُبع بتاريخ: ${printDate}`
            : `Jazan Health Cluster — Printed: ${printDate}`}
        </p>
      </div>

      {/* Print-only section index — immediately follows the title block on paper */}
      <div className="print-only guide-print-index" aria-hidden="true">
        <h3>
          {lang === "ar" ? "فهرس الأقسام" : "Section Index"}
        </h3>
        <ol>
          {allSections.map((section, idx) => (
            <li key={section.id}>
              <span className="guide-print-index-num">{idx + 1}.</span>{" "}
              {lang === "ar" ? section.ar : section.en}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <h1 className="text-3xl font-bold">{t("nav.guide")}</h1>
        <Button variant="outline" onClick={handlePrint} className="gap-2 shrink-0">
          <Printer className="h-4 w-4" />
          {lang === "ar" ? "طباعة الدليل" : "Print Guide"}
        </Button>
      </div>

      {/* Download card */}
      {user && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>{t("guide.downloadTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{t("guide.downloadDesc")}</p>
            {checking ? (
              <p className="text-sm text-muted-foreground">{t("guide.checking")}</p>
            ) : anyAvailable ? (
              <div
                className={`flex gap-4 flex-wrap ${lang === "ar" ? "flex-row-reverse justify-end" : ""}`}
              >
                {status?.pdf && (
                  <div className="flex flex-col gap-1">
                    <Button asChild variant="default">
                      <a href={`${API}/downloads/user-guide.pdf`} download>
                        {t("guide.downloadPdf")}
                      </a>
                    </Button>
                    {status.pdfMtime && (
                      <p className="text-xs text-muted-foreground">
                        {t("guide.lastGenerated")} {formatMtime(status.pdfMtime)}
                      </p>
                    )}
                  </div>
                )}
                {status?.docx && (
                  <div className="flex flex-col gap-1">
                    <Button asChild variant="outline">
                      <a href={`${API}/downloads/user-guide.docx`} download>
                        {t("guide.downloadWord")}
                      </a>
                    </Button>
                    {status.docxMtime && (
                      <p className="text-xs text-muted-foreground">
                        {t("guide.lastGenerated")} {formatMtime(status.docxMtime)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : isAdmin || user?.role === "coordinator" ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-700">{t("guide.filesNotReadyAdmin")}</p>
                <pre className="bg-muted rounded-md px-4 py-3 text-sm font-mono text-start overflow-x-auto select-all">
                  {t("guide.filesNotReadyAdminCmd")}
                </pre>
                {generateResult === "success" && (
                  <Alert className="border-green-200 bg-green-50 text-green-800">
                    <AlertDescription>
                      {elapsedSeconds !== null
                        ? t("guide.generateSuccessTime").replace("{n}", String(elapsedSeconds))
                        : t("guide.generateSuccess")}
                    </AlertDescription>
                  </Alert>
                )}
                {generateResult === "error" && (
                  <Alert className="border-red-200 bg-red-50 text-red-800">
                    <AlertDescription>{t("guide.generateError")}</AlertDescription>
                  </Alert>
                )}
                {status?.generating && !generating && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <AlertDescription>{t("guide.generatingElsewhere")}</AlertDescription>
                  </Alert>
                )}
                <Button
                  onClick={handleGenerate}
                  disabled={generating || (status?.generating ?? false)}
                  variant="secondary"
                >
                  {(generating || status?.generating) && (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  )}
                  {generating ? t("guide.generating") : t("guide.generateBtn")}
                </Button>
                {generating && (
                  <div className="space-y-1.5 pt-1">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-[width] duration-1000 ease-linear"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      {elapsedSeconds !== null && (
                        <span>{t("guide.elapsed").replace("{n}", String(elapsedSeconds))}</span>
                      )}
                      {elapsedSeconds !== null && progressPct < 100 && (
                        <span>{t("guide.remaining").replace("{n}", String(Math.max(0, getExpectedDuration() - elapsedSeconds)))}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentStep
                        ? t(`guide.step.${currentStep}` as TranslationKey)
                        : t("guide.generatingHint")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-600">{t("guide.filesNotReady")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Intro card */}
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
              ? "يغطي هذا الدليل جميع وظائف المنظومة: تسجيل المرضى، إدارة الحالات، المواعيد، التنبيهات، التقارير، وإدارة المستخدمين. اضغط على أي قسم في الفهرس للانتقال إليه مباشرةً."
              : "This guide covers all system functions: patient registration, case management, appointments, alerts, reports, and user administration. Click any section in the table of contents to jump to it."}
          </p>
        </CardContent>
      </Card>

      {/* Table of Contents — hidden when printing (buttons are non-functional on paper) */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>{lang === "ar" ? "فهرس المحتويات" : "Table of Contents"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-none">
            {allSections.map((section) => (
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

      {/* Section cards */}
      {allSections.map((section) => (
        <Card key={section.id} id={section.id} className="scroll-mt-4 guide-section-card">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2 no-print-section-btn">
              <CardTitle className="text-lg text-emerald-800">
                {lang === "ar" ? section.ar : section.en}
              </CardTitle>
              <button
                onClick={() => handlePrintSection(section)}
                title={lang === "ar" ? "طباعة هذا القسم" : "Print this section"}
                aria-label={lang === "ar" ? "طباعة هذا القسم" : "Print this section"}
                className="no-print shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {section.subsections.map((sub, idx) => (
              <div key={idx} id={`${section.id}-${idx}`} className="scroll-mt-4 space-y-3">
                <h3 className="font-semibold text-base border-b border-border pb-1">
                  {lang === "ar" ? sub.ar : sub.en}
                </h3>
                {sub.blocks.map((block, bi) => renderBlock(block, lang, bi))}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Floating navigation cluster — Back to top + Section jump */}
      {showBackToTop && (
        <div
          ref={jumpMenuRef}
          className={`fixed bottom-6 z-50 flex flex-col gap-2 no-print ${lang === "ar" ? "left-6 items-start" : "right-6 items-end"}`}
        >
          {/* Section jump dropdown */}
          {showJumpMenu && (
            <div
              className={`mb-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-border bg-white shadow-xl ${lang === "ar" ? "text-right" : "text-left"}`}
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              {allSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    scrollTo(section.id);
                    setShowJumpMenu(false);
                  }}
                  className="block w-full px-4 py-2.5 text-start text-sm hover:bg-emerald-50 hover:text-emerald-700 border-b border-border/50 last:border-b-0 transition-colors"
                >
                  {lang === "ar" ? section.ar : section.en}
                </button>
              ))}
            </div>
          )}

          {/* Sections picker button */}
          <button
            onClick={() => setShowJumpMenu((v) => !v)}
            aria-label={lang === "ar" ? "الانتقال إلى قسم" : "Jump to section"}
            aria-expanded={showJumpMenu}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${showJumpMenu ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-700 bg-white text-emerald-700 hover:bg-emerald-50"}`}
          >
            <List className="h-4 w-4" />
            {lang === "ar" ? "الأقسام" : "Sections"}
          </button>

          {/* Back to top button */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label={lang === "ar" ? "العودة إلى الأعلى" : "Back to top"}
            className="flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
            {lang === "ar" ? "أعلى الصفحة" : "Back to top"}
          </button>
        </div>
      )}
    </div>
  );
}
