import React, { useState, useMemo, useEffect, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck2, CalendarX2, Clock, ExternalLink, CalendarDays, Download, AlertCircle, Printer, X } from "lucide-react";
import { RiskBadge } from "@/components/ui/status-badges";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListAppointmentsQueryKey } from "@workspace/api-client-react";

type DateFilter = "today" | "week" | "all" | "custom";
type StatusFilter = "all" | "scheduled" | "attended" | "absent" | "needs_action";
type RiskFilter = "all" | "critical" | "high" | "medium" | "low";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(
  filter: DateFilter,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } | null {
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
  if (filter === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
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

function buildExportFilename(
  dateFilter: DateFilter,
  statusFilter: StatusFilter,
  sectorName: string | null,
  riskFilter: RiskFilter,
  customStart?: string,
  customEnd?: string
): string {
  const today = localDateStr(new Date());
  const parts: string[] = ["appointments"];
  if (dateFilter === "custom" && customStart && customEnd) {
    parts.push(customStart, customEnd);
  } else if (dateFilter !== "all") {
    parts.push(dateFilter);
  }
  if (statusFilter !== "all") parts.push(statusFilter.replace(/_/g, "-"));
  if (riskFilter !== "all") parts.push(riskFilter);
  if (sectorName) parts.push("sector", sectorName.replace(/\s+/g, "-"));
  parts.push(today);
  return `${parts.join("-")}.csv`;
}

function exportAppointmentsToCsv(
  rows: Appointment[],
  lang: string,
  headers: { patient: string; nationalId: string; sector: string; hospital: string; date: string; status: string; note: string },
  dateFilter: DateFilter,
  statusFilter: StatusFilter,
  sectorName: string | null,
  riskFilter: RiskFilter,
  customStart?: string,
  customEnd?: string,
  filterLabels?: {
    dateFieldLabel: string;
    dateValue: string;
    statusFieldLabel: string;
    statusValue: string;
    sectorFieldLabel: string;
    sectorValue: string;
    riskFieldLabel: string;
    riskValue: string;
  }
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

  const lines: string[] = [];

  {
    const exportDate = localDateStr(new Date());
    const base =
      lang === "ar"
        ? `إجمالي السجلات: ${rows.length} – بتاريخ ${exportDate}`
        : `Total records: ${rows.length} as of ${exportDate}`;
    const filterParts = filterLabels
      ? [
          `${filterLabels.dateFieldLabel}: ${filterLabels.dateValue}`,
          `${filterLabels.statusFieldLabel}: ${filterLabels.statusValue}`,
          `${filterLabels.sectorFieldLabel}: ${filterLabels.sectorValue}`,
          `${filterLabels.riskFieldLabel}: ${filterLabels.riskValue}`,
        ]
      : [];
    const summaryLine = filterParts.length > 0 ? `${base} | ${filterParts.join(" | ")}` : base;
    lines.push(escape(summaryLine));
  }

  lines.push(cols.map(escape).join(","));
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
  link.href = url;
  link.download = buildExportFilename(dateFilter, statusFilter, sectorName, riskFilter, customStart, customEnd);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type AttendanceDialogState = {
  appointment: Appointment;
  marking: "attended" | "absent";
} | null;

const DEFAULT_URGENT_THRESHOLD = 5;
const URGENT_THRESHOLD_KEY = "hrp_urgent_threshold";

const DATE_FILTER_KEY = "hrp_appt_date_filter";
const CUSTOM_START_KEY = "hrp_appt_custom_start";
const CUSTOM_END_KEY = "hrp_appt_custom_end";

function getUrgentThreshold(): number {
  const stored = localStorage.getItem(URGENT_THRESHOLD_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_URGENT_THRESHOLD;
}

export default function AppointmentsPage() {
  const { t, lang } = useI18n();
  const { canWrite, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialStatus = useMemo<StatusFilter>(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s === "needs_action" || s === "scheduled" || s === "attended" || s === "absent") return s;
    return "all";
  }, []);

  const dateFilterUrlForced = useRef(initialStatus === "needs_action");

  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    if (initialStatus === "needs_action") return "all";
    try {
      const stored = localStorage.getItem(DATE_FILTER_KEY);
      if (stored === "today" || stored === "week" || stored === "all" || stored === "custom") {
        return stored;
      }
    } catch {
      // ignore
    }
    return "week";
  });
  const [customStart, setCustomStart] = useState<string>(() => {
    try {
      return localStorage.getItem(CUSTOM_START_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    try {
      return localStorage.getItem(CUSTOM_END_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [dialogState, setDialogState] = useState<AttendanceDialogState>(null);
  const [attendanceNote, setAttendanceNote] = useState("");

  const BANNER_STORAGE_KEY = user
    ? `hrp_urgent_banner_dismissed_count_${user.id}`
    : "hrp_urgent_banner_dismissed_count";
  const [dismissedCount, setDismissedCount] = useState<number>(() => {
    if (!user) return 0;
    try {
      const stored = localStorage.getItem(`hrp_urgent_banner_dismissed_count_${user.id}`);
      if (!stored) return 0;
      const parsed = parseInt(stored, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (!user) {
      setDismissedCount(0);
      return;
    }
    try {
      const stored = localStorage.getItem(BANNER_STORAGE_KEY);
      if (!stored) {
        setDismissedCount(0);
        return;
      }
      const parsed = parseInt(stored, 10);
      if (Number.isFinite(parsed)) {
        setDismissedCount(parsed);
      }
    } catch {
      // ignore
    }
  }, [user, BANNER_STORAGE_KEY]);

  const dismissBanner = (count: number) => {
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, String(count));
    } catch {
      // ignore
    }
    setDismissedCount(count);
  };

  useEffect(() => {
    if (dateFilterUrlForced.current) {
      dateFilterUrlForced.current = false;
      return;
    }
    try {
      localStorage.setItem(DATE_FILTER_KEY, dateFilter);
    } catch {
      // ignore
    }
  }, [dateFilter]);

  useEffect(() => {
    try {
      if (customStart) {
        localStorage.setItem(CUSTOM_START_KEY, customStart);
      } else {
        localStorage.removeItem(CUSTOM_START_KEY);
      }
    } catch {
      // ignore
    }
  }, [customStart]);

  useEffect(() => {
    try {
      if (customEnd) {
        localStorage.setItem(CUSTOM_END_KEY, customEnd);
      } else {
        localStorage.removeItem(CUSTOM_END_KEY);
      }
    } catch {
      // ignore
    }
  }, [customEnd]);

  const { data: appointments, isLoading } = useListAppointments();
  const { data: sectors } = useListSectors();
  const updateMutation = useUpdateAppointment();

  const filtered = useMemo(() => {
    if (!appointments) return [];
    let list = [...appointments];

    const range = getDateRange(dateFilter, customStart, customEnd);
    if (range) {
      list = list.filter((a) => a.appointmentDate >= range.start && a.appointmentDate <= range.end);
    }

    if (statusFilter === "needs_action") {
      const today = localDateStr(new Date());
      list = list.filter((a) => a.appointmentDate < today && a.attended === null);
    } else if (statusFilter !== "all") {
      list = list.filter((a) => attendedToStatus(a.attended) === statusFilter);
    }

    if (sectorFilter !== "all") {
      list = list.filter((a) => String(a.sectorId) === sectorFilter);
    }

    if (riskFilter !== "all") {
      list = list.filter((a) => a.riskLevel === riskFilter);
    }

    return list;
  }, [appointments, dateFilter, customStart, customEnd, statusFilter, sectorFilter, riskFilter]);

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

  const needsActionRows = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => a.appointmentDate < todayStr && a.attended === null);
  }, [appointments, todayStr]);

  const statsNeedsAction = needsActionRows.length;

  const dateFilterLabel = (() => {
    if (dateFilter === "today") return t("appointments.dateToday");
    if (dateFilter === "week") return t("appointments.dateWeek");
    if (dateFilter === "custom") {
      if (customStart && customEnd) return `${customStart} – ${customEnd}`;
      return t("appointments.dateCustom");
    }
    return t("appointments.dateAll");
  })();

  const statusFilterLabel = (() => {
    if (statusFilter === "needs_action") return t("appointments.statusNeedsAction");
    if (statusFilter === "attended") return t("appt.attended");
    if (statusFilter === "absent") return t("appt.absent");
    if (statusFilter === "scheduled") return t("appt.scheduled");
    return t("appointments.printAll");
  })();

  const sectorFilterLabel = (() => {
    if (sectorFilter !== "all") {
      return sectors?.find((s) => String(s.id) === sectorFilter)?.nameAr ?? sectorFilter;
    }
    return t("appointments.printAll");
  })();

  const riskFilterLabel = (() => {
    if (riskFilter === "critical") return t("risk.critical");
    if (riskFilter === "high") return t("risk.high");
    if (riskFilter === "medium") return t("risk.medium");
    if (riskFilter === "low") return t("risk.low");
    return t("appointments.printAll");
  })();

  const printDate = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgentThreshold = getUrgentThreshold();
  const showUrgentBanner = !isLoading && statsNeedsAction > urgentThreshold && statsNeedsAction > dismissedCount;

  const urgentBannerText = t("appointments.urgentBanner").replace(
    "{count}",
    String(statsNeedsAction)
  );

  return (
    <div className="space-y-6">
      {/* Print-only header — hidden on screen */}
      <div className="print-only border-b pb-3 mb-4">
        <h1 className="text-xl font-bold">{t("appointments.printTitle")}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-gray-600">
          <span>{t("appointments.printFilterDate")}: <strong>{dateFilterLabel}</strong></span>
          <span>{t("appointments.printFilterStatus")}: <strong>{statusFilterLabel}</strong></span>
          <span>{t("appointments.printFilterSector")}: <strong>{sectorFilterLabel}</strong></span>
          <span>{t("appointments.printFilterRisk")}: <strong>{riskFilterLabel}</strong></span>
          <span>{t("appointments.printDate")}: <strong>{printDate}</strong></span>
          <span>{t("appointments.totalCount")}: <strong>{filtered.length}</strong></span>
        </div>
      </div>

      <div className="no-print">
        <h1 className="text-3xl font-bold">{t("appointments.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("appointments.subtitle")}</p>
      </div>

      {/* Urgent follow-up banner */}
      {showUrgentBanner && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-orange-900"
        >
          <AlertCircle className="mt-0.5 w-5 h-5 flex-shrink-0 text-orange-600" aria-hidden="true" />
          <p className="flex-1 text-sm font-medium leading-snug">{urgentBannerText}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-orange-400 text-orange-800 hover:bg-orange-100"
              onClick={() => {
                setStatusFilter("needs_action");
                setDateFilter("all");
                dismissBanner(statsNeedsAction);
              }}
            >
              {t("appointments.urgentBannerAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-orange-400 text-orange-800 hover:bg-orange-100 gap-1"
              onClick={() => {
                const bannerExportRows =
                  sectorFilter !== "all"
                    ? needsActionRows.filter((a) => String(a.sectorId) === sectorFilter)
                    : needsActionRows;
                const bannerSectorName =
                  sectorFilter !== "all"
                    ? (sectors?.find((s) => String(s.id) === sectorFilter)?.nameAr ?? sectorFilter)
                    : null;
                exportAppointmentsToCsv(
                  bannerExportRows,
                  lang,
                  {
                    patient: t("appointments.colPatient"),
                    nationalId: t("appointments.colNationalId"),
                    sector: t("appointments.colSector"),
                    hospital: t("appointments.colHospital"),
                    date: t("appointments.colDate"),
                    status: t("appointments.colStatus"),
                    note: t("appointments.colAttendanceNote"),
                  },
                  "all",
                  "needs_action",
                  bannerSectorName,
                  "all",
                  undefined,
                  undefined,
                  {
                    dateFieldLabel: t("appointments.printFilterDate"),
                    dateValue: t("appointments.dateAll"),
                    statusFieldLabel: t("appointments.printFilterStatus"),
                    statusValue: t("appointments.statusNeedsAction"),
                    sectorFieldLabel: t("appointments.printFilterSector"),
                    sectorValue: sectorFilterLabel,
                    riskFieldLabel: t("appointments.printFilterRisk"),
                    riskValue: t("appointments.printAll"),
                  }
                );
              }}
            >
              <Download className="w-3 h-3" />
              {t("appointments.urgentBannerExport")}
            </Button>
            <button
              type="button"
              aria-label={t("appointments.urgentBannerDismiss")}
              className="rounded p-0.5 hover:bg-orange-100 transition-colors"
              onClick={() => dismissBanner(statsNeedsAction)}
            >
              <X className="w-4 h-4 text-orange-600" />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
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
          <Card
            className={`cursor-pointer transition-colors border-2 ${
              statusFilter === "needs_action"
                ? "border-orange-500 bg-orange-50"
                : "border-transparent hover:border-orange-300 hover:bg-orange-50/50"
            }`}
            onClick={() => {
              setStatusFilter(statusFilter === "needs_action" ? "all" : "needs_action");
              setDateFilter("all");
            }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{t("appointments.needsAction")}</p>
                <p className="text-xl font-bold text-orange-700">{statsNeedsAction}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("appointments.filterDate")}</Label>
            <Select
              value={dateFilter}
              onValueChange={(v) => {
                setDateFilter(v as DateFilter);
                if (v !== "custom") {
                  setCustomStart("");
                  setCustomEnd("");
                }
              }}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("appointments.dateToday")}</SelectItem>
                <SelectItem value="week">{t("appointments.dateWeek")}</SelectItem>
                <SelectItem value="all">{t("appointments.dateAll")}</SelectItem>
                <SelectItem value="custom">{t("appointments.dateCustom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === "custom" && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{t("appointments.dateFrom")}</Label>
                <Input
                  type="date"
                  className="h-9 w-36"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{t("appointments.dateTo")}</Label>
                <Input
                  type="date"
                  className="h-9 w-36"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("appointments.filterStatus")}</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                const next = v as StatusFilter;
                setStatusFilter(next);
                if (next === "needs_action") setDateFilter("all");
              }}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("appointments.statusAll")}</SelectItem>
                <SelectItem value="needs_action">⚠️ {t("appointments.statusNeedsAction")}</SelectItem>
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

          <div className="w-full flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("appointments.filterRisk")}</Label>
            <div className="flex flex-wrap gap-2">
              {(["all", "critical", "high", "medium", "low"] as RiskFilter[]).map((level) => {
                const label =
                  level === "all"
                    ? t("appointments.printAll")
                    : level === "critical"
                    ? t("risk.critical")
                    : level === "high"
                    ? t("risk.high")
                    : level === "medium"
                    ? t("risk.medium")
                    : t("risk.low");
                const colorMap: Record<Exclude<RiskFilter, "all">, string> = {
                  critical: "border-red-500 bg-red-50 text-red-800 hover:bg-red-100",
                  high: "border-orange-500 bg-orange-50 text-orange-800 hover:bg-orange-100",
                  medium: "border-yellow-500 bg-yellow-50 text-yellow-800 hover:bg-yellow-100",
                  low: "border-green-500 bg-green-50 text-green-800 hover:bg-green-100",
                };
                const activeColor =
                  level === "all"
                    ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-800"
                    : colorMap[level];
                const inactiveBase = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
                const isActive = riskFilter === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRiskFilter(level)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                      isActive ? activeColor : inactiveBase
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 no-print"
            disabled={filtered.length === 0}
            onClick={() => {
              const activeSectorName =
                sectorFilter !== "all"
                  ? (sectors?.find((s) => String(s.id) === sectorFilter)?.nameAr ?? null)
                  : null;
              exportAppointmentsToCsv(
                filtered,
                lang,
                {
                  patient: t("appointments.colPatient"),
                  nationalId: t("appointments.colNationalId"),
                  sector: t("appointments.colSector"),
                  hospital: t("appointments.colHospital"),
                  date: t("appointments.colDate"),
                  status: t("appointments.colStatus"),
                  note: t("appointments.colAttendanceNote"),
                },
                dateFilter,
                statusFilter,
                activeSectorName,
                riskFilter,
                customStart || undefined,
                customEnd || undefined,
                {
                  dateFieldLabel: t("appointments.printFilterDate"),
                  dateValue: dateFilterLabel,
                  statusFieldLabel: t("appointments.printFilterStatus"),
                  statusValue: statusFilterLabel,
                  sectorFieldLabel: t("appointments.printFilterSector"),
                  sectorValue: sectorFilterLabel,
                  riskFieldLabel: t("appointments.printFilterRisk"),
                  riskValue: riskFilterLabel,
                }
              );
            }}
          >
            <Download className="w-4 h-4" />
            {t("appointments.exportCsv")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 no-print"
            disabled={filtered.length === 0}
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            {t("appointments.print")}
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
                    <TableHead>{t("appointments.colRisk")}</TableHead>
                    <TableHead className="print-only">{t("appointments.colAttendanceNote")}</TableHead>
                    <TableHead className="text-center no-print">{t("appointments.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((appt) => {
                    const past = isPast(appt.appointmentDate);
                    const needsAction = past && appt.attended === null;
                    return (
                      <TableRow
                        key={appt.id}
                        className={needsAction ? "bg-red-50 border-s-4 border-s-red-500" : ""}
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
                          <RiskBadge level={appt.riskLevel ?? undefined} />
                        </TableCell>
                        <TableCell className="print-only text-sm text-gray-700">
                          {appt.attendanceNote ?? ""}
                        </TableCell>
                        <TableCell className="no-print">
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
