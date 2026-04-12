import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuthStore } from "../store/use-auth-store";
import { useThemeColors } from "../utils/theme";

/**
 * Login / Register screen.
 * Provides email+password auth via the Zustand auth store.
 * Supports both dark and light mode.
 */
export default function LoginScreen() {
  const colors = useThemeColors();
  const { signIn, signUp, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    try {
      if (isRegisterMode) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch {
      // Error is set in the store
    }
  };

  const toggleMode = () => {
    clearError();
    setIsRegisterMode(!isRegisterMode);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[styles.logo, { color: colors.primary }]}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={true}
          >
            Elder-Guard AI
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.textMuted }]}
            allowFontScaling={true}
          >
            {isRegisterMode ? "Create your account" : "Sign in to continue"}
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceElevated,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
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
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            allowFontScaling={true}
          />

          {error && (
            <View
              style={[styles.errorBanner, { backgroundColor: colors.errorBg }]}
            >
              <Text
                style={[styles.errorText, { color: colors.errorText }]}
                allowFontScaling={true}
              >
                {error}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              isLoading && { backgroundColor: colors.textMuted },
            ]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={styles.buttonText}
                maxFontSizeMultiplier={1.3}
                allowFontScaling={true}
              >
                {isRegisterMode ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleMode}
            style={styles.toggleButton}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.toggleText, { color: colors.primary }]}
              allowFontScaling={true}
            >
              {isRegisterMode
                ? "Already have an account? Sign In"
                : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { fontSize: 32, fontWeight: "800" },
  subtitle: { fontSize: 16, marginTop: 8 },
  card: {
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
  },
  errorBanner: { borderRadius: 8, padding: 10, marginBottom: 14 },
  errorText: { fontSize: 13, textAlign: "center" },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  toggleButton: { marginTop: 20, alignItems: "center" },
  toggleText: { fontSize: 14 },
});
