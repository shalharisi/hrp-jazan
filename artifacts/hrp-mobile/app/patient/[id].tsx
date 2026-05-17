import { Ionicons } from "@expo/vector-icons";
import { useGetPatient, useListPregnancies } from "@workspace/api-client-react";
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

export default function PatientDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = Number(id);
  const topWebPadding = Platform.OS === "web" ? 67 : 0;

  const { data: patient, isLoading: loadingPatient } = useGetPatient(patientId);
  const { data: pregnanciesData, isLoading: loadingPregnancies } = useListPregnancies({
    patientId,
    limit: 20,
  });

  const styles = makeStyles(colors, isRTL);
  const pregnancies = pregnanciesData?.items ?? [];

  if (loadingPatient) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={48} color={colors.mutedForeground} />
        <Text style={styles.emptyText}>{t("general.noData")}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("general.back")}</Text>
        </Pressable>
      </View>
    );
  }

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
        <Text style={[styles.screenTitle, isRTL && styles.rtlText]}>{t("patient.title")}</Text>
      </View>

      <View style={styles.patientCard}>
        <View style={[styles.avatarRow, isRTL && styles.rowReverse]}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{patient.nameAr.charAt(0)}</Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={[styles.patientName, isRTL && styles.rtlText]}>{patient.nameAr}</Text>
            {patient.nameEn && (
              <Text style={[styles.patientNameEn, { textAlign: isRTL ? "right" : "left" }]}>
                {patient.nameEn}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <InfoRow
          icon="card-outline"
          label={t("patients.id")}
          value={patient.nationalId}
          isRTL={isRTL}
          colors={colors}
        />
        <InfoRow
          icon="call-outline"
          label={t("patients.phone")}
          value={patient.phone}
          isRTL={isRTL}
          colors={colors}
        />
        {patient.sectorNameAr && (
          <InfoRow
            icon="location-outline"
            label={t("patients.sector")}
            value={patient.sectorNameAr}
            isRTL={isRTL}
            colors={colors}
          />
        )}
        {patient.healthCenterNameAr && (
          <InfoRow
            icon="medkit-outline"
            label={t("patients.center")}
            value={patient.healthCenterNameAr}
            isRTL={isRTL}
            colors={colors}
          />
        )}
        {patient.age && (
          <InfoRow
            icon="person-outline"
            label={t("patient.age")}
            value={`${patient.age} ${t("patient.years")}`}
            isRTL={isRTL}
            colors={colors}
          />
        )}
      </View>

      <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
        {t("patient.pregnancies")} ({pregnancies.length})
      </Text>

      {loadingPregnancies ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : pregnancies.length === 0 ? (
        <View style={styles.emptySection}>
          <Ionicons name="document-text-outline" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {t("patient.noPregnancies")}
          </Text>
        </View>
      ) : (
        pregnancies.map((p) => {
          const riskColor = RISK_COLORS[p.riskLevel] ?? colors.primary;
          return (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.pregnancyCard, pressed && styles.pressed]}
              onPress={() => router.push(`/pregnancy/${p.id}`)}
            >
              <View style={[styles.pregnancyStripe, { backgroundColor: riskColor }]} />
              <View style={styles.pregnancyContent}>
                <View style={[styles.pregHeader, isRTL && styles.rowReverse]}>
                  <Text style={[styles.pregDate, isRTL && styles.rtlText]}>
                    {p.visitDate ? new Date(p.visitDate).toLocaleDateString("ar-SA") : "—"}
                  </Text>
                  <View
                    style={[
                      styles.riskBadge,
                      { backgroundColor: `${riskColor}20`, borderColor: riskColor },
                    ]}
                  >
                    <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                      {t(`risk.${p.riskLevel}` as "risk.low")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.complianceText, isRTL && styles.rtlText]}>
                  {t(`compliance.${p.compliance}` as "compliance.compliant")}
                </Text>
                {p.referralRecommendation && (
                  <Text style={[styles.referralText, isRTL && styles.rtlText]}>
                    {t(`referral.${p.referralRecommendation}` as "referral.follow_at_center")}
                  </Text>
                )}
              </View>
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function InfoRow({
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
    <View style={[infoStyles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <Ionicons
        name={icon as "card-outline"}
        size={16}
        color={colors.primary}
        style={infoStyles.icon}
      />
      <Text
        style={[
          infoStyles.label,
          { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          infoStyles.value,
          { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  icon: { width: 20 },
  label: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    width: 100,
  },
  value: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    flex: 1,
  },
});

function makeStyles(colors: ReturnType<typeof useColors>, _isRTL: boolean) {
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
    patientCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 16,
    },
    bigAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${colors.primary}20`,
      alignItems: "center",
      justifyContent: "center",
    },
    bigAvatarText: {
      fontSize: 28,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.primary,
    },
    patientInfo: { flex: 1 },
    patientName: {
      fontSize: 18,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    patientNameEn: {
      fontSize: 14,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      marginBottom: 12,
    },
    emptySection: {
      alignItems: "center",
      paddingVertical: 32,
      gap: 10,
    },
    pregnancyCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      paddingRight: 14,
    },
    pressed: { opacity: 0.75 },
    pregnancyStripe: { width: 5, alignSelf: "stretch" },
    pregnancyContent: { flex: 1, padding: 14 },
    pregHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    pregDate: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    riskBadge: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    riskBadgeText: {
      fontSize: 11,
      fontFamily: "Tajawal_700Bold",
    },
    complianceText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    referralText: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
  });
}
