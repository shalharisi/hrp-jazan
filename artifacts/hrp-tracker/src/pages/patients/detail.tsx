import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import {
  useGetPatient,
  useListPregnancies,
  useUpdatePatient,
  useListSectors,
  useListHealthCenters,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, X, Save, User, MapPin, Phone, Calendar, Stethoscope } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiskBadge, ComplianceBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";

export default function PatientDetail() {
  const { id } = useParams();
  const patientId = Number(id);
  const { t } = useI18n();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  const {
    data: patient,
    isLoading: loadingPatient,
    refetch,
  } = useGetPatient(patientId, {
    query: { queryKey: ["patient", patientId], enabled: !!patientId },
  });

  const { data: pregnancies, isLoading: loadingPregnancies } = useListPregnancies(
    { patientId },
    { query: { queryKey: ["pregnancies", patientId], enabled: !!patientId } },
  );

  const { data: sectors } = useListSectors();
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);

  const sectorId = selectedSectorId ?? patient?.sectorId ?? null;
  const { data: healthCenters } = useListHealthCenters(
    { sectorId: sectorId ? Number(sectorId) : undefined },
    { query: { queryKey: ["health-centers", sectorId], enabled: !!sectorId } },
  );

  const updatePatient = useUpdatePatient();

  const [form, setForm] = useState({
    nameAr: "",
    dateOfBirth: "",
    phone: "",
    doctorPhone: "",
    address: "",
    healthCenterId: 0,
  });

  function startEdit() {
    if (!patient) return;
    setForm({
      nameAr: patient.nameAr ?? "",
      dateOfBirth: patient.dateOfBirth ?? "",
      phone: patient.phone ?? "",
      doctorPhone: patient.doctorPhone ?? "",
      address: patient.address ?? "",
      healthCenterId: patient.healthCenterId ?? 0,
    });
    setSelectedSectorId(patient.sectorId ?? null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSelectedSectorId(null);
  }

  function saveEdit() {
    updatePatient.mutate(
      {
        id: patientId,
        data: {
          nameAr: form.nameAr || undefined,
          dateOfBirth: form.dateOfBirth || null,
          phone: form.phone || undefined,
          doctorPhone: form.doctorPhone || null,
          address: form.address || null,
          healthCenterId: form.healthCenterId || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("general.saved"), description: t("general.saveSuccess") });
          setEditMode(false);
          setSelectedSectorId(null);
          refetch();
        },
        onError: () => {
          toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" });
        },
      },
    );
  }

  if (loadingPatient) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!patient) {
    return <div>لم يتم العثور على المريضة</div>;
  }

  const dobFormatted = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString("ar-SA")
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">{patient.nameAr}</h1>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button onClick={saveEdit} disabled={updatePatient.isPending}>
                <Save className="w-4 h-4 ms-2" />
                {t("general.save")}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 ms-2" />
                {t("general.cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEdit}>
                <Pencil className="w-4 h-4 ms-2" />
                {t("patients.editPatient")}
              </Button>
              <Link href={`/pregnancies/new?patientId=${patient.id}`}>
                <Button>
                  <Plus className="w-4 h-4 ms-2" />
                  {t("patients.addCase")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t("patients.patientInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("patients.nationalId")}</Label>
                <Input value={patient.nationalId} disabled dir="ltr" className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.name")}</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.dateOfBirth")}</Label>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.age")}</Label>
                <Input
                  value={patient.age != null ? `${patient.age} سنة` : "—"}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.doctorPhone")}</Label>
                <Input
                  value={form.doctorPhone}
                  onChange={(e) => setForm((f) => ({ ...f, doctorPhone: e.target.value }))}
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.address")}</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("patients.sector")}</Label>
                <Select
                  value={
                    selectedSectorId
                      ? String(selectedSectorId)
                      : patient.sectorId
                        ? String(patient.sectorId)
                        : undefined
                  }
                  onValueChange={(v) => {
                    setSelectedSectorId(Number(v));
                    setForm((f) => ({ ...f, healthCenterId: 0 }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القطاع" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("patients.healthCenter")}</Label>
                <Select
                  value={form.healthCenterId ? String(form.healthCenterId) : undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, healthCenterId: Number(v) }))}
                  disabled={!sectorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المركز الصحي" />
                  </SelectTrigger>
                  <SelectContent>
                    {healthCenters?.map((hc) => (
                      <SelectItem key={hc.id} value={String(hc.id)}>
                        {hc.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoRow
                icon={<User className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.nationalId")}
                value={patient.nationalId}
                dir="ltr"
              />
              <InfoRow
                icon={<User className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.name")}
                value={patient.nameAr}
              />
              <InfoRow
                icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.dateOfBirth")}
                value={dobFormatted ?? "—"}
              />
              <InfoRow
                icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.age")}
                value={patient.age != null ? `${patient.age} سنة` : "—"}
              />
              <InfoRow
                icon={<Phone className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.phone")}
                value={patient.phone}
                dir="ltr"
              />
              <InfoRow
                icon={<Stethoscope className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.doctorPhone")}
                value={patient.doctorPhone ?? "—"}
                dir="ltr"
              />
              <InfoRow
                icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.address")}
                value={patient.address ?? "—"}
              />
              <InfoRow
                icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.sector")}
                value={patient.sectorNameAr ?? "—"}
              />
              <InfoRow
                icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
                label={t("patients.healthCenter")}
                value={patient.healthCenterNameAr ?? "—"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("patients.pregnancyCases")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pregnancy.visitDate")}</TableHead>
                <TableHead>{t("pregnancy.gestationalAge")}</TableHead>
                <TableHead>{t("pregnancy.riskLevel")}</TableHead>
                <TableHead>{t("pregnancy.compliance")}</TableHead>
                <TableHead>{t("general.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPregnancies ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              ) : pregnancies?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t("general.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                pregnancies?.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.visitDate).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell>
                      {p.gestationalAge != null ? `${p.gestationalAge} أسبوع` : "—"}
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={p.riskLevel} />
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge status={p.compliance} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/pregnancies/${p.id}`} className="text-primary hover:underline">
                        عرض التفاصيل
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-medium" dir={dir}>
        {value}
      </span>
    </div>
  );
}
