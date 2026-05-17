import { Ionicons } from "@expo/vector-icons";
import {
  useCreateAppointment,
  useDeleteAppointment,
  useListAppointments,
  useListHospitals,
  useListPregnancies,
  useUpdateAppointment,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

type DateFilter = "today" | "week" | "all";
type AttendanceFilter = "all" | "pending" | "attended" | "missed" | "needs_action";
type RiskFilter = "all" | "critical" | "high" | "medium" | "low";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToday(): string {
  return localDateStr(new Date());
}

function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  return d.toISOString().startsWith(str);
}

function isoWeekRange(): { start: string; end: string } {
  const d = new Date();
  const dow = d.getDay();
  const diffToStart = (dow + 1) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: localDateStr(start),
    end: localDateStr(end),
  };
}

export default function AppointmentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const topWebPadding = Platform.OS === "web" ? 67 : 0;

  const params = useLocalSearchParams<{ filter?: string }>();

  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [attendanceFilter, setAttendanceFilter] =
    useState<AttendanceFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  useEffect(() => {
    if (params.filter === "needs_action") {
      setAttendanceFilter("needs_action");
      setDateFilter("all");
      setRiskFilter("all");
    } else {
      setAttendanceFilter("all");
      setDateFilter("today");
      setRiskFilter("all");
    }
  }, [params.filter]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [pregnancySearch, setPregnancySearch] = useState("");
  const [selectedPregnancyId, setSelectedPregnancyId] = useState<number | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [newApptDate, setNewApptDate] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingApptId, setEditingApptId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHospitalId, setEditHospitalId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useListAppointments();
  const updateAppt = useUpdateAppointment();
  const createAppt = useCreateAppointment();
  const deleteAppt = useDeleteAppointment();

  const { data: pregnanciesData } = useListPregnancies({ limit: 200 });
  const { data: hospitalsData } = useListHospitals();

  const all = data ?? [];
  const allPregnancies = pregnanciesData?.items ?? [];
  const allHospitals = hospitalsData ?? [];

  const today = isoToday();
  const week = isoWeekRange();

  const RISK_ORDER: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const needsActionCount = useMemo(
    () => all.filter((a) => a.appointmentDate.slice(0, 10) < today && a.attended === null).length,
    [all, today]
  );

  const filtered = useMemo(() => {
    return all
      .filter((a: (typeof all)[0]) => {
        const apptDate = a.appointmentDate.slice(0, 10);
        if (dateFilter === "today" && apptDate !== today) return false;
        if (dateFilter === "week" && (apptDate < week.start || apptDate > week.end))
          return false;
        if (attendanceFilter === "needs_action") {
          return apptDate < today && a.attended === null;
        }
        if (attendanceFilter === "pending" && a.attended !== null) return false;
        if (attendanceFilter === "attended" && a.attended !== true) return false;
        if (attendanceFilter === "missed" && a.attended !== false) return false;
        if (riskFilter !== "all" && a.riskLevel !== riskFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const riskA = RISK_ORDER[a.riskLevel ?? ""] ?? 4;
        const riskB = RISK_ORDER[b.riskLevel ?? ""] ?? 4;
        if (riskA !== riskB) return riskA - riskB;
        return a.appointmentDate.localeCompare(b.appointmentDate);
      });
  }, [all, dateFilter, attendanceFilter, riskFilter, today, week.start, week.end]);

  const filteredPregnancies = useMemo(() => {
    const q = pregnancySearch.trim().toLowerCase();
    if (!q) return allPregnancies.slice(0, 50);
    return allPregnancies.filter((p) => {
      const name = (p.patientNameAr ?? "").toLowerCase();
      const nid = (p.patientNationalId ?? "").toLowerCase();
      return name.includes(q) || nid.includes(q);
    }).slice(0, 50);
  }, [allPregnancies, pregnancySearch]);

  const selectedPregnancy = allPregnancies.find(
    (p) => p.id === selectedPregnancyId
  );

  const styles = makeStyles(colors, isRTL);

  const dateFilterTabs: { key: DateFilter; label: string }[] = [
    { key: "today", label: t("appointments.filterToday") },
    { key: "week", label: t("appointments.filterWeek") },
    { key: "all", label: t("appointments.filterAll") },
  ];

  const attendanceFilterTabs: { key: AttendanceFilter; label: string }[] = [
    { key: "all", label: t("cases.all") },
    { key: "needs_action", label: t("appointments.needsAction") },
    { key: "pending", label: t("appt.pending") },
    { key: "attended", label: t("appt.attended") },
    { key: "missed", label: t("appt.missed") },
  ];

  const riskFilterTabs: { key: RiskFilter; label: string }[] = [
    { key: "all", label: t("cases.all") },
    { key: "critical", label: t("risk.critical") },
    { key: "high", label: t("risk.high") },
    { key: "medium", label: t("risk.medium") },
    { key: "low", label: t("risk.low") },
  ];

  function handleMarkAttendance(id: number, attended: boolean) {
    setUpdatingId(id);
    updateAppt.mutate(
      { id, data: { attended } },
      {
        onSuccess: () => {
          setUpdatingId(null);
          refetch();
        },
        onError: () => {
          setUpdatingId(null);
          Alert.alert(t("appt.updateError"));
        },
      }
    );
  }

  function confirmAttendance(id: number, attended: boolean) {
    const action = attended ? t("appt.markAttended") : t("appt.markMissed");
    Alert.alert(action, undefined, [
      { text: t("general.cancel"), style: "cancel" },
      {
        text: t("general.confirm"),
        style: attended ? "default" : "destructive",
        onPress: () => handleMarkAttendance(id, attended),
      },
    ]);
  }

  function getAttendanceBadge(attended: boolean | null) {
    if (attended === true)
      return { label: t("appt.attended"), bg: "#dcfce7", color: "#15803d" };
    if (attended === false)
      return { label: t("appt.missed"), bg: "#fee2e2", color: "#b91c1c" };
    return { label: t("appt.pending"), bg: "#fef9c3", color: "#92400e" };
  }

  function getRiskActiveStyle(key: Exclude<RiskFilter, "all">) {
    const bgs: Record<Exclude<RiskFilter, "all">, string> = {
      critical: "#7f1d1d",
      high: "#fef2f2",
      medium: "#fff7ed",
      low: "#f0fdf4",
    };
    return { backgroundColor: bgs[key], borderColor: bgs[key] };
  }

  function getRiskActiveTextStyle(key: Exclude<RiskFilter, "all">) {
    const colors: Record<Exclude<RiskFilter, "all">, string> = {
      critical: "#fef2f2",
      high: "#b91c1c",
      medium: "#c2410c",
      low: "#15803d",
    };
    return { color: colors[key] };
  }

  function getRiskBadge(riskLevel: string | null | undefined) {
    switch (riskLevel) {
      case "critical":
        return { label: t("risk.critical"), bg: "#7f1d1d", color: "#fef2f2" };
      case "high":
        return { label: t("risk.high"), bg: "#fef2f2", color: "#b91c1c" };
      case "medium":
        return { label: t("risk.medium"), bg: "#fff7ed", color: "#c2410c" };
      case "low":
        return { label: t("risk.low"), bg: "#f0fdf4", color: "#15803d" };
      default:
        return null;
    }
  }

  function handleOpenEdit(item: (typeof all)[0]) {
    setEditingApptId(item.id);
    setEditDate(item.appointmentDate.slice(0, 10));
    setEditHospitalId(item.hospitalId ?? null);
    setShowEditModal(true);
  }

  function handleCloseEdit() {
    setShowEditModal(false);
    setEditingApptId(null);
    setEditDate("");
    setEditHospitalId(null);
  }

  function handleSaveEdit() {
    if (!editingApptId || !editDate.trim() || !editHospitalId) return;
    updateAppt.mutate(
      { id: editingApptId, data: { appointmentDate: editDate.trim(), hospitalId: editHospitalId } },
      {
        onSuccess: () => {
          handleCloseEdit();
          refetch();
          Alert.alert(t("appt.editSuccess"));
        },
        onError: () => {
          Alert.alert(t("appt.editError"));
        },
      }
    );
  }

  function handleDeleteAppt(id: number) {
    Alert.alert(t("appt.cancel"), t("appt.cancelConfirm"), [
      { text: t("general.cancel"), style: "cancel" },
      {
        text: t("appt.cancel"),
        style: "destructive",
        onPress: () => {
          setDeletingId(id);
          deleteAppt.mutate(
            { id },
            {
              onSuccess: () => {
                setDeletingId(null);
                refetch();
                Alert.alert(t("appt.cancelSuccess"));
              },
              onError: () => {
                setDeletingId(null);
                Alert.alert(t("appt.cancelError"));
              },
            }
          );
        },
      },
    ]);
  }

  function resetNewApptForm() {
    setPregnancySearch("");
    setSelectedPregnancyId(null);
    setSelectedHospitalId(null);
    setNewApptDate("");
  }

  function handleCloseModal() {
    setShowNewModal(false);
    resetNewApptForm();
  }

  function handleSubmitNewAppt() {
    if (!selectedPregnancyId || !selectedHospitalId || !newApptDate.trim()) return;
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
          handleCloseModal();
          refetch();
          Alert.alert(t("appointments.createSuccess"));
        },
        onError: () => {
          Alert.alert(t("appointments.createError"));
        },
      }
    );
  }

  const canSubmit =
    !!selectedPregnancyId && !!selectedHospitalId && isValidIsoDate(newApptDate.trim());

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + topWebPadding + 16 },
      ]}
    >
      <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
        <Text style={[styles.screenTitle, isRTL && styles.rtlText]}>
          {t("appointments.title")}
        </Text>
        <View style={[styles.headerRight, isRTL && styles.rowReverse]}>
          {!isLoading && (
            <Text style={styles.countBadge}>
              {filtered.length} {t("appointments.totalCount")}
            </Text>
          )}
          <Pressable
            style={styles.newApptBtn}
            onPress={() => setShowNewModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newApptBtnText}>
              {t("appointments.newAppointment")}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Needs Action Banner */}
      {!isLoading && needsActionCount > 0 && (
        <Pressable
          style={[styles.needsActionBanner, isRTL && styles.rowReverse]}
          onPress={() => {
            setAttendanceFilter("needs_action");
            setDateFilter("all");
          }}
        >
          <View style={[styles.needsActionLeft, isRTL && styles.rowReverse]}>
            <Ionicons name="alert-circle" size={20} color="#c2410c" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.needsActionCount, isRTL && styles.rtlText]}>
                {needsActionCount} {t("appointments.needsAction")}
              </Text>
              <Text style={[styles.needsActionSub, isRTL && styles.rtlText]}>
                {t("appointments.needsActionBanner")}
              </Text>
            </View>
          </View>
          <Ionicons
            name={isRTL ? "chevron-back" : "chevron-forward"}
            size={16}
            color="#c2410c"
          />
        </Pressable>
      )}

      <View style={[styles.filterRow, isRTL && styles.rowReverse]}>
        {dateFilterTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTab,
              dateFilter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setDateFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                dateFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.filterRow, isRTL && styles.rowReverse]}>
        {attendanceFilterTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTabSmall,
              attendanceFilter === tab.key && styles.filterTabSmallActive,
              tab.key === "needs_action" && styles.filterTabNeedsAction,
              tab.key === "needs_action" && attendanceFilter === "needs_action" && styles.filterTabNeedsActionActive,
            ]}
            onPress={() => {
              setAttendanceFilter(tab.key);
              if (tab.key === "needs_action") setDateFilter("all");
            }}
          >
            {tab.key === "needs_action" && needsActionCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{needsActionCount}</Text>
              </View>
            )}
            <Text
              style={[
                styles.filterTabSmallText,
                attendanceFilter === tab.key && styles.filterTabSmallTextActive,
                tab.key === "needs_action" && styles.filterTabNeedsActionText,
                tab.key === "needs_action" && attendanceFilter === "needs_action" && styles.filterTabNeedsActionTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.filterRow, isRTL && styles.rowReverse]}>
        {riskFilterTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTabSmall,
              riskFilter === tab.key && styles.filterTabSmallActive,
              riskFilter === tab.key &&
                tab.key !== "all" &&
                getRiskActiveStyle(tab.key),
            ]}
            onPress={() => setRiskFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabSmallText,
                riskFilter === tab.key && styles.filterTabSmallTextActive,
                riskFilter === tab.key &&
                  tab.key !== "all" &&
                  getRiskActiveTextStyle(tab.key),
              ]}
            >
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
          <Ionicons
            name="cloud-offline"
            size={40}
            color={colors.mutedForeground}
          />
          <Text style={styles.emptyText}>{t("general.error")}</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>{t("general.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const badge = getAttendanceBadge(item.attended);
            const riskBadge = getRiskBadge(item.riskLevel);
            const isUpdating = updatingId === item.id;
            const apptDate = item.appointmentDate.slice(0, 10);
            const isNeedsAction = apptDate < today && item.attended === null;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  isNeedsAction && styles.cardNeedsAction,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  router.push(`/pregnancy/${item.pregnancyId}`)
                }
                testID={`appt-${item.id}`}
              >
                {isNeedsAction && (
                  <View style={[styles.needsActionCardBadge, isRTL ? styles.needsActionCardBadgeRTL : null]}>
                    <Ionicons name="alert-circle" size={12} color="#c2410c" />
                    <Text style={styles.needsActionCardBadgeText}>
                      {t("appointments.needsAction")}
                    </Text>
                  </View>
                )}

                <View style={[styles.cardTop, isRTL && styles.rowReverse]}>
                  <View style={styles.dateBlock}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={isNeedsAction ? "#c2410c" : colors.primary}
                    />
                    <Text style={[styles.dateText, isRTL && styles.rtlText, isNeedsAction && styles.dateTextNeedsAction]}>
                      {apptDate}
                    </Text>
                  </View>
                  <View style={[styles.badgeRow, isRTL && styles.rowReverse]}>
                    {riskBadge && (
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: riskBadge.bg },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: riskBadge.color }]}>
                          {riskBadge.label}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: badge.bg },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {item.patientNameAr && (
                  <Text style={[styles.patientName, isRTL && styles.rtlText]}>
                    {item.patientNameAr}
                  </Text>
                )}
                {item.patientNationalId && (
                  <Text style={[styles.nationalId, isRTL && styles.rtlText]}>
                    {item.patientNationalId}
                  </Text>
                )}

                <View style={[styles.metaRow, isRTL && styles.rowReverse]}>
                  {item.hospitalNameAr && (
                    <View
                      style={[styles.metaItem, isRTL && styles.rowReverse]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={13}
                        color={colors.mutedForeground}
                      />
                      <Text style={styles.metaText}>{item.hospitalNameAr}</Text>
                    </View>
                  )}
                  {item.sectorNameAr && (
                    <View
                      style={[styles.metaItem, isRTL && styles.rowReverse]}
                    >
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={colors.mutedForeground}
                      />
                      <Text style={styles.metaText}>{item.sectorNameAr}</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.actionRow, isRTL && styles.rowReverse]}>
                  {item.attended !== true && (
                    <Pressable
                      style={[styles.actionBtn, styles.attendedBtn]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        confirmAttendance(item.id, true);
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.actionBtnText}>
                          {t("appt.markAttended")}
                        </Text>
                      )}
                    </Pressable>
                  )}
                  {item.attended !== false && (
                    <Pressable
                      style={[styles.actionBtn, styles.missedBtn]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        confirmAttendance(item.id, false);
                      }}
                      disabled={isUpdating}
                    >
                      <Text style={[styles.actionBtnText, { color: "#b91c1c" }]}>
                        {t("appt.markMissed")}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={[styles.actionRow, isRTL && styles.rowReverse]}>
                  <Pressable
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleOpenEdit(item);
                    }}
                    disabled={deletingId === item.id}
                  >
                    <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                      {t("appt.edit")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleDeleteAppt(item.id);
                    }}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#b91c1c" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                        <Text style={[styles.actionBtnText, { color: "#b91c1c" }]}>
                          {t("appt.cancel")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="calendar-outline"
                size={56}
                color={colors.primary}
              />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {t("appointments.empty")}
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 84 : 100),
            },
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={() => refetch()}
          refreshing={isLoading && all.length === 0}
        />
      )}

      {/* Edit Appointment Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseEdit}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.modalContainer,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={[styles.modalHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {t("appt.editTitle")}
              </Text>
              <Pressable
                style={styles.closeBtn}
                onPress={handleCloseEdit}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
                {t("appointments.selectHospital")}
              </Text>
              <View style={styles.hospitalGrid}>
                {allHospitals.map((h) => (
                  <Pressable
                    key={h.id}
                    style={[
                      styles.hospitalChip,
                      editHospitalId === h.id && styles.hospitalChipActive,
                    ]}
                    onPress={() => setEditHospitalId(h.id)}
                  >
                    <Text
                      style={[
                        styles.hospitalChipText,
                        editHospitalId === h.id && styles.hospitalChipTextActive,
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
                value={editDate}
                onChangeText={setEditDate}
                keyboardType="numeric"
                maxLength={10}
                textAlign={isRTL ? "right" : "left"}
              />

              <Pressable
                style={[
                  styles.submitBtn,
                  (!editHospitalId || !isValidIsoDate(editDate.trim()) || updateAppt.isPending) &&
                    styles.submitBtnDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={!editHospitalId || !isValidIsoDate(editDate.trim()) || updateAppt.isPending}
              >
                {updateAppt.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{t("appt.save")}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showNewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.modalContainer,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={[styles.modalHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {t("appointments.newApptTitle")}
              </Text>
              <Pressable
                style={styles.closeBtn}
                onPress={handleCloseModal}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
                {t("appointments.selectPregnancy")}
              </Text>

              {selectedPregnancy ? (
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
                  <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
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
                            <Text style={[styles.pickItemName, isRTL && styles.rtlText]}>
                              {p.patientNameAr ?? "—"}
                            </Text>
                            <Text style={[styles.pickItemSub, isRTL && styles.rtlText]}>
                              {p.patientNationalId ?? ""}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.mutedForeground}
                            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
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
                        selectedHospitalId === h.id && styles.hospitalChipTextActive,
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
                  (!canSubmit || createAppt.isPending) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmitNewAppt}
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
      marginBottom: 12,
    },
    headerRight: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
    },
    screenTitle: {
      fontSize: 22,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    countBadge: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: colors.mutedForeground,
    },
    newApptBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    newApptBtnText: {
      color: "#fff",
      fontSize: 13,
      fontFamily: "Tajawal_700Bold",
    },

    needsActionBanner: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#fff7ed",
      borderWidth: 1,
      borderColor: "#fed7aa",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      gap: 10,
    },
    needsActionLeft: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    needsActionCount: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: "#c2410c",
    },
    needsActionSub: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: "#9a3412",
      marginTop: 1,
    },

    filterRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: 8,
      marginBottom: 10,
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

    filterTabSmall: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterTabSmallActive: {
      backgroundColor: colors.primary + "22",
      borderColor: colors.primary,
    },
    filterTabSmallText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: colors.mutedForeground,
    },
    filterTabSmallTextActive: {
      color: colors.primary,
      fontFamily: "Tajawal_700Bold",
    },
    filterTabNeedsAction: {
      borderColor: "#fed7aa",
      backgroundColor: "#fff7ed",
      position: "relative",
    },
    filterTabNeedsActionActive: {
      backgroundColor: "#ffedd5",
      borderColor: "#f97316",
    },
    filterTabNeedsActionText: {
      color: "#c2410c",
    },
    filterTabNeedsActionTextActive: {
      color: "#c2410c",
      fontFamily: "Tajawal_700Bold",
    },
    filterBadge: {
      position: "absolute",
      top: -6,
      right: -6,
      backgroundColor: "#ef4444",
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    filterBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontFamily: "Tajawal_700Bold",
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
    listContent: { gap: 10 },

    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    cardNeedsAction: {
      borderColor: "#fed7aa",
      backgroundColor: "#fffbf5",
    },
    pressed: { opacity: 0.75 },

    needsActionCardBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      backgroundColor: "#ffedd5",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    needsActionCardBadgeRTL: {
      alignSelf: "flex-end",
    },
    needsActionCardBadgeText: {
      fontSize: 11,
      fontFamily: "Tajawal_700Bold",
      color: "#c2410c",
    },

    cardTop: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateBlock: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 5,
    },
    dateText: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    dateTextNeedsAction: {
      color: "#c2410c",
    },
    badgeRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: 6,
      alignItems: "center",
    },
    statusBadge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    statusText: {
      fontSize: 12,
      fontFamily: "Tajawal_700Bold",
    },

    patientName: {
      fontSize: 15,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    nationalId: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },

    metaRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: 12,
      flexWrap: "wrap",
    },
    metaItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },

    actionRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    attendedBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    missedBtn: {
      backgroundColor: "#fee2e2",
      borderColor: "#fecaca",
    },
    editBtn: {
      flexDirection: "row",
      gap: 4,
      backgroundColor: colors.primary + "12",
      borderColor: colors.primary + "40",
    },
    deleteBtn: {
      flexDirection: "row",
      gap: 4,
      backgroundColor: "#fee2e2",
      borderColor: "#fecaca",
    },
    actionBtnText: {
      fontSize: 13,
      fontFamily: "Tajawal_500Medium",
      color: "#fff",
    },

    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
    },
    modalHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    closeBtn: {
      padding: 4,
    },
    modalContent: {
      gap: 8,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
      marginTop: 12,
      marginBottom: 4,
    },
    searchInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: "Tajawal_400Regular",
      color: colors.foreground,
    },
    noResults: {
      fontSize: 13,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      paddingVertical: 12,
    },
    pickList: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
      maxHeight: 220,
    },
    pickItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    pickItemName: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.foreground,
    },
    pickItemSub: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    selectedCard: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      backgroundColor: colors.primary + "15",
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    selectedCardName: {
      fontSize: 14,
      fontFamily: "Tajawal_700Bold",
      color: colors.primary,
    },
    selectedCardSub: {
      fontSize: 12,
      fontFamily: "Tajawal_400Regular",
      color: colors.mutedForeground,
    },
    hospitalGrid: {
      flexDirection: isRTL ? "row-reverse" : "row",
      flexWrap: "wrap",
      gap: 8,
    },
    hospitalChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: "48%",
      minWidth: "30%",
    },
    hospitalChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    hospitalChipText: {
      fontSize: 12,
      fontFamily: "Tajawal_500Medium",
      color: colors.foreground,
      textAlign: "center",
    },
    hospitalChipTextActive: {
      color: "#fff",
    },
    dateInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Tajawal_400Regular",
      color: colors.foreground,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 16,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitBtnText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: "Tajawal_700Bold",
    },
  });
}
