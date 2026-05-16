import React from "react";
import { useParams, Link } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import { useGetPatient, useListPregnancies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, User, MapPin, Phone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge, ComplianceBadge } from "@/components/ui/status-badges";

export default function PatientDetail() {
  const { id } = useParams();
  const patientId = Number(id);
  const { t } = useI18n();

  const { data: patient, isLoading: loadingPatient } = useGetPatient(patientId, {
    query: { queryKey: ["patient", patientId], enabled: !!patientId }
  });

  const { data: pregnancies, isLoading: loadingPregnancies } = useListPregnancies(
    { patientId },
    { query: { queryKey: ["pregnancies", patientId], enabled: !!patientId } }
  );

  if (loadingPatient) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!patient) {
    return <div>Patient not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">{patient.nameAr}</h1>
        <Link href={`/pregnancies/new?patientId=${patient.id}`}>
          <Button>
            <Plus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            Add Pregnancy Case
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Patient Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{patient.nationalId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span dir="ltr">{patient.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{patient.healthCenterNameAr} - {patient.sectorNameAr}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Pregnancy Episodes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visit Date</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPregnancies ? (
                  <TableRow><TableCell colSpan={4}><Skeleton className="h-8" /></TableCell></TableRow>
                ) : pregnancies?.items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No cases recorded</TableCell></TableRow>
                ) : (
                  pregnancies?.items.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.visitDate).toLocaleDateString()}</TableCell>
                      <TableCell><RiskBadge level={p.riskLevel} /></TableCell>
                      <TableCell><ComplianceBadge status={p.compliance} /></TableCell>
                      <TableCell>
                        <Link href={`/pregnancies/${p.id}`} className="text-primary hover:underline">
                          View Details
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
    </div>
  );
}
