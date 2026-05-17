import React from "react";
import { useI18n } from "@/lib/i18n-context";
import { useListPregnancies } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge, ComplianceBadge, ReferralBadge } from "@/components/ui/status-badges";

export default function PregnanciesList() {
  const { t } = useI18n();

  const { data, isLoading } = useListPregnancies({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">{t("nav.pregnancies")}</h1>
        <Link href="/pregnancies/new">
          <Button>
            <Plus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            New Case
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>National ID</TableHead>
                <TableHead>Visit Date</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead>Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("general.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/pregnancies/${p.id}`} className="text-primary hover:underline">
                        {p.patientNameAr}
                      </Link>
                    </TableCell>
                    <TableCell>{p.patientNationalId}</TableCell>
                    <TableCell>{new Date(p.visitDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <RiskBadge level={p.riskLevel} />
                    </TableCell>
                    <TableCell>
                      <ReferralBadge recommendation={p.referralRecommendation} />
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge status={p.compliance} />
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
