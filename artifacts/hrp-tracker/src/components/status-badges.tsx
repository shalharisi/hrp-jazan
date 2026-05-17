import React from "react";
import { Badge } from "@/components/ui/badge";
import { PregnancyRiskLevel, PregnancyCompliance } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n-context";
import type { TranslationKey } from "@/i18n";

export function RiskBadge({ level }: { level?: string }) {
  const { t } = useI18n();

  if (!level) return null;

  const variants: Record<string, string> = {
    [PregnancyRiskLevel.low]: "bg-green-500/10 text-green-700 border-green-500/20",
    [PregnancyRiskLevel.medium]: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    [PregnancyRiskLevel.high]: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    [PregnancyRiskLevel.critical]: "bg-red-500/10 text-red-700 border-red-500/20",
  };

  return (
    <Badge variant="outline" className={variants[level] || ""}>
      {t(`risk.${level}` as TranslationKey) || level}
    </Badge>
  );
}

export function ComplianceBadge({ status }: { status?: string }) {
  const { t } = useI18n();

  if (!status) return null;

  const config: Record<string, { cls: string; icon: string }> = {
    [PregnancyCompliance.compliant]: {
      cls: "bg-green-500/10 text-green-700 border-green-500/20",
      icon: "✓",
    },
    [PregnancyCompliance.non_compliant]: {
      cls: "bg-red-500/10 text-red-700 border-red-500/20",
      icon: "✗",
    },
    [PregnancyCompliance.pending]: {
      cls: "bg-gray-500/10 text-gray-700 border-gray-500/20",
      icon: "⏳",
    },
  };

  const c = config[status];

  return (
    <Badge variant="outline" className={c?.cls || ""}>
      {c?.icon && <span className="mr-1 rtl:ml-1 rtl:mr-0">{c.icon}</span>}
      {t(`compliance.${status}` as TranslationKey) || status}
    </Badge>
  );
}

export function ReferralBadge({ recommendation }: { recommendation?: string }) {
  const { t } = useI18n();
  if (!recommendation) return null;

  return (
    <Badge variant="secondary">
      {t(`referral.${recommendation}` as TranslationKey) || recommendation}
    </Badge>
  );
}
