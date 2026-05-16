import React from "react";
import { useI18n } from "@/lib/i18n-context";
import { useListAlerts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Activity, CalendarX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function AlertsList() {
  const { t } = useI18n();
  const { data, isLoading } = useListAlerts();

  const getIcon = (type: string) => {
    switch (type) {
      case 'vte_without_enoxaparin': return <Activity className="w-5 h-5 text-red-500" />;
      case 'critical_without_appointment': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'missed_appointment': return <CalendarX className="w-5 h-5 text-red-500" />;
      case 'overdue_critical': return <Clock className="w-5 h-5 text-red-500" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("nav.alerts")}</h1>
        {data && (
          <Badge variant="destructive" className="text-base px-3 py-1">
            {data.totalCount} Active Alerts
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : data?.alerts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mb-4">
                ✓
              </div>
              <p>No active alerts. Everything is on track.</p>
            </CardContent>
          </Card>
        ) : (
          data?.alerts.map((alert, i) => (
            <Card key={i} className={`border-l-4 ${alert.severity === 'critical' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="mt-1 bg-muted p-2 rounded-full">
                  {getIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-lg">
                      <Link href={`/pregnancies/${alert.pregnancyId}`} className="hover:underline">
                        {alert.patientNameAr}
                      </Link>
                    </h3>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">NID: {alert.patientNationalId}</p>
                  <p className="mt-2 font-medium">{alert.message || alert.type.replace(/_/g, ' ')}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
