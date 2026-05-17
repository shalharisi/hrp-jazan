import { Ionicons } from "@expo/vector-icons";
import { useListAlerts } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";

type AlertFilter = "all" | "vte" | "critical" | "missed";

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const topWebPadding = Platform.OS === "web" ? 67 : 0;
  const [filter, setFilter] = useState<AlertFilter>("all");

  const { data, isLoading, isError, refetch } = useListAlerts();

  const allAlerts = data?.alerts ?? [];
  const filteredAlerts = allAlerts.filter((a) => {
    if (filter === "all") return true;
    if (filter === "vte") return a.type === "vte_without_enoxaparin";
    if (filter === "critical")
      return a.type === "critical_without_appointment" || a.type === "overdue_critical";
    if (filter === "missed") return a.type === "missed_appointment";
    return true;
  });

  const styles = makeStyles(colors, isRTL);

  const filterTabs: { key: AlertFilter; label: string }[] = [
    { key: "all", label: t("alerts.all") },
    { key: "vte", label: t("alerts.vte") },
    { key: "critical", label: t("alerts.critical") },
    { key: "missed", label: t("alerts.missed") },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + topWebPadding + 16 }]}>
      <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
        <Text style={[styles.screenTitle, isRTL && styles.rtlText]}>{t("alerts.title")}</Text>
        {data && data.criticalCount > 0 && (
          <View style={styles.criticalBadge}>
            <Text style={styles.criticalBadgeText}>
              {data.criticalCount} {t("alerts.critical_count")}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.filterRow, isRTL && styles.rowReverse]}>
        {filterTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
          data={filteredAlerts}
          keyExtractor={(item, idx) => `${item.pregnancyId}-${idx}`}
          renderItem={({ item }) => {
            const isCritical = item.severity === "critical";
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.alertCard,
                  isCritical ? styles.alertCardCritical : styles.alertCardWarning,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  item.pregnancyId
                    ? router.push(`/pregnancy/${item.pregnancyId}`)
                    : item.patientId
                      ? router.push(`/patient/${item.patientId}`)
                      : null
                }
                testID={`alert-${item.pregnancyId}`}
              >
                <View
                  style={[
                    styles.alertIconWrap,
                    {
                      backgroundColor: isCritical ? "#fef2f2" : "#fffbeb",
                    },
                  ]}
                >
                  <Ionicons
                    name={isCritical ? "alert-circle" : "warning"}
                    size={24}
                    color={isCritical ? "#ef4444" : "#f59e0b"}
                  />
                </View>
                <View style={styles.alertBody}>
                  <Text style={[styles.alertPatient, isRTL && styles.rtlText]}>
                    {item.patientNameAr}
                  </Text>
                  <Text style={[styles.alertType, isRTL && styles.rtlText]}>
                    {t(`alert.${item.type}` as "alert.missed_appointment")}
                  </Text>
                  <Text style={[styles.alertId, isRTL && styles.rtlText]}>
                    {item.patientNationalId}
                  </Text>
                </View>
                <View style={styles.alertRight}>
                  <View
                    style={[
                      styles.severityBadge,
                      isCritical ? styles.severityCritical : styles.severityWarning,
                    ]}
                  >
                    <Text style={styles.severityText}>
                      {isCritical ? t("risk.critical") : t("risk.high")}
                    </Text>
                  </View>
                  <Ionicons
                    name={isRTL ? "chevron-back" : "chevron-forward"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-circle-outline" size={56} color={colors.primary} />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t("alerts.empty")}</Text>
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
          refreshing={isLoading && allAlerts.length === 0}
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
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
    headerRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    criticalBadge: {
      backgroundColor: "#ef4444",
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    criticalBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontFamily: "Tajawal_700Bold",
    },
    filterRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: 8,
      marginBottom: 16,
    },
    filterTab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterTabText: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
    },
    filterTabTextActive: { color: "#fff" },
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
    listContent: { gap: 10 },
    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      gap: 12,
    },
    alertCardCritical: {
      backgroundColor: "#fff5f5",
      borderColor: "#fecaca",
    },
    alertCardWarning: {
      backgroundColor: "#fffbeb",
      borderColor: "#fde68a",
    },
    pressed: { opacity: 0.75 },
    alertIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    alertBody: { flex: 1, gap: 3 },
    alertPatient: {
      fontSize: 15,
      fontFamily: "Tajawal_700Bold",
      color: "#1a1a1a",
    },
    alertType: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: "#555",
    },
    alertId: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    alertRight: {
      alignItems: "center",
      gap: 6,
    },
    severityBadge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    severityCritical: { backgroundColor: "#fecaca" },
    severityWarning: { backgroundColor: "#fde68a" },
    severityText: {
      fontSize: 11,
      fontFamily: "Tajawal_700Bold",
      color: "#333",
    },
  });
}
