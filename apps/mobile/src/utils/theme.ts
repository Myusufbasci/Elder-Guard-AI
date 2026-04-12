import { useColorScheme } from "react-native";

/**
 * Color tokens for Elder Guard dark/light themes.
 * Dark mode is the primary design — light mode uses inverted colors.
 */
const darkColors = {
  background: "#0c1421",
  surface: "#1e293b",
  surfaceElevated: "#263548",
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  accent: "#22d3ee",
  text: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textInverse: "#0c1421",
  border: "#334155",
  error: "#ef4444",
  errorBg: "#7f1d1d",
  errorText: "#fecaca",
  success: "#22c55e",
  successBg: "#14532d",
  warning: "#eab308",
  warningBg: "#713f12",
  critical: "#ef4444",
  criticalBg: "#991b1b",
  card: "#1e293b",
  cardBorder: "#334155",
  tabBar: "#111827",
  tabBarBorder: "#1e293b",
  statusBar: "light" as const,
};

const lightColors: typeof darkColors = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceElevated: "#f1f5f9",
  primary: "#0284c7",
  primaryDark: "#0369a1",
  accent: "#06b6d4",
  text: "#1e293b",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textInverse: "#ffffff",
  border: "#e2e8f0",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorText: "#dc2626",
  success: "#16a34a",
  successBg: "#f0fdf4",
  warning: "#ca8a04",
  warningBg: "#fefce8",
  critical: "#dc2626",
  criticalBg: "#fef2f2",
  card: "#ffffff",
  cardBorder: "#e2e8f0",
  tabBar: "#ffffff",
  tabBarBorder: "#e2e8f0",
  statusBar: "dark" as const,
};

export type ThemeColors = typeof darkColors;

/**
 * Hook to get the current theme colors based on OS color scheme.
 */
export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === "light" ? lightColors : darkColors;
}

/**
 * Get theme colors without the React hook (for non-component use).
 * Defaults to dark theme.
 */
export function getDefaultThemeColors(): ThemeColors {
  return darkColors;
}
