import { Feather, Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useMemo } from "react";
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";
import { useGuideGenerationStatus } from "@/hooks/useGuideGenerationStatus";
import { useListAppointments } from "@workspace/api-client-react";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const safeAreaInsets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { isAuthenticated, isLoading } = useAuth();
  const isGuideGenerating = useGuideGenerationStatus();

  const { data: appointments } = useListAppointments();

  const needsActionCount = useMemo(() => {
    if (!appointments) return 0;
    const today = localDateStr(new Date());
    return appointments.filter((a) => a.appointmentDate.slice(0, 10) < today && a.attended === null)
      .length;
  }, [appointments]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={styles.container}>
      {isGuideGenerating && (
        <View
          style={[
            styles.guideIndicator,
            isRTL ? styles.guideIndicatorLeft : styles.guideIndicatorRight,
            { top: safeAreaInsets.top + 10 },
          ]}
        >
          <ActivityIndicator
            size="small"
            color="#2563eb"
            accessibilityLabel={t("guide.generating")}
            accessibilityRole="progressbar"
          />
        </View>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: {
            fontFamily: "Tajawal_500Medium",
            fontSize: 11,
          },
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.background,
            borderTopWidth: Platform.OS === "web" ? 1 : 0,
            borderTopColor: colors.border,
            elevation: 0,
            paddingBottom: safeAreaInsets.bottom,
            height: Platform.OS === "web" ? 67 : undefined,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
            ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav.dashboard"),
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={24} />
              ) : (
                <Feather name="home" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="patients"
          options={{
            title: t("nav.patients"),
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="person.2" tintColor={color} size={24} />
              ) : (
                <Ionicons name="people-outline" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="cases"
          options={{
            title: t("nav.cases"),
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="doc.text" tintColor={color} size={24} />
              ) : (
                <Ionicons name="document-text-outline" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="appointments"
          options={{
            title: t("nav.appointments"),
            tabBarBadge: needsActionCount > 0 ? needsActionCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: "#ef4444",
              fontSize: 10,
              fontFamily: "Tajawal_700Bold",
            },
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="calendar" tintColor={color} size={24} />
              ) : (
                <Ionicons name="calendar-outline" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: t("nav.alerts"),
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="bell" tintColor={color} size={24} />
              ) : (
                <Ionicons name="notifications-outline" size={22} color={color} />
              ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guideIndicator: {
    position: "absolute",
    zIndex: 100,
    backgroundColor: "rgba(239, 246, 255, 0.92)",
    borderRadius: 20,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  guideIndicatorRight: {
    right: 14,
  },
  guideIndicatorLeft: {
    left: 14,
  },
});
