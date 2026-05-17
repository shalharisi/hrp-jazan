import React, { useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import type { TranslationKey } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreatePregnancy,
  useGetPatientByNid,
  useListHospitals,
  PregnancyInputRiskLevel,
  PregnancyInputReferralRecommendation,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";

const RISK_FACTORS_G1 = [
  "تعدد الأجنة",
  "عمر الأم فوق 40",
  "عمر الأم أقل من 16",
  "BMI 35 أو أكثر",
  "حمل IVF",
  "مدخنة",
  "نتائج فحص الفصل الأول إيجابية",
  "3 إجهاضات أو أكثر",
  "ولادة مبكرة سابقة",
  "وفاة جنينية سابقة",
  "عملية قيصرية سابقة",
  "سوابق تسمم الحمل",
  "جلطات وريدية سابقة",
  "سابقة إصابة بنزيف ما بعد الولادة",
];

const RISK_FACTORS_G2 = [
  "ارتفاع ضغط الدم الحملي",
  "تسمم الحمل / الإرعاش",
  "داء السكري الحملي",
  "انفصال المشيمة",
  "المشيمة المنزاحة",
  "تأخر النمو داخل الرحم (IUGR)",
  "نقص السائل الأمنيوسي",
  "زيادة السائل الأمنيوسي",
  "تمزق الأغشية المبكر (PPROM)",
  "نزيف ما قبل الولادة",
  "الإجهاض المهدد",
  "هيموغلوبين منخفض (Hb < 9)",
];

const RISK_FACTORS_G3 = [
  "داء السكري النوع الأول",
  "داء السكري النوع الثاني",
  "ارتفاع ضغط الدم المزمن",
  "أمراض القلب",
  "أمراض الكلى",
  "أمراض الغدة الدرقية",
  "الصرع",
  "الأمراض المناعية الذاتية",
  "الربو الشديد",
  "أمراض الكبد",
  "الاكتئاب / الاضطرابات النفسية",
  "فقر الدم المنجلي أو الثلاسيميا",
  "السرطان",
];

const formSchema = z.object({
  patientId: z.number().min(1, "المريضة مطلوبة"),
  visitDate: z.string().min(1, "تاريخ الزيارة مطلوب"),
  lmpDate: z.string().optional(),
  gestationalAge: z.coerce.number().optional(),
  riskLevel: z.nativeEnum(PregnancyInputRiskLevel),
  referralRecommendation: z.nativeEnum(PregnancyInputReferralRecommendation),
  riskFactors: z.array(z.string()).default([]),
  pregnancyRiskFactors: z.array(z.string()).default([]),
  medicalConditions: z.array(z.string()).default([]),
  medications: z.string().optional(),
  isVteHighRisk: z.boolean().default(false),
  enoxaparinPrescribed: z.boolean().default(false),
  referralExplained: z.boolean().nullable().optional(),
  doctorName: z.string().optional(),
  referredHospitalId: z.coerce.number().optional(),
  appointmentDate: z.string().optional(),
  notes: z.string().optional(),
  followUpNotes: z.string().optional(),
});

export default function PregnancyNew() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [nidSearch, setNidSearch] = useState("");
  const { data: searchResult, refetch } = useGetPatientByNid(nidSearch, {
    query: { queryKey: ["patient-nid", nidSearch], enabled: false },
  });
  const { data: hospitals } = useListHospitals();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: 0,
      visitDate: new Date().toISOString().split("T")[0],
      lmpDate: "",
      riskLevel: PregnancyInputRiskLevel.low,
      referralRecommendation: PregnancyInputReferralRecommendation.follow_at_center,
      isVteHighRisk: false,
      enoxaparinPrescribed: false,
      referralExplained: null,
      riskFactors: [],
      pregnancyRiskFactors: [],
      medicalConditions: [],
      medications: "",
      doctorName: "",
      appointmentDate: "",
      notes: "",
      followUpNotes: "",
    },
  });

  const handleSearch = async () => {
    if (nidSearch.length === 10) {
      const res = await refetch();
      if (res.data?.patient) {
        form.setValue("patientId", res.data.patient.id);
        toast({ title: "تم العثور على المريضة", description: res.data.patient.nameAr });
      } else {
        toast({
          title: "غير موجودة",
          description: "لم يتم العثور على المريضة",
          variant: "destructive",
        });
      }
    }
  };

  const createPregnancy = useCreatePregnancy();

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPregnancy.mutate(
      {
        data: {
          patientId: values.patientId,
          visitDate: values.visitDate,
          lmpDate: values.lmpDate || null,
          gestationalAge: values.gestationalAge ?? null,
          riskLevel: values.riskLevel,
          referralRecommendation: values.referralRecommendation,
          riskFactors: values.riskFactors,
          pregnancyRiskFactors: values.pregnancyRiskFactors,
          medicalConditions: values.medicalConditions,
          medications: values.medications || null,
          isVteHighRisk: values.isVteHighRisk,
          enoxaparinPrescribed: values.enoxaparinPrescribed,
          referralExplained: values.referralExplained ?? null,
          doctorName: values.doctorName || null,
          referredHospitalId: values.referredHospitalId || null,
          appointmentDate: values.appointmentDate || null,
          notes: values.notes || null,
          followUpNotes: values.followUpNotes || null,
        },
      },
      {
        onSuccess: (pregnancy) => {
          toast({ title: t("general.saved"), description: t("general.saveSuccess") });
          setLocation(`/pregnancies/${pregnancy.id}`);
        },
        onError: () => {
          toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" });
        },
      },
    );
  }

  const patientFound = searchResult?.patient;
  const hasPatient = !!form.watch("patientId");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">{t("pregnancy.newCase")}</h1>

      {/* Patient Lookup */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pregnancy.patientLookup")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">{t("patients.nationalId")}</label>
              <Input
                placeholder="أدخل رقم الهوية (10 أرقام)"
                value={nidSearch}
                onChange={(e) => setNidSearch(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button onClick={handleSearch} type="button">
              <Search className="w-4 h-4 ms-2" />
              بحث
            </Button>
          </div>
          {patientFound && (
            <div className="mt-4 p-4 bg-muted rounded-md grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">الاسم: </span>
                <span className="font-medium">{patientFound.nameAr}</span>
              </div>
              <div>
                <span className="text-muted-foreground">المركز: </span>
                <span className="font-medium">{patientFound.healthCenterNameAr}</span>
              </div>
              <div>
                <span className="text-muted-foreground">العمر: </span>
                <span className="font-medium">
                  {patientFound.age != null ? `${patientFound.age} سنة` : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">الجوال: </span>
                <span className="font-medium" dir="ltr">
                  {patientFound.phone}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={`space-y-6 ${!hasPatient ? "opacity-50 pointer-events-none" : ""}`}
        >
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>بيانات الزيارة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="visitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.visitDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lmpDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.lmpDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gestationalAge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.gestationalAge")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={45}
                          {...field}
                          value={field.value || ""}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riskLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.riskLevel")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(PregnancyInputRiskLevel).map((l) => (
                            <SelectItem key={l} value={l}>
                              {t(`risk.${l}` as TranslationKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="doctorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.doctorName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم الطبيب" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Risk Factors Group 1 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("pregnancy.riskFactors")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("pregnancy.riskFactorsDesc")}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {RISK_FACTORS_G1.map((factor) => (
                  <FormField
                    key={factor}
                    control={form.control}
                    name="riskFactors"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 rounded-md border p-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(factor)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, factor])
                                : field.onChange(field.value?.filter((v) => v !== factor));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal text-sm cursor-pointer">
                          {factor}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Factors Group 2 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("pregnancy.pregnancyRiskFactors")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("pregnancy.pregnancyRiskFactorsDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {RISK_FACTORS_G2.map((factor) => (
                  <FormField
                    key={factor}
                    control={form.control}
                    name="pregnancyRiskFactors"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 rounded-md border p-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(factor)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, factor])
                                : field.onChange(field.value?.filter((v) => v !== factor));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal text-sm cursor-pointer">
                          {factor}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Medical Conditions Group 3 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("pregnancy.medicalConditions")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("pregnancy.medicalConditionsDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {RISK_FACTORS_G3.map((factor) => (
                  <FormField
                    key={factor}
                    control={form.control}
                    name="medicalConditions"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 rounded-md border p-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(factor)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, factor])
                                : field.onChange(field.value?.filter((v) => v !== factor));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal text-sm cursor-pointer">
                          {factor}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Medications + VTE + Referral */}
          <Card>
            <CardHeader>
              <CardTitle>الأدوية والإحالة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="medications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pregnancy.medications")}</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {t("pregnancy.medicationsDesc")}
                    </p>
                    <FormControl>
                      <Textarea {...field} placeholder="اذكر الدواء إن وُجد..." rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isVteHighRisk"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 rounded-md border p-4 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">
                        {t("pregnancy.isVteHighRisk")}
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enoxaparinPrescribed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 rounded-md border p-4 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">
                        {t("pregnancy.enoxaparinPrescribed")}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="referralRecommendation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pregnancy.referralRecommendation")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(PregnancyInputReferralRecommendation).map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`referral.${r}` as TranslationKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralExplained"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pregnancy.referralExplained")}</FormLabel>
                    <Select
                      value={field.value === true ? "yes" : field.value === false ? "no" : ""}
                      onValueChange={(v) =>
                        field.onChange(v === "yes" ? true : v === "no" ? false : null)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="yes">{t("pregnancy.yes")}</SelectItem>
                        <SelectItem value="no">{t("pregnancy.no")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="referredHospitalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.referredHospital")}</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المستشفى" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hospitals?.map((h) => (
                            <SelectItem key={h.id} value={String(h.id)}>
                              {h.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pregnancy.appointmentDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>الملاحظات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pregnancy.notes")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="ملاحظات عامة..." rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="followUpNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pregnancy.followUpNotes")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="استجابات تواصل المراجعة..." rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={createPregnancy.isPending || !hasPatient}
            className="w-full"
            size="lg"
          >
            {t("general.save")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
