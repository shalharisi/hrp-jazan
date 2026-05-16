export const translations = {
  ar: {
    // Navigation
    "nav.dashboard": "لوحة التحكم",
    "nav.patients": "الحوامل",
    "nav.pregnancies": "الحالات",
    "nav.alerts": "التنبيهات",
    "nav.guide": "دليل المستخدم",
    "nav.users": "إدارة المستخدمين",
    "nav.settings": "الإعدادات",
    "nav.logout": "تسجيل الخروج",
    "nav.privacy": "الخصوصية",

    // Dashboard
    "dashboard.title": "لوحة التحكم",
    "dashboard.totalPatients": "إجمالي الحوامل",
    "dashboard.totalPregnancies": "إجمالي الحالات",
    "dashboard.criticalCases": "حالات حرجة",
    "dashboard.vteRisk": "خطر التجلط الوريدي",
    "dashboard.vteWithoutEnoxaparin": "VTE بدون إينوكسابارين",
    "dashboard.bookingCompliance": "نسبة الالتزام بالموعد",
    "dashboard.attendanceRate": "نسبة الحضور",
    "dashboard.criticalWithoutAppt": "حرج بدون موعد",
    "dashboard.pendingAppts": "مواعيد معلقة",

    // Patients
    "patients.title": "الحوامل",
    "patients.search": "بحث بالاسم أو الهوية...",
    "patients.new": "تسجيل حامل",
    "patients.name": "الاسم",
    "patients.nationalId": "الهوية الوطنية",
    "patients.phone": "رقم الجوال",
    "patients.healthCenter": "المركز الصحي",
    "patients.sector": "القطاع",
    
    // Status & Badges
    "risk.low": "منخفض",
    "risk.medium": "متوسط",
    "risk.high": "عالي",
    "risk.critical": "حرج",
    
    "compliance.compliant": "ملتزم",
    "compliance.non_compliant": "غير ملتزم",
    "compliance.pending": "بانتظار موعد",
    
    "referral.follow_at_center": "متابعة في المركز",
    "referral.follow_at_hospital": "متابعة في المستشفى",
    "referral.transfer_kfch": "تحويل لـ KFCH",

    // General
    "general.save": "حفظ",
    "general.cancel": "إلغاء",
    "general.edit": "تعديل",
    "general.delete": "حذف",
    "general.loading": "جاري التحميل...",
    "general.noData": "لا توجد بيانات",
  },
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.patients": "Patients",
    "nav.pregnancies": "Cases",
    "nav.alerts": "Alerts",
    "nav.guide": "User Guide",
    "nav.users": "User Management",
    "nav.settings": "Settings",
    "nav.logout": "Logout",
    "nav.privacy": "Privacy",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.totalPatients": "Total Patients",
    "dashboard.totalPregnancies": "Total Cases",
    "dashboard.criticalCases": "Critical Cases",
    "dashboard.vteRisk": "VTE High Risk",
    "dashboard.vteWithoutEnoxaparin": "VTE w/o Enoxaparin",
    "dashboard.bookingCompliance": "Booking Compliance",
    "dashboard.attendanceRate": "Attendance Rate",
    "dashboard.criticalWithoutAppt": "Critical w/o Appt",
    "dashboard.pendingAppts": "Pending Appts",

    // Patients
    "patients.title": "Patients",
    "patients.search": "Search by name or ID...",
    "patients.new": "Register Patient",
    "patients.name": "Name",
    "patients.nationalId": "National ID",
    "patients.phone": "Phone",
    "patients.healthCenter": "Health Center",
    "patients.sector": "Sector",

    // Status & Badges
    "risk.low": "Low",
    "risk.medium": "Medium",
    "risk.high": "High",
    "risk.critical": "Critical",
    
    "compliance.compliant": "Compliant",
    "compliance.non_compliant": "Non Compliant",
    "compliance.pending": "Pending Appt",

    "referral.follow_at_center": "Follow at Center",
    "referral.follow_at_hospital": "Follow at Hospital",
    "referral.transfer_kfch": "Transfer to KFCH",

    // General
    "general.save": "Save",
    "general.cancel": "Cancel",
    "general.edit": "Edit",
    "general.delete": "Delete",
    "general.loading": "Loading...",
    "general.noData": "No data available",
  }
} as const;

export type Language = "ar" | "en";
export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, lang: Language = "ar"): string {
  return translations[lang][key] || key;
}
