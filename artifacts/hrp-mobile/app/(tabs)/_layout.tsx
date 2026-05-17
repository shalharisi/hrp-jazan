import { Feather, Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const safeAreaInsets = useSafeAreaInsets();
  const { t } = useI18n();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
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
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
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
  );
}
