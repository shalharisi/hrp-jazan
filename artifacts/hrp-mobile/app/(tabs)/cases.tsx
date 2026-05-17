import { Ionicons } from "@expo/vector-icons";
import { useListPregnancies } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { GuideGenerationBanner } from "@/components/GuideGenerationBanner";

type RiskLevel = "low" | "medium" | "high" | "critical";
type Compliance = "compliant" | "non_compliant" | "pending";

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export default function CasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const topWebPadding = Platform.OS === "web" ? 67 : 0;

  const [riskFilter, setRiskFilter] = useState<RiskLevel | undefined>(undefined);
  const [complianceFilter, setComplianceFilter] = useState<Compliance | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useListPregnancies({
    riskLevel: riskFilter,
    compliance: complianceFilter,
    limit: 50,
  });

  const styles = makeStyles(colors, isRTL);
  const cases = data?.items ?? [];

  const riskFilters: { key: RiskLevel; label: string }[] = [
    { key: "low", label: t("risk.low") },
    { key: "medium", label: t("risk.medium") },
    { key: "high", label: t("risk.high") },
    { key: "critical", label: t("risk.critical") },
  ];

  const complianceFilters: { key: Compliance; label: string }[] = [
    { key: "compliant", label: "✅" },
    { key: "non_compliant", label: "❌" },
    { key: "pending", label: "⏳" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + topWebPadding + 16 }]}>
      <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
        <Text style={[styles.screenTitle, isRTL && styles.rtlText]}>{t("cases.title")}</Text>
        {data && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{data.total}</Text>
          </View>
        )}
      </View>

      <GuideGenerationBanner />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filterRow, isRTL && { flexDirection: "row-reverse" }]}
        style={styles.filterScroll}
      >
        <Pressable
          style={[styles.filterChip, !riskFilter && !complianceFilter && styles.filterChipActive]}
          onPress={() => {
            setRiskFilter(undefined);
            setComplianceFilter(undefined);
          }}
        >
          <Text
            style={[
              styles.filterChipText,
              !riskFilter && !complianceFilter && styles.filterChipTextActive,
            ]}
          >
            {t("cases.all")}
          </Text>
        </Pressable>
        {riskFilters.map((rf) => (
          <Pressable
            key={rf.key}
            style={[
              styles.filterChip,
              riskFilter === rf.key && styles.filterChipActive,
              riskFilter === rf.key && {
                backgroundColor: RISK_COLORS[rf.key],
                borderColor: RISK_COLORS[rf.key],
              },
            ]}
            onPress={() => setRiskFilter((prev) => (prev === rf.key ? undefined : rf.key))}
          >
            <Text
              style={[styles.filterChipText, riskFilter === rf.key && styles.filterChipTextActive]}
            >
              {rf.label}
            </Text>
          </Pressable>
        ))}
        {complianceFilters.map((cf) => (
          <Pressable
            key={cf.key}
            style={[styles.filterChip, complianceFilter === cf.key && styles.filterChipActive]}
            onPress={() => setComplianceFilter((prev) => (prev === cf.key ? undefined : cf.key))}
          >
            <Text style={styles.filterChipText}>{cf.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>{t("general.error")}</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>{t("general.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const riskColor = RISK_COLORS[(item.riskLevel as RiskLevel) ?? "low"];
            return (
              <Pressable
                style={({ pressed }) => [styles.caseCard, pressed && styles.pressed]}
                onPress={() => router.push(`/pregnancy/${item.id}`)}
                testID={`case-${item.id}`}
              >
                <View style={[styles.riskStripe, { backgroundColor: riskColor }]} />
                <View style={styles.caseContent}>
                  <View style={[styles.caseHeader, isRTL && styles.rowReverse]}>
                    <Text style={[styles.patientName, isRTL && styles.rtlText]}>
                      {item.patientNameAr ?? `#${item.id}`}
                    </Text>
                    <View
                      style={[
                        styles.riskBadge,
                        { backgroundColor: `${riskColor}20`, borderColor: riskColor },
                      ]}
                    >
                      <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                        {t(`risk.${item.riskLevel}` as "risk.low")}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.caseMeta, isRTL && styles.rowReverse]}>
                    <View style={[styles.metaItem, isRTL && styles.rowReverse]}>
                      <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>
                        {item.visitDate
                          ? new Date(item.visitDate).toLocaleDateString("ar-SA")
                          : "—"}
                      </Text>
                    </View>
                    {item.gestationalAge && (
                      <View style={[styles.metaItem, isRTL && styles.rowReverse]}>
                        <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>
                          {item.gestationalAge} {t("cases.weeks")}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.complianceText}>
                      {t(`compliance.${item.compliance}` as "compliance.compliant")}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isRTL ? "chevron-back" : "chevron-forward"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t("cases.empty")}</Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 100),
            },
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={() => refetch()}
          refreshing={isLoading && cases.length === 0}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
    },
    headerRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
    screenTitle: {
      fontSize: 24,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    countBadge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countText: {
      color: "#fff",
      fontSize: 13,
      fontFamily: "Tajawal_700Bold",
    },
    filterScroll: { marginBottom: 12 },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
    },
    filterChip: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
    },
    filterChipTextActive: { color: "#fff" },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    retryBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 8,
    },
    retryText: {
      color: "#fff",
      fontFamily: "Tajawal_500Medium",
      fontSize: 14,
    },
    listContent: { gap: 8 },
    caseCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      paddingRight: 14,
    },
    pressed: { opacity: 0.75 },
    riskStripe: { width: 5, alignSelf: "stretch" },
    caseContent: { flex: 1, padding: 14 },
    caseHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      gap: 8,
    },
    patientName: {
      fontSize: 15,
      fontWeight: "600",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      flex: 1,
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
    caseMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    complianceText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: colors.mutedForeground,
    },
  });
}
