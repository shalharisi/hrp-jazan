import React from "react";
import { useParams, Link } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import { useGetPregnancy, useListAppointments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge, ComplianceBadge, ReferralBadge } from "@/components/ui/status-badges";
import { Calendar, User, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PregnancyDetail() {
  const { id } = useParams();
  const pregnancyId = Number(id);
  const { t } = useI18n();

  const { data: detail, isLoading: loadingCase } = useGetPregnancy(pregnancyId, {
    query: { enabled: !!pregnancyId }
  });

  const { data: appointments, isLoading: loadingAppts } = useListAppointments(
    { pregnancyId },
    { query: { enabled: !!pregnancyId } }
  );

  if (loadingCase) return <Skeleton className="h-64 w-full" />;
  if (!detail) return <div>Case not found</div>;

  const { pregnancy, patient } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Case Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Case Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4 flex-wrap">
              <RiskBadge level={pregnancy.riskLevel} />
              <ComplianceBadge status={pregnancy.compliance} />
              <ReferralBadge recommendation={pregnancy.referralRecommendation} />
              {pregnancy.isVteHighRisk && <Badge variant="destructive">VTE High Risk</Badge>}
            </div>

            {pregnancy.riskFactors && pregnancy.riskFactors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Risk Factors</h3>
                <div className="flex flex-wrap gap-2">
                  {pregnancy.riskFactors.map((rf, i) => (
                    <Badge key={i} variant="outline">{rf}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Patient Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <Link href={`/patients/${patient.id}`} className="font-medium hover:underline text-primary">
                {patient.nameAr}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span>NID: {patient.nationalId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Visit: {new Date(pregnancy.visitDate).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3">
          <CardHeader>
            <CardTitle>Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAppts ? (
                  <TableRow><TableCell colSpan={3}><Skeleton className="h-8" /></TableCell></TableRow>
                ) : appointments?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No appointments scheduled</TableCell></TableRow>
                ) : (
                  appointments?.map(apt => (
                    <TableRow key={apt.id}>
                      <TableCell>{new Date(apt.appointmentDate).toLocaleString()}</TableCell>
                      <TableCell>{apt.hospitalNameAr}</TableCell>
                      <TableCell>
                        {apt.attended === true ? (
                          <Badge className="bg-green-500/10 text-green-700">Attended</Badge>
                        ) : apt.attended === false ? (
                          <Badge className="bg-red-500/10 text-red-700">Missed</Badge>
                        ) : (
                          <Badge variant="outline">Scheduled</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
