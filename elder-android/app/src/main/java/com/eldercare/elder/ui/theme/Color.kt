package com.eldercare.elder.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * ElderCare color palette — derived from shadcn/ui preset b5dxyp4rR.
 *
 * oklch values converted to sRGB hex for Compose Color().
 * Primary hue ≈ 38° (warm terracotta/rust).
 * Neutral hue ≈ 326° (mauve tint).
 * Chart hue ≈ 181–188° (teal gradient).
 */

// ─────────── Light mode ───────────

val LightBackground = Color(0xFFFFFFFF)           // oklch(1 0 0)
val LightForeground = Color(0xFF1C1720)           // oklch(0.145 0.008 326)
val LightCard = Color(0xFFFFFFFF)                 // oklch(1 0 0)
val LightCardForeground = Color(0xFF1C1720)       // oklch(0.145 0.008 326)
val LightPrimary = Color(0xFFB45309)              // oklch(0.553 0.195 38.402)
val LightPrimaryForeground = Color(0xFFFFFBEB)    // oklch(0.98 0.016 73.684)
val LightSecondary = Color(0xFFF5F5F6)            // oklch(0.967 0.001 286.375)
val LightSecondaryForeground = Color(0xFF303033)  // oklch(0.21 0.006 285.885)
val LightMuted = Color(0xFFF4F2F5)               // oklch(0.96 0.003 325.6)
val LightMutedForeground = Color(0xFF7E7389)      // oklch(0.542 0.034 322.5)
val LightDestructive = Color(0xFFDC2626)          // oklch(0.577 0.245 27.325)
val LightDestructiveForeground = Color(0xFFFFFBEB)
val LightBorder = Color(0xFFE6E3E8)              // oklch(0.922 0.005 325.62)
val LightOutline = Color(0xFFADA6B4)             // oklch(0.711 0.019 323.02)
val LightSurfaceVariant = Color(0xFFF4F2F5)      // same as muted

// ─────────── Dark mode ───────────

val DarkBackground = Color(0xFF1C1720)            // oklch(0.145 0.008 326)
val DarkForeground = Color(0xFFFAFAFA)            // oklch(0.985 0 0)
val DarkCard = Color(0xFF2E2833)                  // oklch(0.212 0.019 322.12)
val DarkCardForeground = Color(0xFFFAFAFA)        // oklch(0.985 0 0)
val DarkPrimary = Color(0xFF8B3E0A)               // oklch(0.47 0.157 37.304)
val DarkPrimaryForeground = Color(0xFFFFFBEB)     // oklch(0.98 0.016 73.684)
val DarkSecondary = Color(0xFF3D3D42)             // oklch(0.274 0.006 286.033)
val DarkSecondaryForeground = Color(0xFFFAFAFA)   // oklch(0.985 0 0)
val DarkMuted = Color(0xFF3B3342)                 // oklch(0.263 0.024 320.12)
val DarkMutedForeground = Color(0xFFADA6B4)       // oklch(0.711 0.019 323.02)
val DarkDestructive = Color(0xFFF87171)           // oklch(0.704 0.191 22.216)
val DarkDestructiveForeground = Color(0xFF1C1720)
val DarkBorder = Color(0x1AFFFFFF)                // oklch(1 0 0 / 10%)
val DarkOutline = Color(0xFF7E7389)              // oklch(0.542 0.034 322.5)
val DarkSurfaceVariant = Color(0xFF3B3342)       // same as muted

// ─────────── Chart palette (shared light/dark) ───────────

val Chart1 = Color(0xFF5CC8C8)  // oklch(0.855 0.138 181.071)
val Chart2 = Color(0xFF1EA6A6)  // oklch(0.704 0.14 182.503)
val Chart3 = Color(0xFF0D8585)  // oklch(0.6 0.118 184.704)
val Chart4 = Color(0xFF0B6A6A)  // oklch(0.511 0.096 186.391)
val Chart5 = Color(0xFF0A5454)  // oklch(0.437 0.078 188.216)

// ─────────── Notification accent (hex for NotificationCompat) ───────────

/** Primary color as ARGB int for Android notification accent. */
const val NOTIFICATION_COLOR_ARGB: Int = 0xFFB45309.toInt()
