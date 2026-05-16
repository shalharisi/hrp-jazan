import React from "react";
import { useI18n } from "@/lib/i18n-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserGuide() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("nav.guide")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>User Guide (To be implemented)</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Instructions for using the High-Risk Pregnancy Tracker.</p>
        </CardContent>
      </Card>
    </div>
  );
}
