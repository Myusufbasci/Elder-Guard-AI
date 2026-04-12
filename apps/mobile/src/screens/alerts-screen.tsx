import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";
import { useThemeColors } from "../utils/theme";
import {
  sortAlerts,
  getSeverityColor,
  formatTimestamp,
} from "../utils/chart-helpers";
import type { AlertDoc } from "../utils/chart-helpers";

/**
 * Active Alerts Screen.
 * Real-time Firestore subscription to unresolved alerts.
 */
export default function AlertsScreen() {
  const colors = useThemeColors();
  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Real-time Firestore listener ──
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.alerts),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: AlertDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AlertDoc, "id">),
        }));
        setAlerts(sortAlerts(docs));
        setLoading(false);
      },
      (error) => {
        console.error("[AlertsScreen] Firestore listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.alerts, alertId), {
        acknowledged: true,
      });
    } catch (error) {
      console.error("[AlertsScreen] Failed to acknowledge alert:", error);
    }
  };

  const renderAlert = ({ item }: { item: AlertDoc }) => {
    const severityColor = getSeverityColor(item.severity);

    return (
      <View
        style={[
          styles.alertCard,
          {
            backgroundColor: colors.surface,
            borderLeftColor: severityColor,
            opacity: item.acknowledged ? 0.6 : 1,
          },
        ]}
      >
        <View style={styles.alertHeader}>
          <View
            style={[styles.severityBadge, { backgroundColor: severityColor }]}
          >
            <Text
              style={styles.severityText}
              maxFontSizeMultiplier={1.3}
              allowFontScaling={true}
            >
              {item.severity.toUpperCase()}
            </Text>
          </View>
          <Text
            style={[styles.alertTime, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            {formatTimestamp(item.createdAt)}
          </Text>
        </View>

        <Text
          style={[styles.alertMessage, { color: colors.text }]}
          allowFontScaling={true}
        >
          {item.message}
        </Text>

        <View style={styles.alertFooter}>
          <Text
            style={[styles.alertType, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            {item.type.replace(/_/g, " ")}
          </Text>

          {!item.acknowledged && (
            <TouchableOpacity
              style={[
                styles.acknowledgeButton,
                { borderColor: colors.primary },
              ]}
              onPress={() => handleAcknowledge(item.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.acknowledgeText, { color: colors.primary }]}
                maxFontSizeMultiplier={1.3}
                allowFontScaling={true}
              >
                Acknowledge
              </Text>
            </TouchableOpacity>
          )}

          {item.acknowledged && (
            <Text
              style={[styles.acknowledgedLabel, { color: colors.success }]}
              allowFontScaling={true}
            >
              ✓ Acknowledged
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text
        style={[styles.headerTitle, { color: colors.text }]}
        maxFontSizeMultiplier={1.5}
        allowFontScaling={true}
      >
        Active Alerts
      </Text>
      <Text
        style={[styles.headerSubtitle, { color: colors.textMuted }]}
        allowFontScaling={true}
      >
        {alerts.filter((a) => !a.acknowledged).length} unresolved
      </Text>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text
            style={[styles.emptyText, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            No alerts. Everything looks normal.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  centered: { alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  headerSubtitle: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  list: { paddingBottom: 30 },
  alertCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  alertTime: { fontSize: 12 },
  alertMessage: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  alertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertType: { fontSize: 12, textTransform: "capitalize" },
  acknowledgeButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  acknowledgeText: { fontSize: 13, fontWeight: "600" },
  acknowledgedLabel: { fontSize: 13, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, textAlign: "center" },
});
