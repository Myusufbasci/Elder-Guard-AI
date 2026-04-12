import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";
import { useAuthStore } from "../store/use-auth-store";
import { useThemeColors } from "../utils/theme";
import {
  formatScoresToChartData,
  calculateComplianceScore,
  hasEnoughDataForChart,
  formatTimestamp,
} from "../utils/chart-helpers";
import type { AnomalyScoreDoc, ChartDataPoint } from "../utils/chart-helpers";

const SCREEN_WIDTH = Dimensions.get("window").width;

/**
 * Main Guardian Dashboard.
 * Circular Progress Bar for compliance score + 24h trend chart.
 */
export default function DashboardScreen() {
  const colors = useThemeColors();
  const { uid } = useAuthStore();
  const [scores, setScores] = useState<AnomalyScoreDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Real-time Firestore listener for anomaly scores ──
  useEffect(() => {
    if (!uid) return;

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    const q = query(
      collection(db, COLLECTIONS.anomalyScores),
      where("computedAt", ">=", twentyFourHoursAgo),
      orderBy("computedAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: AnomalyScoreDoc[] = snapshot.docs.map((d) => ({
          ...(d.data() as AnomalyScoreDoc),
        }));
        setScores(docs);
        setLoading(false);
      },
      (error) => {
        console.error("[DashboardScreen] Firestore listener error:", error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount — prevents memory leaks
    return () => unsubscribe();
  }, [uid]);

  const complianceScore = useMemo(
    () => calculateComplianceScore(scores),
    [scores]
  );
  const chartData = useMemo(
    () => formatScoresToChartData(scores),
    [scores]
  );
  const hasChart = useMemo(
    () => hasEnoughDataForChart(scores),
    [scores]
  );

  // ── Circular Progress Bar ──
  const circleSize = 180;
  const strokeWidth = 14;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (complianceScore / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.error;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Circular Progress */}
      <View style={styles.circleContainer}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          maxFontSizeMultiplier={1.5}
          allowFontScaling={true}
        >
          Routine Compliance
        </Text>
        <View style={styles.circleWrapper}>
          <Svg width={circleSize} height={circleSize}>
            {/* Background circle */}
            <Circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={colors.surface}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <Circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={getScoreColor(complianceScore)}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${circleSize / 2}, ${circleSize / 2}`}
            />
          </Svg>
          <View style={styles.circleLabel}>
            <Text
              style={[
                styles.circleScore,
                { color: getScoreColor(complianceScore) },
              ]}
              maxFontSizeMultiplier={1.3}
              allowFontScaling={true}
            >
              {loading ? "—" : `${complianceScore}`}
            </Text>
            <Text
              style={[styles.circleUnit, { color: colors.textSecondary }]}
              allowFontScaling={true}
            >
              / 100
            </Text>
          </View>
        </View>
        <Text
          style={[styles.complianceHint, { color: colors.textMuted }]}
          allowFontScaling={true}
        >
          Based on last 24h anomaly scores
        </Text>
      </View>

      {/* 24h Activity Chart */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          maxFontSizeMultiplier={1.5}
          allowFontScaling={true}
        >
          24h Risk Trend
        </Text>
        {loading ? (
          <View style={styles.chartPlaceholder}>
            <Text
              style={{ color: colors.textMuted }}
              allowFontScaling={true}
            >
              Loading chart data...
            </Text>
          </View>
        ) : !hasChart ? (
          <View style={styles.chartPlaceholder}>
            <Text
              style={[styles.placeholderEmoji]}
              allowFontScaling={true}
            >
              📊
            </Text>
            <Text
              style={[styles.placeholderText, { color: colors.textMuted }]}
              allowFontScaling={true}
            >
              Insufficient data for chart.{"\n"}At least 2 anomaly scores
              needed in the last 24 hours.
            </Text>
          </View>
        ) : (
          <View style={styles.miniChart}>
            {/* Simple bar chart visualization using chart data */}
            <View style={styles.barContainer}>
              {chartData.slice(-12).map((point: ChartDataPoint, index: number) => {
                const barHeight = Math.max(4, (point.y / 100) * 80);
                const barColor =
                  point.y > 80
                    ? colors.error
                    : point.y > 50
                      ? colors.warning
                      : colors.success;
                return (
                  <View key={index} style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                    <Text
                      style={[styles.barLabel, { color: colors.textMuted }]}
                      allowFontScaling={true}
                    >
                      {formatTimestamp(point.x).split(",")[0]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.success }]}
                />
                <Text
                  style={{ color: colors.textMuted, fontSize: 11 }}
                  allowFontScaling={true}
                >
                  Normal
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.warning }]}
                />
                <Text
                  style={{ color: colors.textMuted, fontSize: 11 }}
                  allowFontScaling={true}
                >
                  Elevated
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.error }]}
                />
                <Text
                  style={{ color: colors.textMuted, fontSize: 11 }}
                  allowFontScaling={true}
                >
                  Critical
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.statValue, { color: colors.text }]}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={true}
          >
            {scores.length}
          </Text>
          <Text
            style={[styles.statLabel, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            Readings (24h)
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.statValue,
              {
                color: scores.filter((s) => s.score > 80).length > 0
                  ? colors.error
                  : colors.success,
              },
            ]}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={true}
          >
            {scores.filter((s) => s.score > 80).length}
          </Text>
          <Text
            style={[styles.statLabel, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            Critical Events
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  circleContainer: { alignItems: "center", marginBottom: 24 },
  circleWrapper: { position: "relative", alignItems: "center", justifyContent: "center" },
  circleLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  circleScore: { fontSize: 42, fontWeight: "800" },
  circleUnit: { fontSize: 14, fontWeight: "600", marginTop: -4 },
  complianceHint: { fontSize: 12, marginTop: 8 },
  chartCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  chartPlaceholder: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 32, marginBottom: 8 },
  placeholderText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  miniChart: { paddingTop: 8 },
  barContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 100,
    marginBottom: 8,
  },
  barWrapper: { alignItems: "center", flex: 1 },
  bar: { width: 12, borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 8, marginTop: 4, textAlign: "center" },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 12, marginTop: 4, fontWeight: "600" },
});
