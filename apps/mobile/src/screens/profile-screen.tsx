import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";
import { useAuthStore } from "../store/use-auth-store";
import { useSensorStore } from "../store/use-sensor-store";
import { useThemeColors } from "../utils/theme";

/**
 * Profile / Settings Screen.
 * Manage linked elders, view sync status, sign out.
 */
export default function ProfileScreen() {
  const colors = useThemeColors();
  const { uid, email, signOut } = useAuthStore();
  const { readings, totalCollected, lastSyncedAt } = useSensorStore();

  const [elderName, setElderName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLinkElder = async () => {
    if (!uid || !elderName.trim() || !deviceId.trim()) {
      Alert.alert("Error", "Please fill in both fields.");
      return;
    }

    setSaving(true);
    try {
      const elderId = `elder-${Date.now()}`;
      await setDoc(doc(db, COLLECTIONS.elders, elderId), {
        name: elderName.trim(),
        deviceId: deviceId.trim(),
        guardianId: uid,
        createdAt: Date.now(),
      });

      // Also update guardian doc with elder reference
      await setDoc(
        doc(db, COLLECTIONS.guardians, uid),
        {
          elderIds: [elderId],
          email,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      Alert.alert("Success", `Elder "${elderName.trim()}" linked successfully.`);
      setElderName("");
      setDeviceId("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to link elder";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch {
            // Error handled in store
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Header */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View
          style={[styles.avatar, { backgroundColor: colors.primary }]}
        >
          <Text
            style={styles.avatarText}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={true}
          >
            {email?.charAt(0).toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text
          style={[styles.email, { color: colors.text }]}
          allowFontScaling={true}
        >
          {email ?? "Not signed in"}
        </Text>
        <Text
          style={[styles.uid, { color: colors.textMuted }]}
          allowFontScaling={true}
        >
          UID: {uid?.slice(0, 12)}…
        </Text>
      </View>

      {/* Link Elder */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          maxFontSizeMultiplier={1.5}
          allowFontScaling={true}
        >
          Link an Elder
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Elder's Name"
          placeholderTextColor={colors.textMuted}
          value={elderName}
          onChangeText={setElderName}
          allowFontScaling={true}
        />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Device ID"
          placeholderTextColor={colors.textMuted}
          value={deviceId}
          onChangeText={setDeviceId}
          allowFontScaling={true}
        />
        <TouchableOpacity
          style={[
            styles.linkButton,
            { backgroundColor: colors.primary },
            saving && { backgroundColor: colors.textMuted },
          ]}
          onPress={handleLinkElder}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text
            style={styles.linkButtonText}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={true}
          >
            {saving ? "Linking..." : "Link Elder"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sync Status */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          maxFontSizeMultiplier={1.5}
          allowFontScaling={true}
        >
          Data Status
        </Text>
        <View style={styles.statusRow}>
          <Text
            style={[styles.statusLabel, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            Pending readings
          </Text>
          <Text
            style={[styles.statusValue, { color: colors.text }]}
            allowFontScaling={true}
          >
            {readings.length}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text
            style={[styles.statusLabel, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            Total collected
          </Text>
          <Text
            style={[styles.statusValue, { color: colors.text }]}
            allowFontScaling={true}
          >
            {totalCollected}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text
            style={[styles.statusLabel, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            Last synced
          </Text>
          <Text
            style={[styles.statusValue, { color: colors.text }]}
            allowFontScaling={true}
          >
            {lastSyncedAt
              ? new Date(lastSyncedAt).toLocaleTimeString()
              : "Never"}
          </Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutButton, { borderColor: colors.error }]}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.signOutText, { color: colors.error }]}
          maxFontSizeMultiplier={1.3}
          allowFontScaling={true}
        >
          Sign Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  email: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  uid: { fontSize: 12, textAlign: "center", marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  linkButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  linkButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  statusLabel: { fontSize: 14 },
  statusValue: { fontSize: 14, fontWeight: "600" },
  signOutButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  signOutText: { fontSize: 16, fontWeight: "700" },
});
