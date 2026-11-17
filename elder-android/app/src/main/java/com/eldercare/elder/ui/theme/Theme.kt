package com.eldercare.elder.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * ElderCare Material3 theme — "warm cream / warm charcoal" with a sage accent,
 * the same design signature as the web dashboard.
 *
 * Material3 roles cover the common surfaces; [EldercareColors] (via
 * [LocalEldercareColors] / [EcTheme.colors]) carries the extra design tokens —
 * ok / warn / critical statuses, soft fills, segmented backgrounds, AI-card
 * tints — that Material3 has no slot for.
 */

private val LightColorScheme = lightColorScheme(
    primary = LightPrimary,
    onPrimary = LightPrimaryForeground,
    secondary = LightSecondary,
    onSecondary = LightSecondaryForeground,
    background = LightBackground,
    onBackground = LightForeground,
    surface = LightCard,
    onSurface = LightCardForeground,
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = LightMutedForeground,
    error = LightDestructive,
    onError = LightDestructiveForeground,
    outline = LightOutline,
    outlineVariant = LightBorder,
)

private val DarkColorScheme = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = DarkPrimaryForeground,
    secondary = DarkSecondary,
    onSecondary = DarkSecondaryForeground,
    background = DarkBackground,
    onBackground = DarkForeground,
    surface = DarkCard,
    onSurface = DarkCardForeground,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkMutedForeground,
    error = DarkDestructive,
    onError = DarkDestructiveForeground,
    outline = DarkOutline,
    outlineVariant = DarkBorder,
)

/** Extended design tokens beyond Material3's color roles. */
@Immutable
data class EldercareColors(
    val accent: Color,
    val accentDeep: Color,
    val accent2: Color,
    val accentSoft: Color,
    val surface2: Color,
    val text2: Color,
    val text3: Color,
    val border: Color,
    val ok: Color,
    val okDeep: Color,
    val okSoft: Color,
    val warn: Color,
    val warnDeep: Color,
    val warnSoft: Color,
    val critical: Color,
    val criticalSoft: Color,
    val avatarBg: Color,
    val seg: Color,
    val chip: Color,
    val aiBg: Color,
    val aiBorder: Color,
)

private val LightEldercareColors = EldercareColors(
    accent = AccentSage,
    accentDeep = LightAccentDeep,
    accent2 = AccentClay,
    accentSoft = LightAccentSoft,
    surface2 = LightSurface2,
    text2 = LightText2,
    text3 = LightText3,
    border = LightBorder,
    ok = LightOk,
    okDeep = LightOkDeep,
    okSoft = LightOkSoft,
    warn = LightWarn,
    warnDeep = LightWarnDeep,
    warnSoft = LightWarnSoft,
    critical = LightCritical,
    criticalSoft = LightCriticalSoft,
    avatarBg = LightAvatarBg,
    seg = LightSeg,
    chip = LightChip,
    aiBg = LightAiBg,
    aiBorder = LightAiBorder,
)

private val DarkEldercareColors = EldercareColors(
    accent = AccentSage,
    accentDeep = DarkAccentDeep,
    accent2 = AccentClay,
    accentSoft = DarkAccentSoft,
    surface2 = DarkSurface2,
    text2 = DarkText2,
    text3 = DarkText3,
    border = DarkBorder,
    ok = DarkOk,
    okDeep = DarkOkDeep,
    okSoft = DarkOkSoft,
    warn = DarkWarn,
    warnDeep = DarkWarnDeep,
    warnSoft = DarkWarnSoft,
    critical = DarkCritical,
    criticalSoft = DarkCriticalSoft,
    avatarBg = DarkAvatarBg,
    seg = DarkSeg,
    chip = DarkChip,
    aiBg = DarkAiBg,
    aiBorder = DarkAiBorder,
)

val LocalEldercareColors = staticCompositionLocalOf { LightEldercareColors }

/** Convenience accessor: `EcTheme.colors.ok`, etc. */
object EcTheme {
    val colors: EldercareColors
        @Composable @ReadOnlyComposable get() = LocalEldercareColors.current
}

@Composable
fun EldercareTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val ecColors = if (darkTheme) DarkEldercareColors else LightEldercareColors

    CompositionLocalProvider(LocalEldercareColors provides ecColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = EldercareTypography,
            content = content,
        )
    }
}
