import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import {
  useListAppointments,
  useUpdateAppointment,
  useListSectors,
} from "@workspace/api-client-react";
import type { Appointment } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck2, CalendarX2, Clock, ExternalLink, CalendarDays, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListAppointmentsQueryKey } from "@workspace/api-client-react";

type DateFilter = "today" | "week" | "all";
type StatusFilter = "all" | "scheduled" | "attended" | "absent";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(filter: DateFilter): { start: string; end: string } | null {
  const now = new Date();
  const todayStr = localDateStr(now);

  if (filter === "today") {
    return { start: todayStr, end: todayStr };
  }
  if (filter === "week") {
    // Saudi business week: Sun–Thu. Start week on Sunday.
    const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      start: localDateStr(weekStart),
      end: localDateStr(weekEnd),
    };
  }
  return null;
}

function attendedToStatus(attended: boolean | null | undefined): StatusFilter {
  if (attended === true) return "attended";
  if (attended === false) return "absent";
  return "scheduled";
}

function StatusBadge({ attended }: { attended: boolean | null | undefined }) {
  const { t } = useI18n();
  if (attended === true) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
        ✅ {t("appt.attended")}
      </Badge>
    );
  }
  if (attended === false) {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
        ❌ {t("appt.absent")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
      ⏳ {t("appt.scheduled")}
    </Badge>
  );
}

function formatDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function attendedLabel(attended: boolean | null | undefined, lang: string): string {
  if (attended === true) return lang === "ar" ? "حضر" : "Attended";
  if (attended === false) return lang === "ar" ? "غائب" : "Absent";
  return lang === "ar" ? "مجدول" : "Scheduled";
}

