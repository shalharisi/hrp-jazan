import { useI18n } from "@/lib/i18n-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, FileText } from "lucide-react";

export default function PrivacyPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const sections = ar ? [
    {
      icon: Shield,
      title: "نظام حماية البيانات الشخصية (PDPL)",
      content: "تلتزم هذه المنظومة بنظام حماية البيانات الشخصية السعودي الصادر بالمرسوم الملكي رقم م/19 لعام 1443هـ. يُعدّ جمع البيانات وتخزينها ومعالجتها وفق هذا النظام بهدف تقديم الرعاية الصحية فقط.",
    },
    {
      icon: Lock,
      title: "ما البيانات التي نجمعها؟",
      content: "نجمع بيانات سريرية تتضمن: الاسم، رقم الهوية الوطنية، رقم الجوال، تاريخ الميلاد، العنوان، المركز الصحي، وبيانات الحمل والمواعيد. لا يتم مشاركة أي بيانات مع جهات خارجية غير مصرح لها.",
    },
    {
      icon: Eye,
      title: "من يمكنه الاطلاع على بياناتك؟",
      content: "يقتصر الوصول إلى البيانات على الكوادر الصحية المصرح لهم (طبيب، منسق، مسؤول) في تجمع جازان الصحي. جميع عمليات الوصول مسجّلة في سجل التدقيق.",
    },
    {
      icon: FileText,
      title: "حقوق صاحب البيانات",
      content: "وفق نظام PDPL، يحق لصاحب البيانات: الاطلاع على بياناته، طلب تصحيحها، طلب حذفها في الحالات المسموح بها نظاماً، وتقديم شكوى للهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).",
    },
  ] : [
    {
      icon: Shield,
      title: "Personal Data Protection Law (PDPL)",
      content: "This system complies with the Saudi Personal Data Protection Law issued by Royal Decree M/19 in 1443H. Data is collected, stored, and processed solely for the purpose of providing healthcare services.",
    },
    {
      icon: Lock,
      title: "What data do we collect?",
      content: "We collect clinical data including: name, national ID, phone number, date of birth, address, health center, pregnancy data, and appointment records. No data is shared with unauthorized third parties.",
    },
    {
      icon: Eye,
      title: "Who can access your data?",
      content: "Access is limited to authorized healthcare professionals (doctor, coordinator, admin) at Jazan Health Cluster. All access events are recorded in an audit log.",
    },
    {
      icon: FileText,
      title: "Data Subject Rights",
      content: "Under PDPL, data subjects have the right to: access their data, request corrections, request deletion in legally permitted cases, and file complaints with SDAIA (Saudi Data and Artificial Intelligence Authority).",
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6" dir={ar ? "rtl" : "ltr"}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#006633" }}>
            {ar ? "سياسة الخصوصية وحماية البيانات" : "Privacy Policy & Data Protection"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ar
              ? "آخر تحديث: يناير 2026 | وفق نظام حماية البيانات الشخصية السعودي PDPL"
              : "Last updated: January 2026 | Compliant with Saudi PDPL"}
          </p>
        </div>

        <div className="space-y-4">
          {sections.map((s, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <s.icon className="w-5 h-5" style={{ color: "#006633" }} aria-hidden="true" />
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-2" style={{ borderColor: "#006633" }}>
          <CardContent className="pt-4">
            <p className="text-sm text-center font-medium" style={{ color: "#006633" }}>
              {ar
                ? "للاستفسارات المتعلقة بالخصوصية: تجمع جازان الصحي، إدارة المعلومات الصحية"
                : "Privacy inquiries: Jazan Health Cluster, Health Information Management"}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
