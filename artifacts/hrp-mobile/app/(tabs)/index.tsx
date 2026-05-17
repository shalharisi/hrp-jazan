import { Ionicons } from "@expo/vector-icons";
import {
  useGetDashboardByRiskLevel,
  useGetDashboardSummary,
  useListAlerts,
  useListAppointments,
} from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BANNER_KEY_PREFIX, useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";
import { useGuideGenerationStatus } from "@/hooks/useGuideGenerationStatus";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const URGENT_THRESHOLD = 5;

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { user } = useAuth();

  const summary = useGetDashboardSummary();
  const riskStats = useGetDashboardByRiskLevel();
  const alerts = useListAlerts();
  const appointments = useListAppointments();
  const { refetch: refetchSummary } = summary;
  const { refetch: refetchRiskStats } = riskStats;
  const { refetch: refetchAlerts } = alerts;
  const { refetch: refetchAppointments } = appointments;

  const isGuideGenerating = useGuideGenerationStatus();

  const [bannerDismissed, setBannerDismissed] = useState(false);

  const bannerKey = user ? `${BANNER_KEY_PREFIX}${user.id}` : null;

  useEffect(() => {
    if (!bannerKey) return;
    const load = async () => {
      try {
        let stored: string | null;
        if (Platform.OS === "web") {
          stored = localStorage.getItem(bannerKey);
        } else {
          stored = await AsyncStorage.getItem(bannerKey);
        }
        if (stored === "1") setBannerDismissed(true);
      } catch {
        // ignore
      }
    };
    void load();
  }, [bannerKey]);

  const dismissBanner = async () => {
    setBannerDismissed(true);
    if (!bannerKey) return;
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(bannerKey, "1");
      } else {
        await AsyncStorage.setItem(bannerKey, "1");
      }
    } catch {
      // ignore
    }
  };

  const topWebPadding = Platform.OS === "web" ? 67 : 0;

  const today = localDateStr(new Date());

  const isLoading = summary.isLoading;
  const refetch = useCallback(() => {
    refetchSummary();
    refetchRiskStats();
    refetchAlerts();
    refetchAppointments();
  }, [refetchSummary, refetchRiskStats, refetchAlerts, refetchAppointments]);

  useFocusEffect(
    useCallback(() => {
      refetchAppointments();
    }, [refetchAppointments]),
  );

  const needsActionCount = useMemo(() => {
    const all = appointments.data ?? [];
    return all.filter((a) => a.appointmentDate.slice(0, 10) < today && a.attended === null).length;
  }, [appointments.data, today]);

  const showUrgentBanner = !bannerDismissed && needsActionCount > URGENT_THRESHOLD;

  const s = summary.data;
  const styles = makeStyles(colors, isRTL);

  const kpiCards = s
    ? [
        {
          key: "patients",
          label: t("dashboard.totalPatients"),
          value: s.totalPatients,
          icon: "people" as const,
          color: colors.primary,
          onPress: undefined as (() => void) | undefined,
        },
        {
          key: "cases",
          label: t("dashboard.totalCases"),
          value: s.totalPregnancies,
          icon: "document-text" as const,
          color: "#3b82f6",
          onPress: undefined as (() => void) | undefined,
        },
        {
          key: "critical",
          label: t("dashboard.criticalCases"),
          value: s.totalCritical,
          icon: "warning" as const,
          color: "#ef4444",
          onPress: undefined as (() => void) | undefined,
        },
        {
          key: "compliance",
          label: t("dashboard.compliance"),
          value: `${Math.round(s.bookingComplianceRate)}%`,
          icon: "checkmark-circle" as const,
          color: "#22c55e",
          onPress: undefined as (() => void) | undefined,
        },
        {
          key: "vteWithout",
          label: t("dashboard.vteWithout"),
          value: s.vteWithoutEnoxaparin,
          icon: "medkit" as const,
          color: "#f59e0b",
          onPress: undefined as (() => void) | undefined,
        },
        {
          key: "criticalNoAppt",
          label: t("dashboard.criticalNoAppt"),
          value: s.criticalWithoutAppointment,
          icon: "calendar" as const,
          color: "#f97316",
          onPress: undefined as (() => void) | undefined,
        },
        {
          key: "needsAction",
          label: t("appointments.needsAction"),
          value: needsActionCount,
          icon: "alert-circle" as const,
          color: "#c2410c",
          onPress: () => router.push("/(tabs)/appointments?filter=needs_action"),
        },
      ]
    : [];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topWebPadding }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isLoading && !s}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <View>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t("dashboard.title")}</Text>
          <Text style={[styles.headerSub, isRTL && styles.rtlText]}>تجمع جازان الصحي</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="pulse" size={20} color={colors.primary} />
        </View>
      </View>

      {isGuideGenerating && (
        <View style={[styles.guideBanner, isRTL && styles.rowReverse]}>
          <ActivityIndicator size="small" color="#2563eb" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.guideBannerTitle, isRTL && styles.rtlText]}>
              {t("guide.generating")}
            </Text>
            <Text style={[styles.guideBannerSub, isRTL && styles.rtlText]}>
              {t("guide.generatingSub")}
            </Text>
          </View>
        </View>
      )}

      {showUrgentBanner && (
        <Pressable
          style={[styles.urgentBanner, isRTL && styles.rowReverse]}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/appointments",
              params: { filter: "needs_action" },
            })
          }
          accessibilityRole="button"
        >
          <View style={[styles.urgentBannerLeft, isRTL && styles.rowReverse]}>
            <Ionicons name="alert-circle" size={22} color="#c2410c" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.urgentBannerCount, isRTL && styles.rtlText]}>
                {needsActionCount} {t("appointments.needsAction")}
              </Text>
              <Text style={[styles.urgentBannerSub, isRTL && styles.rtlText]}>
                {t("appointments.needsActionBanner")}
              </Text>
            </View>
          </View>
          <View style={[styles.urgentBannerActions, isRTL && styles.rowReverse]}>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color="#c2410c" />
            <Pressable
              style={styles.urgentBannerDismiss}
              onPress={(e) => {
                e.stopPropagation?.();
                void dismissBanner();
              }}
              hitSlop={8}
              accessibilityLabel={t("general.cancel")}
            >
              <Ionicons name="close" size={16} color="#9a3412" />
            </Pressable>
          </View>
        </Pressable>
      )}

      {isLoading && !s ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>{t("general.loading")}</Text>
        </View>
      ) : summary.isError ? (
        <View style={styles.errorWrap}>
          <Ionicons name="cloud-offline" size={40} color={colors.mutedForeground} />
          <Text style={styles.errorText}>{t("general.error")}</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>{t("general.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            {kpiCards.map((card) => (
              <Pressable
                key={card.key}
                style={({ pressed }) => [
                  styles.kpiCard,
                  { borderLeftColor: card.color },
                  card.onPress && pressed && styles.kpiCardPressed,
                ]}
                onPress={card.onPress}
                disabled={!card.onPress}
              >
                <View style={[styles.kpiIconWrap, { backgroundColor: `${card.color}15` }]}>
                  <Ionicons name={card.icon} size={20} color={card.color} />
                </View>
                <Text style={styles.kpiValue}>{card.value}</Text>
                <Text style={[styles.kpiLabel, isRTL && styles.rtlText]}>{card.label}</Text>
                {card.onPress && (
                  <Ionicons
                    name={isRTL ? "chevron-back" : "chevron-forward"}
                    size={12}
                    color={card.color}
                    style={styles.kpiChevron}
                  />
                )}
              </Pressable>
            ))}
          </View>

          {riskStats.data && riskStats.data.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {t("dashboard.riskDistribution")}
              </Text>
              {riskStats.data.map((r) => (
                <View key={r.riskLevel} style={styles.riskRow}>
                  <View style={styles.riskLabelRow}>
                    <View
                      style={[
                        styles.riskDot,
                        { backgroundColor: RISK_COLORS[r.riskLevel] ?? colors.primary },
                      ]}
                    />
                    <Text style={styles.riskLabel}>{t(`risk.${r.riskLevel}` as "risk.low")}</Text>
                    <Text style={styles.riskCount}>{r.count}</Text>
                  </View>
                  <View style={styles.riskBarBg}>
                    <View
                      style={[
                        styles.riskBarFill,
                        {
                          width: `${Math.min(r.percentage, 100)}%`,
                          backgroundColor: RISK_COLORS[r.riskLevel] ?? colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {alerts.data && alerts.data.alerts.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {t("dashboard.recentAlerts")}
                </Text>
                <Pressable onPress={() => router.push("/(tabs)/alerts")} style={styles.seeAllBtn}>
                  <Text style={styles.seeAllText}>{t("dashboard.seeAll")}</Text>
                </Pressable>
              </View>
              {alerts.data.alerts.slice(0, 3).map((alert, idx) => (
                <Pressable
                  key={`${alert.pregnancyId}-${idx}`}
                  style={[
                    styles.alertCard,
                    alert.severity === "critical" ? styles.alertCritical : styles.alertWarning,
                  ]}
                  onPress={() => router.push(`/pregnancy/${alert.pregnancyId}`)}
                >
                  <Ionicons
                    name={alert.severity === "critical" ? "alert-circle" : "warning"}
                    size={18}
                    color={alert.severity === "critical" ? "#ef4444" : "#f59e0b"}
                  />
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertName, isRTL && styles.rtlText]}>
                      {alert.patientNameAr}
                    </Text>
                    <Text style={[styles.alertMsg, isRTL && styles.rtlText]}>
                      {t(`alert.${alert.type}` as "alert.missed_appointment")}
                    </Text>
                  </View>
                  <Ionicons
                    name={isRTL ? "chevron-back" : "chevron-forward"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isRTL: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16 },
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    headerSub: {
      fontSize: 13,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    headerBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 12,
    },
    loadingText: {
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      fontSize: 14,
    },
    errorWrap: {
      alignItems: "center",
      paddingVertical: 60,
      gap: 12,
    },
    errorText: {
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      fontSize: 15,
    },
    retryBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryText: {
      color: "#fff",
      fontFamily: "Tajawal_500Medium",
      fontSize: 14,
    },
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 24,
    },
    kpiCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 4,
      width: "47%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    kpiCardPressed: { opacity: 0.75 },
    kpiChevron: { marginTop: 4, alignSelf: isRTL ? "flex-end" : "flex-start" },
    kpiIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    kpiValue: {
      fontSize: 26,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    kpiLabel: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      textAlign: "right",
    },
    section: { marginBottom: 24 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    seeAllBtn: { paddingHorizontal: 4 },
    seeAllText: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: colors.primary,
    },
    riskRow: { marginBottom: 10 },
    riskLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      gap: 8,
    },
    riskDot: { width: 8, height: 8, borderRadius: 4 },
    riskLabel: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
      flex: 1,
    },
    riskCount: {
      fontSize: 13,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    riskBarBg: {
      height: 6,
      backgroundColor: colors.muted,
      borderRadius: 3,
      overflow: "hidden",
    },
    riskBarFill: { height: 6, borderRadius: 3 },
    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      gap: 10,
    },
    alertCritical: {
      backgroundColor: "#fef2f2",
      borderWidth: 1,
      borderColor: "#fecaca",
    },
    alertWarning: {
      backgroundColor: "#fffbeb",
      borderWidth: 1,
      borderColor: "#fde68a",
    },
    alertContent: { flex: 1 },
    alertName: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    alertMsg: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    urgentBanner: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#fff7ed",
      borderWidth: 1,
      borderColor: "#fed7aa",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      gap: 8,
    },
    urgentBannerLeft: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    urgentBannerCount: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: "#c2410c",
    },
    urgentBannerSub: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: "#9a3412",
      marginTop: 1,
    },
    urgentBannerActions: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 8,
    },
    urgentBannerDismiss: {
      padding: 2,
    },
    guideBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#eff6ff",
      borderWidth: 1,
      borderColor: "#bfdbfe",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    guideBannerTitle: {
      fontSize: 13,
      fontFamily: "Tajawal_700Bold",
      color: "#1d4ed8",
    },
    guideBannerSub: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: "#3b82f6",
      marginTop: 1,
    },
  });
}
