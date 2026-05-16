import React from "react";
import { useI18n } from "@/lib/i18n-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Activity, AlertTriangle, Clock } from "lucide-react";
import { 
  useGetDashboardSummary, 
  useGetDashboardByRiskLevel,
  useGetDashboardCompliance
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

export default function Dashboard() {
  const { t } = useI18n();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: riskStats } = useGetDashboardByRiskLevel();
  const { data: compStats } = useGetDashboardCompliance();

  if (loadingSummary) {
    return <div className="space-y-4">
      <Skeleton className="h-[120px] w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
      </div>
    </div>;
  }

  const COLORS = ['#10b981', '#eab308', '#f97316', '#ef4444'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalPatients")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPatients || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalPregnancies")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPregnancies || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.criticalCases")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.totalCritical || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.criticalWithoutAppointment} {t("dashboard.criticalWithoutAppt")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.bookingCompliance")}</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.bookingComplianceRate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.attendanceRate || 0}% {t("dashboard.attendanceRate")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskStats || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="riskLevel"
                >
                  {(riskStats || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Compliance Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compStats ? [compStats] : []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="compliant" fill="#10b981" name="Compliant" />
                <Bar dataKey="nonCompliant" fill="#ef4444" name="Non-Compliant" />
                <Bar dataKey="pending" fill="#94a3b8" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
