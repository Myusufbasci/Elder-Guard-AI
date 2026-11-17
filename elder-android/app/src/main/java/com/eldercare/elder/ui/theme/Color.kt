package com.eldercare.elder.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * ElderCare color palette — "warm cream / warm charcoal" with a sage accent.
 *
 * Ported from the Bakıcı Paneli design handoff so the Android (mobile) panel
 * carries the same design signature as the web dashboard. Light is the warm
 * cream theme; dark is the warm charcoal theme. The sage accent is shared.
 *
 * The Material3 roles below feed [EldercareTheme]; the extended [EldercareColors]
 * tokens (ok / warn / critical, soft fills, segmented backgrounds, avatar fills)
 * cover everything Material3 has no slot for.
 */

// ─────────── Light — warm cream (Material3 roles) ───────────

val LightBackground = Color(0xFFF0EBE1)            // --bg
val LightForeground = Color(0xFF2F2B23)            // --text-1
val LightCard = Color(0xFFFBF8F2)                  // --surface
val LightCardForeground = Color(0xFF2F2B23)
val LightPrimary = Color(0xFF5B8A72)               // --accent
val LightPrimaryForeground = Color(0xFFFFFFFF)
val LightSecondary = Color(0xFFF5F1E8)             // --surface-2
val LightSecondaryForeground = Color(0xFF2F2B23)
val LightMuted = Color(0xFFF5F1E8)
val LightMutedForeground = Color(0xFF918A7C)       // --text-3
val LightDestructive = Color(0xFFCD6A58)           // --critical
val LightDestructiveForeground = Color(0xFFFFFFFF)
val LightBorder = Color(0xFFE7E0D1)                // --border
val LightOutline = Color(0xFF918A7C)
val LightSurfaceVariant = Color(0xFFF5F1E8)

// ─────────── Dark — warm charcoal (Material3 roles) ───────────

val DarkBackground = Color(0xFF1B1916)             // --bg
val DarkForeground = Color(0xFFECE6DB)             // --text-1
val DarkCard = Color(0xFF262320)                   // --surface
val DarkCardForeground = Color(0xFFECE6DB)
val DarkPrimary = Color(0xFF5B8A72)                // --accent (shared)
val DarkPrimaryForeground = Color(0xFFFFFFFF)
val DarkSecondary = Color(0xFF2D2A25)              // --surface-2
val DarkSecondaryForeground = Color(0xFFECE6DB)
val DarkMuted = Color(0xFF2D2A25)
val DarkMutedForeground = Color(0xFF847C6E)        // --text-3
val DarkDestructive = Color(0xFFDB8170)            // --critical (dark)
val DarkDestructiveForeground = Color(0xFF1B1916)
val DarkBorder = Color(0xFF393530)                 // --border
val DarkOutline = Color(0xFF847C6E)
val DarkSurfaceVariant = Color(0xFF2D2A25)

// ─────────── Chart palette (warm sage / terracotta) ───────────

val Chart1 = Color(0xFF5B8A72)
val Chart2 = Color(0xFFC98A76)
val Chart3 = Color(0xFF3F6B56)
val Chart4 = Color(0xFFD99E54)
val Chart5 = Color(0xFF847C6E)

// ─────────── Notification accent (sage, ARGB int) ───────────

const val NOTIFICATION_COLOR_ARGB: Int = 0xFF5B8A72.toInt()

// ─────────── Extended design tokens (EldercareColors) ───────────

// Shared accents
val AccentSage = Color(0xFF5B8A72)
val AccentSageDeep = Color(0xFF3F6B56)
val AccentClay = Color(0xFFC98A76)

// Light extended
val LightSurface2 = Color(0xFFF5F1E8)
val LightText2 = Color(0xFF5D564A)
val LightText3 = Color(0xFF918A7C)
val LightAccentDeep = Color(0xFF3F6B56)
val LightAccentSoft = Color(0xFFE8EBE3)
val LightAvatarBg = Color(0xFFE1E6DE)
val LightSeg = Color(0xFFECE6D8)
val LightChip = Color(0xFFEFE9DD)
val LightAiBg = Color(0xFFF3F2EC)
val LightAiBorder = Color(0xFFC8CDBC)
val LightOk = Color(0xFF5A9D77)
val LightOkDeep = Color(0xFF3F7657)
val LightOkSoft = Color(0xFFE4EBE1)
val LightWarn = Color(0xFFD99E54)
val LightWarnDeep = Color(0xFFA96D22)
val LightWarnSoft = Color(0xFFF6EAD9)
val LightCritical = Color(0xFFCD6A58)
val LightCriticalSoft = Color(0xFFF5E4DC)

// Dark extended
val DarkSurface2 = Color(0xFF2D2A25)
val DarkText2 = Color(0xFFB3AA9B)
val DarkText3 = Color(0xFF847C6E)
val DarkAccentDeep = Color(0xFF8FC7A6)  // lighter sage — readable on charcoal
val DarkAccentSoft = Color(0xFF313830)
val DarkAvatarBg = Color(0xFF364239)
val DarkSeg = Color(0xFF322E28)
val DarkChip = Color(0xFF322E28)
val DarkAiBg = Color(0xFF2B2D28)
val DarkAiBorder = Color(0xFF434F44)
val DarkOk = Color(0xFF6CAE89)
val DarkOkDeep = Color(0xFF8FC7A6)
val DarkOkSoft = Color(0xFF333C33)
val DarkWarn = Color(0xFFE0AB66)
val DarkWarnDeep = Color(0xFFE8BD84)
val DarkWarnSoft = Color(0xFF483C2D)
val DarkCritical = Color(0xFFDB8170)
val DarkCriticalSoft = Color(0xFF47342E)
