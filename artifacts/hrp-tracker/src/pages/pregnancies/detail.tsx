import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import {
  useGetPregnancy, useUpdatePregnancy, useListHospitals,
  useCreateAppointment, useUpdateAppointment,
  PregnancyUpdateRiskLevel, PregnancyUpdateReferralRecommendation
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge, ComplianceBadge, ReferralBadge } from "@/components/ui/status-badges";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, X, Save, Plus, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const RISK_FACTORS_G1 = [
  "تعدد الأجنة", "عمر الأم فوق 40", "عمر الأم أقل من 16",
  "BMI 35 أو أكثر", "حمل IVF", "مدخنة",
  "نتائج فحص الفصل الأول إيجابية",
  "3 إجهاضات أو أكثر", "ولادة مبكرة سابقة", "وفاة جنينية سابقة",
  "عملية قيصرية سابقة", "سوابق تسمم الحمل", "جلطات وريدية سابقة",
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

type EditForm = {
  visitDate: string;
  lmpDate: string;
  gestationalAge: string;
  riskLevel: string;
  referralRecommendation: string;
  riskFactors: string[];
  pregnancyRiskFactors: string[];
  medicalConditions: string[];
  medications: string;
  isVteHighRisk: boolean;
  enoxaparinPrescribed: boolean;
  referralExplained: boolean | null;
  doctorName: string;
  referredHospitalId: string;
  appointmentDate: string;
  notes: string;
  followUpNotes: string;
};

export default function PregnancyDetail() {
  const { id } = useParams();
  const pregnancyId = Number(id);
  const { t } = useI18n();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  const { data: detail, isLoading, refetch } = useGetPregnancy(pregnancyId, {
    query: { queryKey: ["pregnancy", pregnancyId], enabled: !!pregnancyId }
  });

  const { data: hospitals } = useListHospitals();
  const updatePregnancy = useUpdatePregnancy();
  const createAppointmentMutation = useCreateAppointment();
  const updateAppointmentMutation = useUpdateAppointment();

  // ── Attendance dialog state ────────────────────────────────────────────
  const [attendDlg, setAttendDlg] = useState<{
    open: boolean;
    appointmentId: number | null;
    attended: boolean;
    note: string;
  }>({ open: false, appointmentId: null, attended: true, note: "" });

  // ── Add appointment form state ────────────────────────────────────────
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [newAppt, setNewAppt] = useState({ date: "", hospitalId: "" });

  function openAttendDlg(apptId: number, attended: boolean) {
    setAttendDlg({ open: true, appointmentId: apptId, attended, note: "" });
  }

  function saveAttendance() {
    if (attendDlg.appointmentId == null) return;
    updateAppointmentMutation.mutate(
      { id: attendDlg.appointmentId, data: { attended: attendDlg.attended, attendanceNote: attendDlg.note || null } },
      {
        onSuccess: () => {
          toast({ title: t("appt.updateSuccess") });
          setAttendDlg({ open: false, appointmentId: null, attended: true, note: "" });
          refetch();
        },
        onError: () => toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" }),
      }
    );
  }

  function submitNewAppt() {
    if (!newAppt.date || !newAppt.hospitalId) return;
    createAppointmentMutation.mutate(
      { data: { pregnancyId, hospitalId: Number(newAppt.hospitalId), appointmentDate: newAppt.date } },
      {
        onSuccess: () => {
          toast({ title: t("appt.addSuccess") });
          setShowAddAppt(false);
          setNewAppt({ date: "", hospitalId: "" });
          refetch();
        },
        onError: () => toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" }),
      }
    );
  }

  const [form, setForm] = useState<EditForm>({
    visitDate: "", lmpDate: "", gestationalAge: "", riskLevel: "", referralRecommendation: "",
    riskFactors: [], pregnancyRiskFactors: [], medicalConditions: [],
    medications: "", isVteHighRisk: false, enoxaparinPrescribed: false,
    referralExplained: null, doctorName: "", referredHospitalId: "",
    appointmentDate: "", notes: "", followUpNotes: "",
  });

  function startEdit() {
    if (!detail) return;
    const { pregnancy } = detail;
    setForm({
      visitDate: pregnancy.visitDate ?? "",
      lmpDate: pregnancy.lmpDate ?? "",
      gestationalAge: pregnancy.gestationalAge != null ? String(pregnancy.gestationalAge) : "",
      riskLevel: pregnancy.riskLevel ?? "",
      referralRecommendation: pregnancy.referralRecommendation ?? "",
      riskFactors: pregnancy.riskFactors ?? [],
      pregnancyRiskFactors: pregnancy.pregnancyRiskFactors ?? [],
      medicalConditions: pregnancy.medicalConditions ?? [],
      medications: pregnancy.medications ?? "",
      isVteHighRisk: pregnancy.isVteHighRisk ?? false,
      enoxaparinPrescribed: pregnancy.enoxaparinPrescribed ?? false,
      referralExplained: pregnancy.referralExplained ?? null,
      doctorName: pregnancy.doctorName ?? "",
      referredHospitalId: pregnancy.referredHospitalId ? String(pregnancy.referredHospitalId) : "",
      appointmentDate: pregnancy.appointmentDate ?? "",
      notes: pregnancy.notes ?? "",
      followUpNotes: pregnancy.followUpNotes ?? "",
    });
    setEditMode(true);
  }

  function cancelEdit() { setEditMode(false); }

  function toggleInArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function saveEdit() {
    updatePregnancy.mutate(
      {
        id: pregnancyId,
        data: {
          visitDate: form.visitDate || undefined,
          lmpDate: form.lmpDate || null,
          gestationalAge: form.gestationalAge ? Number(form.gestationalAge) : null,
          riskLevel: form.riskLevel as PregnancyUpdateRiskLevel || undefined,
          referralRecommendation: form.referralRecommendation as PregnancyUpdateReferralRecommendation || undefined,
          riskFactors: form.riskFactors,
          pregnancyRiskFactors: form.pregnancyRiskFactors,
          medicalConditions: form.medicalConditions,
          medications: form.medications || null,
          isVteHighRisk: form.isVteHighRisk,
          enoxaparinPrescribed: form.enoxaparinPrescribed,
          referralExplained: form.referralExplained,
          doctorName: form.doctorName || null,
          referredHospitalId: form.referredHospitalId ? Number(form.referredHospitalId) : null,
          appointmentDate: form.appointmentDate || null,
          notes: form.notes || null,
          followUpNotes: form.followUpNotes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("general.saved"), description: t("general.saveSuccess") });
          setEditMode(false);
          refetch();
        },
        onError: () => {
          toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" });
        },
      }
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!detail) return <div>لم يتم العثور على الحالة</div>;

  const { pregnancy, patient, appointments } = detail;
  const p = pregnancy;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("pregnancy.caseDetails")}</h1>
          {patient && (
            <Link href={`/patients/${patient.id}`} className="text-primary hover:underline text-sm">
              {patient.nameAr} — {patient.nationalId}
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button onClick={saveEdit} disabled={updatePregnancy.isPending}>
                <Save className="w-4 h-4 ms-2" />
                {t("general.save")}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 ms-2" />
                {t("general.cancel")}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="w-4 h-4 ms-2" />
              {t("pregnancy.editCase")}
            </Button>
          )}
        </div>
      </div>

      {/* Patient summary */}
      {patient && (
        <Card className="bg-muted/40">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">{t("patients.name")}: </span><span className="font-medium">{patient.nameAr}</span></div>
              <div><span className="text-muted-foreground">{t("patients.nationalId")}: </span><span className="font-medium" dir="ltr">{patient.nationalId}</span></div>
              <div><span className="text-muted-foreground">{t("patients.age")}: </span><span className="font-medium">{patient.age != null ? `${patient.age} سنة` : "—"}</span></div>
              <div><span className="text-muted-foreground">{t("patients.phone")}: </span><span className="font-medium" dir="ltr">{patient.phone}</span></div>
              {patient.doctorPhone && (
                <div><span className="text-muted-foreground">{t("patients.doctorPhone")}: </span><span className="font-medium" dir="ltr">{patient.doctorPhone}</span></div>
              )}
              {patient.address && (
                <div><span className="text-muted-foreground">{t("patients.address")}: </span><span className="font-medium">{patient.address}</span></div>
              )}
              <div><span className="text-muted-foreground">{t("patients.sector")}: </span><span className="font-medium">{patient.sectorNameAr ?? "—"}</span></div>
              <div><span className="text-muted-foreground">{t("patients.healthCenter")}: </span><span className="font-medium">{patient.healthCenterNameAr ?? "—"}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Row */}
      {!editMode && (
        <div className="flex flex-wrap gap-2">
          <RiskBadge level={p.riskLevel} />
          <ComplianceBadge status={p.compliance} />
          <ReferralBadge recommendation={p.referralRecommendation} />
          {p.isVteHighRisk && <Badge variant="destructive">VTE عالي الخطورة</Badge>}
          {p.enoxaparinPrescribed && <Badge className="bg-blue-100 text-blue-800">Enoxaparin موصوف</Badge>}
          {p.referralExplained === true && <Badge className="bg-green-100 text-green-800">الإحالة مُوضَّحة ✓</Badge>}
          {p.referralExplained === false && <Badge className="bg-red-100 text-red-800">الإحالة غير مُوضَّحة</Badge>}
        </div>
      )}

      {/* Main form */}
      <Card>
        <CardHeader><CardTitle>بيانات الزيارة</CardTitle></CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("pregnancy.visitDate")}><Input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} /></Field>
              <Field label={t("pregnancy.lmpDate")}><Input type="date" value={form.lmpDate} onChange={e => setForm(f => ({ ...f, lmpDate: e.target.value }))} /></Field>
              <Field label={t("pregnancy.gestationalAge")}><Input type="number" min={0} max={45} value={form.gestationalAge} onChange={e => setForm(f => ({ ...f, gestationalAge: e.target.value }))} placeholder="أسبوع" /></Field>
              <Field label={t("pregnancy.riskLevel")}>
                <Select value={form.riskLevel} onValueChange={v => setForm(f => ({ ...f, riskLevel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map(l => <SelectItem key={l} value={l}>{t(`risk.${l}` as any)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("pregnancy.doctorName")}><Input value={form.doctorName} onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <InfoRow label={t("pregnancy.visitDate")} value={p.visitDate ? new Date(p.visitDate).toLocaleDateString("ar-SA") : "—"} />
              <InfoRow label={t("pregnancy.lmpDate")} value={p.lmpDate ? new Date(p.lmpDate).toLocaleDateString("ar-SA") : "—"} />
              <InfoRow label={t("pregnancy.gestationalAge")} value={p.gestationalAge != null ? `${p.gestationalAge} أسبوع` : "—"} />
              <InfoRow label={t("pregnancy.riskLevel")} value={t(`risk.${p.riskLevel}` as any)} />
              <InfoRow label={t("pregnancy.doctorName")} value={p.doctorName ?? "—"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Factors G1 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pregnancy.riskFactors")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("pregnancy.riskFactorsDesc")}</p>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {RISK_FACTORS_G1.map(f => (
                <label key={f} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted">
                  <Checkbox checked={form.riskFactors.includes(f)} onCheckedChange={() => setForm(prev => ({ ...prev, riskFactors: toggleInArray(prev.riskFactors, f) }))} />
                  <span className="text-sm">{f}</span>
                </label>
              ))}
            </div>
          ) : (
            <BadgeList items={p.riskFactors ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Risk Factors G2 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pregnancy.pregnancyRiskFactors")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("pregnancy.pregnancyRiskFactorsDesc")}</p>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {RISK_FACTORS_G2.map(f => (
                <label key={f} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted">
                  <Checkbox checked={form.pregnancyRiskFactors.includes(f)} onCheckedChange={() => setForm(prev => ({ ...prev, pregnancyRiskFactors: toggleInArray(prev.pregnancyRiskFactors, f) }))} />
                  <span className="text-sm">{f}</span>
                </label>
              ))}
            </div>
          ) : (
            <BadgeList items={p.pregnancyRiskFactors ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Medical Conditions G3 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pregnancy.medicalConditions")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("pregnancy.medicalConditionsDesc")}</p>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {RISK_FACTORS_G3.map(f => (
                <label key={f} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted">
                  <Checkbox checked={form.medicalConditions.includes(f)} onCheckedChange={() => setForm(prev => ({ ...prev, medicalConditions: toggleInArray(prev.medicalConditions, f) }))} />
                  <span className="text-sm">{f}</span>
                </label>
              ))}
            </div>
          ) : (
            <BadgeList items={p.medicalConditions ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Medications + VTE + Referral */}
      <Card>
        <CardHeader><CardTitle>الأدوية والإحالة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <>
              <Field label={t("pregnancy.medications")}>
                <p className="text-xs text-muted-foreground mb-1">{t("pregnancy.medicationsDesc")}</p>
                <Textarea value={form.medications} onChange={e => setForm(f => ({ ...f, medications: e.target.value }))} rows={2} placeholder="اذكر الدواء إن وُجد..." />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted">
                  <Checkbox checked={form.isVteHighRisk} onCheckedChange={v => setForm(f => ({ ...f, isVteHighRisk: !!v }))} />
                  <span className="text-sm font-medium">{t("pregnancy.isVteHighRisk")}</span>
                </label>
                <label className="flex items-center gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted">
                  <Checkbox checked={form.enoxaparinPrescribed} onCheckedChange={v => setForm(f => ({ ...f, enoxaparinPrescribed: !!v }))} />
                  <span className="text-sm font-medium">{t("pregnancy.enoxaparinPrescribed")}</span>
                </label>
              </div>
              <Field label={t("pregnancy.referralRecommendation")}>
                <Select value={form.referralRecommendation} onValueChange={v => setForm(f => ({ ...f, referralRecommendation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["follow_at_center","follow_at_hospital","transfer_kfch"].map(r => (
                      <SelectItem key={r} value={r}>{t(`referral.${r}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("pregnancy.referralExplained")}>
                <Select
                  value={form.referralExplained === true ? "yes" : form.referralExplained === false ? "no" : ""}
                  onValueChange={v => setForm(f => ({ ...f, referralExplained: v === "yes" ? true : v === "no" ? false : null }))}
                >
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">{t("pregnancy.yes")}</SelectItem>
                    <SelectItem value="no">{t("pregnancy.no")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("pregnancy.referredHospital")}>
                  <Select value={form.referredHospitalId} onValueChange={v => setForm(f => ({ ...f, referredHospitalId: v }))}>
                    <SelectTrigger><SelectValue placeholder="اختر المستشفى" /></SelectTrigger>
                    <SelectContent>
                      {hospitals?.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.nameAr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("pregnancy.appointmentDate")}>
                  <Input type="date" value={form.appointmentDate} onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))} />
                </Field>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <InfoRow label={t("pregnancy.medications")} value={p.medications ?? "—"} />
              <InfoRow label={t("pregnancy.isVteHighRisk")} value={p.isVteHighRisk ? "نعم" : "لا"} />
              <InfoRow label={t("pregnancy.enoxaparinPrescribed")} value={p.enoxaparinPrescribed ? "نعم" : "لا"} />
              <InfoRow label={t("pregnancy.referralExplained")} value={p.referralExplained === true ? "نعم" : p.referralExplained === false ? "لا" : "—"} />
              <InfoRow label={t("pregnancy.referralRecommendation")} value={t(`referral.${p.referralRecommendation}` as any)} />
              <InfoRow label={t("pregnancy.referredHospital")} value={p.referredHospitalNameAr ?? "—"} />
              <InfoRow label={t("pregnancy.appointmentDate")} value={p.appointmentDate ? new Date(p.appointmentDate).toLocaleDateString("ar-SA") : "—"} />
              <InfoRow label={t("pregnancy.compliance")} value={t(`compliance.${p.compliance}` as any)} />
              {p.workingDaysToAppointment != null && (
                <InfoRow label="أيام العمل للموعد" value={`${p.workingDaysToAppointment} يوم`} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>الملاحظات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <>
              <Field label={t("pregnancy.notes")}>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="ملاحظات عامة..." />
              </Field>
              <Field label={t("pregnancy.followUpNotes")}>
                <Textarea value={form.followUpNotes} onChange={e => setForm(f => ({ ...f, followUpNotes: e.target.value }))} rows={2} placeholder="استجابات تواصل المراجعة..." />
              </Field>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <InfoRow label={t("pregnancy.notes")} value={p.notes ?? "—"} />
              <InfoRow label={t("pregnancy.followUpNotes")} value={p.followUpNotes ?? "—"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("appt.appointmentsTitle")}</CardTitle>
            <Button
              size="sm"
              variant="outline"
              style={{ borderColor: "#006633", color: "#006633" }}
              onClick={() => setShowAddAppt(v => !v)}
            >
              <Plus className="w-4 h-4 ms-1" />
              {t("appt.addAppointment")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Add appointment inline form ── */}
          {showAddAppt && (
            <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/30" style={{ borderColor: "#006633" }}>
              <p className="text-sm font-medium" style={{ color: "#006633" }}>{t("appt.addAppointment")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("pregnancy.appointmentDate")}</Label>
                  <Input
                    type="date"
                    value={newAppt.date}
                    onChange={e => setNewAppt(v => ({ ...v, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("pregnancy.referredHospital")}</Label>
                  <Select value={newAppt.hospitalId} onValueChange={v => setNewAppt(prev => ({ ...prev, hospitalId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("appt.selectHospital")} />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals?.map(h => (
                        <SelectItem key={h.id} value={String(h.id)}>{h.nameAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  style={{ background: "#006633", color: "#fff" }}
                  onClick={submitNewAppt}
                  disabled={createAppointmentMutation.isPending || !newAppt.date || !newAppt.hospitalId}
                >
                  <Save className="w-4 h-4 ms-1" />
                  {t("general.save")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowAddAppt(false); setNewAppt({ date: "", hospitalId: "" }); }}>
                  <X className="w-4 h-4 ms-1" />
                  {t("general.cancel")}
                </Button>
              </div>
            </div>
          )}

          {/* ── Appointments table ── */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pregnancy.appointmentDate")}</TableHead>
                <TableHead>{t("pregnancy.referredHospital")}</TableHead>
                <TableHead>{t("pregnancy.attendance")}</TableHead>
                <TableHead>{t("pregnancy.attendanceNote")}</TableHead>
                <TableHead className="w-[160px]">{t("general.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!appointments || appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    {t("general.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map(apt => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-medium">
                      {new Date(apt.appointmentDate).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell>{apt.hospitalNameAr ?? "—"}</TableCell>
                    <TableCell>
                      {apt.attended === true ? (
                        <Badge className="bg-green-100 text-green-800">✅ {t("appt.attended")}</Badge>
                      ) : apt.attended === false ? (
                        <Badge className="bg-red-100 text-red-800">❌ {t("appt.absent")}</Badge>
                      ) : (
                        <Badge variant="outline">⏳ {t("appt.scheduled")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{apt.attendanceNote ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {apt.attended !== true && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-600 text-green-700 hover:bg-green-50"
                            onClick={() => openAttendDlg(apt.id, true)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 ms-1" />
                            {t("appt.registerAttendance")}
                          </Button>
                        )}
                        {apt.attended !== false && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-red-500 text-red-600 hover:bg-red-50"
                            onClick={() => openAttendDlg(apt.id, false)}
                          >
                            <XCircle className="w-3.5 h-3.5 ms-1" />
                            {t("appt.registerAbsence")}
                          </Button>
                        )}
                        {apt.attended !== null && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            title="إعادة تعيين"
                            onClick={() => updateAppointmentMutation.mutate(
                              { id: apt.id, data: { attended: null, attendanceNote: null } },
                              {
                              onSuccess: () => { toast({ title: t("appt.resetSuccess") }); refetch(); },
                              onError: () => toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" }),
                            }
                            )}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Attendance Dialog ── */}
      <Dialog open={attendDlg.open} onOpenChange={open => setAttendDlg(v => ({ ...v, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("appt.attendanceDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <button
                onClick={() => setAttendDlg(v => ({ ...v, attended: true }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                  attendDlg.attended
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-muted hover:border-green-300"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {t("appt.attended")}
              </button>
              <button
                onClick={() => setAttendDlg(v => ({ ...v, attended: false }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                  !attendDlg.attended
                    ? "border-red-500 bg-red-50 text-red-600"
                    : "border-muted hover:border-red-300"
                }`}
              >
                <XCircle className="w-5 h-5" />
                {t("appt.registerAbsence")}
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("pregnancy.attendanceNote")}</Label>
              <Textarea
                rows={3}
                placeholder={t("appt.attendanceNotePlaceholder")}
                value={attendDlg.note}
                onChange={e => setAttendDlg(v => ({ ...v, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAttendDlg(v => ({ ...v, open: false }))}
            >
              {t("general.cancel")}
            </Button>
            <Button
              style={{ background: "#006633", color: "#fff" }}
              onClick={saveAttendance}
              disabled={updateAppointmentMutation.isPending}
            >
              <Save className="w-4 h-4 ms-1" />
              {t("appt.saveAttendance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BadgeList({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">لا يوجد</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <Badge key={i} variant="outline" className="text-sm py-1">{item}</Badge>
      ))}
    </div>
  );
}
