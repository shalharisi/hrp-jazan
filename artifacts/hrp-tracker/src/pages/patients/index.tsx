import React, { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useListPatients } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientsList() {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  
  const { data, isLoading } = useListPatients({ search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">{t("patients.title")}</h1>
        <Link href="/patients/new">
          <Button>
            <Plus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t("patients.new")}
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:right-3 rtl:left-auto" />
              <Input 
                placeholder={t("patients.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rtl:pr-9 rtl:pl-3"
              />
            </div>
          </div>

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
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("general.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map(patient => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        <Link href={`/patients/${patient.id}`} className="text-primary hover:underline">
                          {lang === "ar" ? patient.nameAr : (patient.nameEn || patient.nameAr)}
                        </Link>
                      </TableCell>
                      <TableCell>{patient.nationalId}</TableCell>
                      <TableCell dir="ltr" className="text-right rtl:text-left">{patient.phone}</TableCell>
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