function exportAppointmentsToCsv(
  rows: Appointment[],
  lang: string,
  headers: { patient: string; nationalId: string; sector: string; hospital: string; date: string; status: string; note: string }
) {
  const cols = [
    headers.patient,
    headers.nationalId,
    headers.sector,
    headers.hospital,
    headers.date,
    headers.status,
    headers.note,
  ];

  const escape = (val: string | null | undefined) => {
    const s = val ?? "";
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [cols.map(escape).join(",")];
  for (const row of rows) {
    lines.push(
      [
        escape(row.patientNameAr),
        escape(row.patientNationalId),
        escape(row.sectorNameAr),
        escape(row.hospitalNameAr),
        escape(row.appointmentDate),
        escape(attendedLabel(row.attended, lang)),
        escape(row.attendanceNote),
      ].join(",")
    );
  }

  const BOM = "\uFEFF";
  const csvContent = BOM + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `appointments-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type AttendanceDialogState = {
  appointment: Appointment;
  marking: "attended" | "absent";
} | null;

export default function AppointmentsPage() {
  const { t, lang } = useI18n();
  const { canWrite } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [dialogState, setDialogState] = useState<AttendanceDialogState>(null);
  const [attendanceNote, setAttendanceNote] = useState("");

  const { data: appointments, isLoading } = useListAppointments();
  const { data: sectors } = useListSectors();
  const updateMutation = useUpdateAppointment();

  const filtered = useMemo(() => {
    if (!appointments) return [];
    let list = [...appointments];

    const range = getDateRange(dateFilter);
    if (range) {
      list = list.filter((a) => a.appointmentDate >= range.start && a.appointmentDate <= range.end);
    }

    if (statusFilter !== "all") {
      list = list.filter((a) => attendedToStatus(a.attended) === statusFilter);
    }

    if (sectorFilter !== "all") {
      list = list.filter((a) => String(a.sectorId) === sectorFilter);
    }

    return list;
  }, [appointments, dateFilter, statusFilter, sectorFilter]);

  const handleMarkAttendance = (appt: Appointment, marking: "attended" | "absent") => {
    setDialogState({ appointment: appt, marking });
    setAttendanceNote(appt.attendanceNote ?? "");
  };

  const handleSaveAttendance = () => {
    if (!dialogState) return;
    const attended = dialogState.marking === "attended";
    updateMutation.mutate(
      {
        id: dialogState.appointment.id,
        data: { attended, attendanceNote: attendanceNote || null },
      },
      {
        onSuccess: () => {
          toast({ title: t("appt.updateSuccess") });
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          setDialogState(null);
          setAttendanceNote("");
        },
        onError: () => {
          toast({ title: t("general.saveError"), variant: "destructive" });
        },
      }
    );
  };

  const todayStr = localDateStr(new Date());
  const isPast = (dateStr: string) => dateStr < todayStr;

  const statsScheduled = filtered.filter((a) => a.attended === null).length;
  const statsAttended = filtered.filter((a) => a.attended === true).length;
  const statsAbsent = filtered.filter((a) => a.attended === false).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("appointments.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("appointments.subtitle")}</p>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-slate-100">
                <CalendarDays className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("appointments.totalCount")}</p>
                <p className="text-xl font-bold">{filtered.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-50">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("appt.scheduled")}</p>
                <p className="text-xl font-bold text-yellow-700">{statsScheduled}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-50">
                <CalendarCheck2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("appt.attended")}</p>
                <p className="text-xl font-bold text-green-700">{statsAttended}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-50">
                <CalendarX2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("appt.absent")}</p>
                <p className="text-xl font-bold text-red-700">{statsAbsent}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("appointments.filterDate")}</Label>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("appointments.dateToday")}</SelectItem>
                <SelectItem value="week">{t("appointments.dateWeek")}</SelectItem>
                <SelectItem value="all">{t("appointments.dateAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("appointments.filterStatus")}</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("appointments.statusAll")}</SelectItem>
                <SelectItem value="scheduled">{t("appt.scheduled")}</SelectItem>
                <SelectItem value="attended">{t("appt.attended")}</SelectItem>
                <SelectItem value="absent">{t("appt.absent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("filter.sector")}</Label>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.allSectors")}</SelectItem>
                {sectors?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            disabled={filtered.length === 0}
            onClick={() =>
              exportAppointmentsToCsv(filtered, lang, {
                patient: t("appointments.colPatient"),
                nationalId: t("appointments.colNationalId"),
                sector: t("appointments.colSector"),
                hospital: t("appointments.colHospital"),
                date: t("appointments.colDate"),
                status: t("appointments.colStatus"),
                note: t("appointments.colAttendanceNote"),
              })
            }
          >
            <Download className="w-4 h-4" />
            {t("appointments.exportCsv")}
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {filtered.length} {t("filter.results")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{t("appointments.noData")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("appointments.colPatient")}</TableHead>
                    <TableHead>{t("appointments.colNationalId")}</TableHead>
                    <TableHead>{t("appointments.colSector")}</TableHead>
                    <TableHead>{t("appointments.colHospital")}</TableHead>
                    <TableHead>{t("appointments.colDate")}</TableHead>
                    <TableHead>{t("appointments.colStatus")}</TableHead>
                    <TableHead className="text-center">{t("appointments.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((appt) => {
                    const past = isPast(appt.appointmentDate);
                    return (
                      <TableRow
                        key={appt.id}
                        className={past && appt.attended === null ? "bg-red-50/40" : ""}
                      >
                        <TableCell className="font-medium">
                          {appt.patientNameAr ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {appt.patientNationalId ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {appt.sectorNameAr ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {appt.hospitalNameAr ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(appt.appointmentDate, lang)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge attended={appt.attended} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {canWrite && appt.attended !== true && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => handleMarkAttendance(appt, "attended")}
                              >
                                ✅ {t("appt.registerAttendance")}
                              </Button>
                            )}
                            {canWrite && appt.attended !== false && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => handleMarkAttendance(appt, "absent")}
                              >
                                ❌ {t("appt.registerAbsence")}
                              </Button>
                            )}
                            <Link href={`/pregnancies/${appt.pregnancyId}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {t("appointments.viewCase")}
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Dialog */}
      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("appt.attendanceDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dialogState && (
              <div className="text-sm space-y-1">
                <p className="font-medium">{dialogState.appointment.patientNameAr}</p>
                <p className="text-muted-foreground">
                  {formatDate(dialogState.appointment.appointmentDate, lang)} — {dialogState.appointment.hospitalNameAr}
                </p>
                <Badge
                  className={
                    dialogState.marking === "attended"
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-red-100 text-red-800 border-red-200"
                  }
                >
                  {dialogState.marking === "attended" ? `✅ ${t("appt.attended")}` : `❌ ${t("appt.absent")}`}
                </Badge>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-sm">{t("pregnancy.attendanceNote")}</Label>
              <Textarea
                value={attendanceNote}
                onChange={(e) => setAttendanceNote(e.target.value)}
                placeholder={t("appt.attendanceNotePlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogState(null)}>
              {t("general.cancel")}
            </Button>
            <Button
              onClick={handleSaveAttendance}
              disabled={updateMutation.isPending}
              style={{ background: "#006633" }}
              className="text-white"
            >
              {t("appt.saveAttendance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
