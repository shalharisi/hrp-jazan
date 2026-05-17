import { Ionicons } from "@expo/vector-icons";
import {
  useCreateAppointment,
  useListHospitals,
  useListPregnancies,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/context/I18nContext";
import { useColors } from "@/hooks/useColors";

function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  return d.toISOString().startsWith(str);
}

interface NewAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPregnancyId?: number;
  initialPregnancyLabel?: { nameAr: string; nationalId?: string | null };
  initialHospitalId?: number;
}

export function NewAppointmentModal({
  visible,
  onClose,
  onSuccess,
  initialPregnancyId,
  initialPregnancyLabel,
  initialHospitalId,
}: NewAppointmentModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();

  const [pregnancySearch, setPregnancySearch] = useState("");
  const [selectedPregnancyId, setSelectedPregnancyId] = useState<number | null>(
    initialPregnancyId ?? null
  );
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(
    initialHospitalId ?? null
  );
  const [newApptDate, setNewApptDate] = useState("");

  const createAppt = useCreateAppointment();
  const { data: pregnanciesData } = useListPregnancies({ limit: 200 });
  const { data: hospitalsData } = useListHospitals();

  const allPregnancies = pregnanciesData?.items ?? [];
  const allHospitals = hospitalsData ?? [];

  useEffect(() => {
    if (visible) {
      setPregnancySearch("");
      setSelectedPregnancyId(initialPregnancyId ?? null);
      setSelectedHospitalId(initialHospitalId ?? null);
      setNewApptDate("");
    }
  }, [visible, initialPregnancyId, initialHospitalId]);

  const filteredPregnancies = useMemo(() => {
    const q = pregnancySearch.trim().toLowerCase();
    if (!q) return allPregnancies.slice(0, 50);
    return allPregnancies
      .filter((p) => {
        const name = (p.patientNameAr ?? "").toLowerCase();
        const nid = (p.patientNationalId ?? "").toLowerCase();
        return name.includes(q) || nid.includes(q);
      })
      .slice(0, 50);
  }, [allPregnancies, pregnancySearch]);

  const selectedPregnancy = allPregnancies.find(
    (p) => p.id === selectedPregnancyId
  );

  const styles = makeStyles(colors, isRTL);

  function handleClose() {
    onClose();
  }

  function handleSubmit() {
    if (!selectedPregnancyId || !selectedHospitalId || !newApptDate.trim())
      return;
    createAppt.mutate(
      {
        data: {
          pregnancyId: selectedPregnancyId,
          hospitalId: selectedHospitalId,
          appointmentDate: newApptDate.trim(),
        },
      },
      {
        onSuccess: () => {
          handleClose();
          onSuccess();
          Alert.alert(t("appointments.createSuccess"));
        },
        onError: () => {
          Alert.alert(t("appointments.createError"));
        },
      }
    );
  }

  const canSubmit =
    !!selectedPregnancyId &&
    !!selectedHospitalId &&
    isValidIsoDate(newApptDate.trim());

  const prefilled = !!initialPregnancyId;

  const displayNameAr = initialPregnancyLabel?.nameAr ?? selectedPregnancy?.patientNameAr ?? "—";
  const displayNid = initialPregnancyLabel?.nationalId ?? selectedPregnancy?.patientNationalId ?? "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.container,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.header, isRTL && styles.rowReverse]}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("appointments.newApptTitle")}
            </Text>
            <Pressable
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {t("appointments.selectPregnancy")}
            </Text>

            {prefilled ? (
              <View style={[styles.selectedCard, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectedCardName, isRTL && styles.rtlText]}>
                    {displayNameAr}
                  </Text>
                  {!!displayNid && (
                    <Text style={[styles.selectedCardSub, isRTL && styles.rtlText]}>
                      {displayNid}
                    </Text>
                  )}
                </View>
              </View>
            ) : selectedPregnancy ? (
              <Pressable
                style={[styles.selectedCard, isRTL && styles.rowReverse]}
                onPress={() => setSelectedPregnancyId(null)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectedCardName, isRTL && styles.rtlText]}>
                    {selectedPregnancy.patientNameAr ?? "—"}
                  </Text>
                  <Text style={[styles.selectedCardSub, isRTL && styles.rtlText]}>
                    {selectedPregnancy.patientNationalId ?? ""}
                  </Text>
                </View>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={[styles.searchInput, isRTL && styles.rtlText]}
                  placeholder={t("appointments.searchPregnancy")}
                  placeholderTextColor={colors.mutedForeground}
                  value={pregnancySearch}
                  onChangeText={setPregnancySearch}
                  textAlign={isRTL ? "right" : "left"}
                />
                {filteredPregnancies.length === 0 ? (
                  <Text style={[styles.noResults, isRTL && styles.rtlText]}>
                    {t("appointments.noResults")}
                  </Text>
                ) : (
                  <View style={styles.pickList}>
                    {filteredPregnancies.map((p) => (
                      <Pressable
                        key={p.id}
                        style={({ pressed }) => [
                          styles.pickItem,
                          isRTL && styles.rowReverse,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => setSelectedPregnancyId(p.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.pickItemName, isRTL && styles.rtlText]}
                          >
                            {p.patientNameAr ?? "—"}
                          </Text>
                          <Text
                            style={[styles.pickItemSub, isRTL && styles.rtlText]}
                          >
                            {p.patientNationalId ?? ""}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.mutedForeground}
                          style={
                            isRTL
                              ? { transform: [{ scaleX: -1 }] }
                              : undefined
                          }
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {t("appointments.selectHospital")}
            </Text>
            <View style={styles.hospitalGrid}>
              {allHospitals.map((h) => (
                <Pressable
                  key={h.id}
                  style={[
                    styles.hospitalChip,
                    selectedHospitalId === h.id && styles.hospitalChipActive,
                  ]}
                  onPress={() => setSelectedHospitalId(h.id)}
                >
                  <Text
                    style={[
                      styles.hospitalChipText,
                      selectedHospitalId === h.id &&
                        styles.hospitalChipTextActive,
                      isRTL && styles.rtlText,
                    ]}
                    numberOfLines={2}
                  >
                    {h.nameAr}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {t("appointments.selectDate")}
            </Text>
            <TextInput
              style={[styles.dateInput, isRTL && styles.rtlText]}
              placeholder="2026-01-15"
              placeholderTextColor={colors.mutedForeground}
              value={newApptDate}
              onChangeText={setNewApptDate}
              keyboardType="numeric"
              maxLength={10}
              textAlign={isRTL ? "right" : "left"}
            />

            <Pressable
              style={[
                styles.submitBtn,
                (!canSubmit || createAppt.isPending) &&
                  styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || createAppt.isPending}
            >
              {createAppt.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {t("appointments.submit")}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    rowReverse: { flexDirection: "row-reverse" },
    rtlText: { textAlign: "right" },
    header: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
      gap: 0,
    },
    sectionLabel: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      marginBottom: 10,
      marginTop: 6,
    },
    selectedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: `${colors.primary}10`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    selectedCardName: {
      fontSize: 15,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    selectedCardSub: {
      fontSize: 13,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    searchInput: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      fontFamily: "Tajawal_400Regular",
      color: colors.foreground,
      marginBottom: 8,
    },
    noResults: {
      textAlign: "center",
      color: colors.mutedForeground,
      fontSize: 14,
      fontFamily: "Tajawal_400Regular",
      paddingVertical: 12,
      marginBottom: 16,
    },
    pickList: {
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    pickItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickItemName: {
      fontSize: 14,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
    },
    pickItemSub: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    pressed: { opacity: 0.7 },
    hospitalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    hospitalChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      maxWidth: "48%",
    },
    hospitalChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    hospitalChipText: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
    },
    hospitalChipTextActive: {
      color: "#fff",
    },
    dateInput: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
      marginBottom: 24,
      letterSpacing: 1,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
    },
    submitBtnDisabled: {
      opacity: 0.4,
    },
    submitBtnText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: "Tajawal_700Bold",
    },
  });
}
