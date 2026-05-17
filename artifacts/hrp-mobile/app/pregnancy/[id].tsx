import { Ionicons } from "@expo/vector-icons";
import { useGetPregnancy } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export default function PregnancyDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pregId = Number(id);
  const topWebPadding = Platform.OS === "web" ? 67 : 0;

  const { data, isLoading } = useGetPregnancy(pregId);

  const styles = makeStyles(colors, isRTL);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="document-text-outline"
          size={48}
          color={colors.mutedForeground}
        />
        <Text style={styles.emptyText}>{t("general.noData")}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("general.back")}</Text>
        </Pressable>
      </View>
    );
  }

  const { pregnancy, patient, appointments } = data;
  const riskColor = RISK_COLORS[pregnancy.riskLevel] ?? colors.primary;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topWebPadding }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.backRow, isRTL && styles.rowReverse]}>
        <Pressable onPress={() => router.back()} style={styles.backIconBtn}>
          <Ionicons
            name={isRTL ? "arrow-forward" : "arrow-back"}
            size={22}
            color={colors.primary}
          />
        </Pressable>
        <Text style={[styles.screenTitle, isRTL && styles.rtlText]}>
          {t("pregnancy.title")}
        </Text>
      </View>

      <View style={styles.riskBanner}>
        <View style={[styles.riskColorStrip, { backgroundColor: riskColor }]} />
        <View style={styles.riskBannerContent}>
          <Pressable
            onPress={() => router.push(`/patient/${patient.id}`)}
            style={[styles.patientLink, isRTL && styles.rowReverse]}
          >
            <Text style={[styles.patientLinkText, isRTL && styles.rtlText]}>
              {patient.nameAr}
            </Text>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={14}
              color={colors.primary}
            />
          </Pressable>
          <View style={[styles.badgeRow, isRTL && styles.rowReverse]}>
            <View
              style={[
                styles.riskBadge,
                { backgroundColor: `${riskColor}20`, borderColor: riskColor },
              ]}
            >
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                {t(`risk.${pregnancy.riskLevel}` as "risk.low")}
              </Text>
            </View>
            <View style={styles.complianceBadge}>
              <Text style={styles.complianceBadgeText}>
                {t(
                  `compliance.${pregnancy.compliance}` as "compliance.compliant"
                )}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.detailCard}>
        <DetailRow
          icon="calendar-outline"
          label={t("cases.visitDate")}
          value={
            pregnancy.visitDate
              ? new Date(pregnancy.visitDate).toLocaleDateString("ar-SA")
              : "—"
          }
          isRTL={isRTL}
          colors={colors}
        />
        {pregnancy.gestationalAge != null && (
          <DetailRow
            icon="time-outline"
            label={t("cases.gestational")}
            value={`${pregnancy.gestationalAge} ${t("cases.weeks")}`}
            isRTL={isRTL}
            colors={colors}
          />
        )}
        <DetailRow
          icon="git-branch-outline"
          label={t("cases.referral")}
          value={t(
            `referral.${pregnancy.referralRecommendation}` as "referral.follow_at_center"
          )}
          isRTL={isRTL}
          colors={colors}
        />
        {pregnancy.doctorName && (
          <DetailRow
            icon="person-outline"
            label={t("pregnancy.doctor")}
            value={pregnancy.doctorName}
            isRTL={isRTL}
            colors={colors}
          />
        )}
        {pregnancy.workingDaysToAppointment != null && (
          <DetailRow
            icon="briefcase-outline"
            label={t("pregnancy.workingDays")}
            value={String(pregnancy.workingDaysToAppointment)}
            isRTL={isRTL}
            colors={colors}
          />
        )}
      </View>

      <View style={styles.flagsRow}>
        <View
          style={[
            styles.flagCard,
            pregnancy.isVteHighRisk
              ? styles.flagDanger
              : styles.flagSafe,
          ]}
        >
          <Ionicons
            name="medkit"
            size={18}
            color={pregnancy.isVteHighRisk ? "#ef4444" : "#22c55e"}
          />
          <Text
            style={[
              styles.flagText,
              { color: pregnancy.isVteHighRisk ? "#ef4444" : "#22c55e" },
            ]}
          >
            VTE
          </Text>
          <Text style={styles.flagValue}>
            {pregnancy.isVteHighRisk ? t("pregnancy.yes") : t("pregnancy.no")}
          </Text>
        </View>
        <View
          style={[
            styles.flagCard,
            pregnancy.enoxaparinPrescribed
              ? styles.flagSafe
              : pregnancy.isVteHighRisk
              ? styles.flagDanger
              : styles.flagNeutral,
          ]}
        >
          <Ionicons
            name="flask"
            size={18}
            color={
              pregnancy.enoxaparinPrescribed
                ? "#22c55e"
                : pregnancy.isVteHighRisk
                ? "#ef4444"
                : colors.mutedForeground
            }
          />
          <Text
            style={[
              styles.flagText,
              {
                color: pregnancy.enoxaparinPrescribed
                  ? "#22c55e"
                  : pregnancy.isVteHighRisk
                  ? "#ef4444"
                  : colors.mutedForeground,
              },
            ]}
          >
            {t("pregnancy.enoxaparin")}
          </Text>
          <Text style={styles.flagValue}>
            {pregnancy.enoxaparinPrescribed
              ? t("pregnancy.yes")
              : t("pregnancy.no")}
          </Text>
        </View>
      </View>

      {pregnancy.riskFactors && pregnancy.riskFactors.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("pregnancy.riskFactors")}
          </Text>
          <View style={styles.tagsWrap}>
            {pregnancy.riskFactors.map((rf, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{rf}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {pregnancy.notes && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("pregnancy.notes")}
          </Text>
          <Text style={[styles.notesText, isRTL && styles.rtlText]}>
            {pregnancy.notes}
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
        {t("pregnancy.appointments")} ({appointments.length})
      </Text>

      {appointments.length === 0 ? (
        <View style={styles.emptySection}>
          <Ionicons
            name="calendar-outline"
            size={32}
            color={colors.mutedForeground}
          />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {t("pregnancy.noAppointments")}
          </Text>
        </View>
      ) : (
        appointments.map((appt) => (
          <View key={appt.id} style={styles.apptCard}>
            <View style={[styles.apptHeader, isRTL && styles.rowReverse]}>
              <View style={[styles.apptDateRow, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.apptDate}>
                  {appt.appointmentDate
                    ? new Date(appt.appointmentDate).toLocaleDateString("ar-SA")
                    : "—"}
                </Text>
              </View>
              <View
                style={[
                  styles.attendanceBadge,
                  appt.attended === true
                    ? styles.attendedBadge
                    : appt.attended === false
                    ? styles.missedBadge
                    : styles.pendingBadge,
                ]}
              >
                <Text style={styles.attendanceBadgeText}>
                  {appt.attended === true
                    ? t("appt.attended")
                    : appt.attended === false
                    ? t("appt.missed")
                    : t("appt.pending")}
                </Text>
              </View>
            </View>
            {appt.hospitalNameAr && (
              <View style={[styles.apptMeta, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="business-outline"
                  size={13}
                  color={colors.mutedForeground}
                />
                <Text style={styles.apptMetaText}>{appt.hospitalNameAr}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isRTL,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        detailRowStyles.row,
        { flexDirection: isRTL ? "row-reverse" : "row" },
      ]}
    >
      <Ionicons
        name={icon as "calendar-outline"}
        size={16}
        color={colors.primary}
        style={detailRowStyles.icon}
      />
      <Text
        style={[
          detailRowStyles.label,
          { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          detailRowStyles.value,
          { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  icon: { width: 20 },
  label: { fontSize: 13, fontFamily: "Tajawal_400Regular", width: 120 },
  value: { fontSize: 14, fontFamily: "Tajawal_500Medium", flex: 1 },
});

function makeStyles(colors: ReturnType<typeof useColors>, isRTL: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16 },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: colors.background,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    backBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 8,
    },
    backBtnText: {
      color: "#fff",
      fontFamily: "Tajawal_500Medium",
      fontSize: 14,
    },
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    backIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
    },
    screenTitle: {
      fontSize: 20,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      flex: 1,
    },
    riskBanner: {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 16,
      flexDirection: "row",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    riskColorStrip: { width: 6 },
    riskBannerContent: { flex: 1, padding: 16 },
    patientLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 8,
    },
    patientLinkText: {
      fontSize: 16,
      fontFamily: "Tajawal_700Bold",
      color: colors.primary,
    },
    badgeRow: { flexDirection: "row", gap: 8 },
    riskBadge: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    riskBadgeText: { fontSize: 12, fontFamily: "Tajawal_700Bold" },
    complianceBadge: {
      backgroundColor: colors.muted,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    complianceBadgeText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
    },
    detailCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    flagsRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    flagCard: {
      flex: 1,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
    },
    flagDanger: {
      backgroundColor: "#fef2f2",
      borderColor: "#fecaca",
    },
    flagSafe: {
      backgroundColor: "#f0fdf4",
      borderColor: "#bbf7d0",
    },
    flagNeutral: {
      backgroundColor: colors.muted,
      borderColor: colors.border,
    },
    flagText: {
      fontSize: 11,
      fontFamily: "Tajawal_500Medium",
      textAlign: "center",
    },
    flagValue: {
      fontSize: 13,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    section: { marginBottom: 16 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      marginBottom: 10,
    },
    tagsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tag: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    tagText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: colors.primary,
    },
    notesText: {
      fontSize: 14,
      fontFamily: "Tajawal_400Regular",
      color: colors.foreground,
      lineHeight: 22,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
    },
    emptySection: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 10,
      marginBottom: 16,
    },
    apptCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    apptHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    apptDateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    apptDate: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    attendanceBadge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    attendedBadge: { backgroundColor: "#dcfce7" },
    missedBadge: { backgroundColor: "#fee2e2" },
    pendingBadge: { backgroundColor: "#fef9c3" },
    attendanceBadgeText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: "#333",
    },
    apptMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    apptMetaText: {
      fontSize: 13,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
  });
}
