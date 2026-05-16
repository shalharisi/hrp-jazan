import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n-context";
import {
  useListPatients,
  useListHospitals,
  useListSectors,
  useListHealthCenters,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FilterX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientsList() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  // ── filter state ────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [hospitalId, setHospitalId] = useState<number | undefined>();
  const [sectorId, setSectorId] = useState<number | undefined>();
  const [healthCenterId, setHealthCenterId] = useState<number | undefined>();

  const hasFilters = !!hospitalId || !!sectorId || !!healthCenterId;

  // ── reference data ───────────────────────────────────────────────
  const { data: hospitals = [] } = useListHospitals();
  const { data: allSectors = [] } = useListSectors();
  const { data: allHealthCenters = [] } = useListHealthCenters();

  // Cascade: sectors filtered to selected hospital
  const filteredSectors = useMemo(() => {
    if (!hospitalId) return allSectors;
    return allSectors.filter((s) => s.hospitalId === hospitalId);
  }, [allSectors, hospitalId]);

  // Cascade: health centers filtered to selected sector
  const filteredCenters = useMemo(() => {
    if (!sectorId) return allHealthCenters;
    return allHealthCenters.filter((c) => c.sectorId === sectorId);
  }, [allHealthCenters, sectorId]);

  // ── patients query ────────────────────────────────────────────────
  const { data, isLoading } = useListPatients({
    search: search || undefined,
    sectorId,
    healthCenterId,
  });

  // ── cascade clear helpers ─────────────────────────────────────────
  function handleHospitalChange(val: string) {
    const id = val === "all" ? undefined : Number(val);
    setHospitalId(id);
    setSectorId(undefined);
    setHealthCenterId(undefined);
  }

  function handleSectorChange(val: string) {
    const id = val === "all" ? undefined : Number(val);
    setSectorId(id);
    setHealthCenterId(undefined);
  }

  function handleCenterChange(val: string) {
    setHealthCenterId(val === "all" ? undefined : Number(val));
  }

  function clearFilters() {
    setHospitalId(undefined);
    setSectorId(undefined);
    setHealthCenterId(undefined);
    setSearch("");
  }

  const total = data?.total ?? data?.items.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">{t("patients.title")}</h1>
        <Link href="/patients/new">
          <Button style={{ background: "#006633", color: "#fff" }}>
            <Plus className="w-4 h-4 mx-1" />
            {t("patients.new")}
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {/* ── Search row ── */}
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("patients.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>

          {/* ── Filter row ── */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Hospital */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-xs text-muted-foreground font-medium">
                {t("filter.hospital")}
              </span>
              <Select
                value={hospitalId !== undefined ? String(hospitalId) : "all"}
                onValueChange={handleHospitalChange}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("filter.allHospitals")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filter.allHospitals")}</SelectItem>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {ar ? h.nameAr : (h.nameEn || h.nameAr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sector */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-xs text-muted-foreground font-medium">
                {t("filter.sector")}
              </span>
              <Select
                value={sectorId !== undefined ? String(sectorId) : "all"}
                onValueChange={handleSectorChange}
                disabled={filteredSectors.length === 0}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("filter.allSectors")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filter.allSectors")}</SelectItem>
                  {filteredSectors.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {ar ? s.nameAr : (s.nameEn || s.nameAr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Health Center */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-xs text-muted-foreground font-medium">
                {t("filter.healthCenter")}
              </span>
              <Select
                value={healthCenterId !== undefined ? String(healthCenterId) : "all"}
                onValueChange={handleCenterChange}
                disabled={filteredCenters.length === 0}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("filter.allCenters")} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">{t("filter.allCenters")}</SelectItem>
                  {filteredCenters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {ar ? c.nameAr : (c.nameEn || c.nameAr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear + count */}
            <div className="flex items-end gap-2 pb-0.5">
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 gap-1 text-sm"
                >
                  <FilterX className="w-4 h-4" />
                  {t("filter.clearAll")}
                </Button>
              )}
              {!isLoading && (
                <Badge variant="secondary" className="h-9 px-3 text-sm font-normal rounded-md">
                  {total} {t("filter.results")}
                </Badge>
              )}
            </div>
          </div>

          {/* ── Table ── */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("patients.name")}</TableHead>
                  <TableHead>{t("patients.nationalId")}</TableHead>
                  <TableHead>{t("patients.phone")}</TableHead>
                  <TableHead>{t("patients.healthCenter")}</TableHead>
                  <TableHead>{t("patients.sector")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-28" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("general.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="text-primary hover:underline"
                        >
                          {ar ? patient.nameAr : (patient.nameEn || patient.nameAr)}
                        </Link>
                      </TableCell>
                      <TableCell>{patient.nationalId}</TableCell>
                      <TableCell dir="ltr" className="text-right rtl:text-left">
                        {patient.phone}
                      </TableCell>
                      <TableCell>{patient.healthCenterNameAr}</TableCell>
                      <TableCell>{patient.sectorNameAr}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
