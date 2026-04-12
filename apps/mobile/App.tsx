import React, { useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "./src/store/use-auth-store";
import { useThemeColors } from "./src/utils/theme";
import LoginScreen from "./src/screens/login-screen";
import DashboardScreen from "./src/screens/dashboard-screen";
import AlertsScreen from "./src/screens/alerts-screen";
import ProfileScreen from "./src/screens/profile-screen";

/** Tab definitions */
const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "alerts", label: "Alerts", icon: "🚨" },
  { key: "profile", label: "Profile", icon: "👤" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Root App component with:
 * 1. Protected routing — auth gate via Zustand auth store
 * 2. Bottom tab navigation — Dashboard, Alerts, Profile
 * 3. Dark/light theme support via useColorScheme
 */
export default function App() {
  const colors = useThemeColors();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  const handleTabPress = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  // ── Loading state while Firebase resolves auth ──
  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={[styles.loadingText, { color: colors.textMuted }]}
          allowFontScaling={true}
        >
          Loading...
        </Text>
      </View>
    );
  }

  // ── Auth gate: not logged in → show login ──
  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style={colors.statusBar} />
        <LoginScreen />
      </>
    );
  }

  // ── Authenticated: show tab navigation ──
  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen />;
      case "alerts":
        return <AlertsScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text
          style={[styles.headerTitle, { color: colors.primary }]}
          maxFontSizeMultiplier={1.3}
          allowFontScaling={true}
        >
          Elder-Guard AI
        </Text>
      </View>

      {/* Active Screen */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Tab Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
            >
              <Text
                style={[
                  styles.tabIcon,
                  { opacity: isActive ? 1 : 0.5 },
                ]}
                allowFontScaling={true}
              >
                {tab.icon}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.primary : colors.textMuted,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
                maxFontSizeMultiplier={1.3}
                allowFontScaling={true}
              >
                {tab.label}
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.tabIndicator,
                    { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  screenContainer: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  tabIcon: { fontSize: 22, marginBottom: 2 },
  tabLabel: { fontSize: 11 },
  tabIndicator: {
    position: "absolute",
    top: -9,
    width: 24,
    height: 3,
    borderRadius: 1.5,
  },
});
