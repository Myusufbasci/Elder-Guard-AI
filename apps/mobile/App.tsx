import React, { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSensorStore } from "./src/store/use-sensor-store";
import { collectSensorReading } from "./src/services/sensor-service";
import {
  registerBackgroundTask,
  SENSOR_BACKGROUND_TASK,
} from "./src/services/background-task";
import { getScreenLockStatus } from "./src/services/sensor-service";
import type { SensorReading } from "@elder-guard/core";

export default function App() {
  const {
    readings,
    totalCollected,
    lastCollectedAt,
    isCollecting,
    error,
    addReading,
    setCollecting,
    setError,
    clearBuffer,
  } = useSensorStore();

  const [backgroundStatus, setBackgroundStatus] = useState<string>("Pending");
  const [screenLock, setScreenLock] = useState<string>("Unknown");

  // Register background task on mount
  useEffect(() => {
    registerBackgroundTask()
      .then(() => setBackgroundStatus("Registered"))
      .catch(() => setBackgroundStatus("Failed"));
  }, []);

  // Update mock screen lock status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = getScreenLockStatus();
      setScreenLock(status.isLocked ? "🔒 Locked" : "🔓 Unlocked");
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /**
   * FORCE TRIGGER — bypasses the 15-minute OS background limit.
   * Critical for the professor's demo presentation.
   */
  const handleForceTrigger = useCallback(async () => {
    setCollecting(true);
    setError(null);
    try {
      const reading = await collectSensorReading();
      if (reading) {
        addReading(reading);
      } else {
        setError("Failed to collect reading");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setCollecting(false);
    }
  }, [addReading, setCollecting, setError]);

  const handleClearBuffer = useCallback(() => {
    Alert.alert("Clear Buffer", "Remove all stored readings?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearBuffer },
    ]);
  }, [clearBuffer]);

  // Get last 5 readings (newest first for display)
  const latestReadings = readings.slice(-5).reverse();

  const renderReading = ({ item }: { item: SensorReading }) => {
    const time = new Date(item.timestamp).toLocaleTimeString();
    return (
      <View style={styles.readingCard}>
        <Text style={styles.readingTime}>{time}</Text>
        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>
            X: <Text style={styles.axisValue}>{item.value["x"]?.toFixed(3)}</Text>
          </Text>
          <Text style={styles.axisLabel}>
            Y: <Text style={styles.axisValue}>{item.value["y"]?.toFixed(3)}</Text>
          </Text>
          <Text style={styles.axisLabel}>
            Z: <Text style={styles.axisValue}>{item.value["z"]?.toFixed(3)}</Text>
          </Text>
        </View>
        <Text style={styles.readingId}>ID: {item.id.slice(0, 8)}…</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Elder-Guard AI</Text>
        <Text style={styles.subtitle}>Sensor Monitor — Week 3</Text>
      </View>

      {/* Status Bar */}
      <View style={styles.statusContainer}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Background</Text>
          <Text style={styles.statusValue}>{backgroundStatus}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Screen</Text>
          <Text style={styles.statusValue}>{screenLock}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Buffer</Text>
          <Text style={styles.statusValue}>{readings.length}/500</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Total</Text>
          <Text style={styles.statusValue}>{totalCollected}</Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Force Trigger Button */}
      <TouchableOpacity
        style={[styles.triggerButton, isCollecting && styles.triggerButtonDisabled]}
        onPress={handleForceTrigger}
        disabled={isCollecting}
        activeOpacity={0.7}
      >
        {isCollecting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.triggerButtonText}>⚡ Force Trigger Reading</Text>
        )}
      </TouchableOpacity>

      {/* Last Collection Time */}
      {lastCollectedAt && (
        <Text style={styles.lastCollected}>
          Last: {new Date(lastCollectedAt).toLocaleTimeString()}
        </Text>
      )}

      {/* Readings List */}
      <Text style={styles.sectionTitle}>Last 5 Readings</Text>
      {latestReadings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No readings yet. Tap "Force Trigger" to collect.
          </Text>
        </View>
      ) : (
        <FlatList
          data={latestReadings}
          renderItem={renderReading}
          keyExtractor={(item) => item.id}
          style={styles.list}
          scrollEnabled={false}
        />
      )}

      {/* Clear Buffer Button */}
      {readings.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearBuffer}
          activeOpacity={0.7}
        >
          <Text style={styles.clearButtonText}>Clear Buffer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c1421",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusItem: {
    alignItems: "center",
    flex: 1,
  },
  statusLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 13,
    color: "#e2e8f0",
    marginTop: 4,
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    textAlign: "center",
  },
  triggerButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  triggerButtonDisabled: {
    backgroundColor: "#475569",
  },
  triggerButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  lastCollected: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  readingCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#0ea5e9",
  },
  readingTime: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 6,
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  axisValue: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  readingId: {
    fontSize: 10,
    color: "#475569",
    marginTop: 6,
  },
  emptyState: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },
  clearButton: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 30,
  },
  clearButtonText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
});
