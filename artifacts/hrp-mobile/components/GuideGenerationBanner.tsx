import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useI18n } from "@/context/I18nContext";
import { useGuideGenerationStatus } from "@/hooks/useGuideGenerationStatus";

export function GuideGenerationBanner() {
  const { t, isRTL } = useI18n();
  const isGuideGenerating = useGuideGenerationStatus();

  if (!isGuideGenerating) return null;

  const styles = makeStyles();

  return (
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
  );
}

function makeStyles() {
  return StyleSheet.create({
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
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
