import { Ionicons } from "@expo/vector-icons";
import { useListPatients } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";
import { GuideGenerationBanner } from "@/components/GuideGenerationBanner";

export default function PatientsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const [search, setSearch] = useState("");
  const topWebPadding = Platform.OS === "web" ? 67 : 0;

  const { data, isLoading, isError, refetch } = useListPatients({
    search: search.length >= 2 ? search : undefined,
    limit: 50,
  });

  const styles = makeStyles(colors, isRTL);
  const patients = data?.items ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + topWebPadding + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, isRTL && styles.rtlText]}>{t("patients.title")}</Text>
        {data && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{data.total}</Text>
          </View>
        )}
      </View>

      <GuideGenerationBanner />

      <View style={[styles.searchWrap, isRTL && styles.rowReverse]}>
        <Ionicons
          name="search"
          size={18}
          color={colors.mutedForeground}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, isRTL && styles.rtlText]}
          placeholder={t("patients.search")}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          testID="patient-search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
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
          data={patients}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.patientCard, pressed && styles.pressed]}
              onPress={() => router.push(`/patient/${item.id}`)}
              testID={`patient-${item.id}`}
            >
              <View style={[styles.cardRow, isRTL && styles.rowReverse]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.nameAr.charAt(0)}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.patientName, isRTL && styles.rtlText]}>{item.nameAr}</Text>
                  <View style={[styles.metaRow, isRTL && styles.rowReverse]}>
                    <Ionicons name="card-outline" size={12} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{item.nationalId}</Text>
                  </View>
                  {item.sectorNameAr && (
                    <View style={[styles.metaRow, isRTL && styles.rowReverse]}>
                      <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>{item.sectorNameAr}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rightSide}>
                  {(item.totalPregnancies ?? 0) > 0 && (
                    <View style={styles.caseBadge}>
                      <Text style={styles.caseBadgeText}>
                        {item.totalPregnancies} {t("patients.cases")}
                      </Text>
                    </View>
                  )}
                  <Ionicons
                    name={isRTL ? "chevron-back" : "chevron-forward"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t("patients.empty")}</Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 100) },
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={() => refetch()}
          refreshing={isLoading && patients.length === 0}
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
      marginBottom: 16,
    },
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
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 16,
      height: 48,
      gap: 8,
    },
    searchIcon: {},
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Tajawal_400Regular",
      color: colors.foreground,
    },
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
    patientCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    pressed: { opacity: 0.75 },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.primary}20`,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.primary,
    },
    cardContent: { flex: 1, gap: 3 },
    patientName: {
      fontSize: 15,
      fontWeight: "600",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    rightSide: {
      alignItems: "center",
      gap: 4,
    },
    caseBadge: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    caseBadgeText: {
      fontSize: 11,
      fontFamily: "Tajawal_500Medium",
      color: colors.primary,
    },
  });
}
