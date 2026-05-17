import { Ionicons } from "@expo/vector-icons";
import { useAuthLogin } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loginMutation = useAuthLogin();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setErrorMsg("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loginMutation.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: async (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await login(data.accessToken, data.user);
          router.replace("/(tabs)");
        },
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setErrorMsg(t("auth.error"));
        },
      }
    );
  };

  const styles = makeStyles(colors, isRTL, insets);

  return (
    <LinearGradient colors={["#006633", "#004d26"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Text style={styles.title}>تجمع جازان الصحي</Text>
            <Text style={styles.subtitle}>{t("auth.subtitle")}</Text>
          </View>

          <View style={styles.card}>
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
              {t("auth.login")}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("auth.username")}
              </Text>
              <View style={[styles.inputWrap, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.mutedForeground}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, isRTL && styles.rtlText]}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t("auth.username")}
                  placeholderTextColor={colors.mutedForeground}
                  testID="username-input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("auth.password")}
              </Text>
              <View style={[styles.inputWrap, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.mutedForeground}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, isRTL && styles.rtlText]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={t("auth.password")}
                  placeholderTextColor={colors.mutedForeground}
                  testID="password-input"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            {!!errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                pressed && styles.loginBtnPressed,
                loginMutation.isPending && styles.loginBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loginMutation.isPending}
              testID="login-button"
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>{t("auth.loginBtn")}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  isRTL: boolean,
  insets: { top: number; bottom: number }
) {
  return StyleSheet.create({
    gradient: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: insets.top + 40,
      paddingBottom: insets.bottom + 40,
    },
    logoSection: { alignItems: "center", marginBottom: 40 },
    logoWrap: {
      width: 96,
      height: 96,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      overflow: "hidden",
    },
    logo: { width: 80, height: 80, borderRadius: 16 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: "#ffffff",
      fontFamily: "Tajawal_700Bold",
      textAlign: "center",
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      fontFamily: "Tajawal_400Regular",
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
      fontFamily: "Tajawal_700Bold",
      marginBottom: 24,
      textAlign: isRTL ? "right" : "left",
    },
    rtlText: { textAlign: "right" },
    rowReverse: { flexDirection: "row-reverse" },
    field: { marginBottom: 16 },
    label: {
      fontSize: 14,
      fontFamily: "Tajawal_500Medium",
      color: colors.mutedForeground,
      marginBottom: 8,
      textAlign: isRTL ? "right" : "left",
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
    },
    inputIcon: { marginRight: 8 },
    input: {
      flex: 1,
      height: 48,
      fontSize: 15,
      fontFamily: "Tajawal_400Regular",
      color: colors.foreground,
      textAlign: isRTL ? "right" : "left",
    },
    eyeBtn: { padding: 4 },
    errorBox: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      backgroundColor: `${colors.destructive}15`,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      gap: 8,
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Tajawal_400Regular",
      color: colors.destructive,
      flex: 1,
      textAlign: isRTL ? "right" : "left",
    },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    loginBtnPressed: { opacity: 0.85 },
    loginBtnDisabled: { opacity: 0.6 },
    loginBtnText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
    },
  });
}
