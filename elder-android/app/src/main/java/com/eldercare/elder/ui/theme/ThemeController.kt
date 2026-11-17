package com.eldercare.elder.ui.theme

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf

/** Theme preference: follow the system, or force light / dark. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

/**
 * App-controlled theme preference, persisted in SharedPreferences so the
 * caregiver's choice survives process death. Hoisted in MainActivity and
 * exposed to every screen via [LocalThemeController] so the Settings screen
 * can flip light/dark — matching the web dashboard's theme toggle.
 */
class ThemeController(context: Context) {
    private val prefs = context.getSharedPreferences("eldercare_theme", Context.MODE_PRIVATE)

    var mode by mutableStateOf(readMode())
        private set

    private fun readMode(): ThemeMode =
        runCatching { ThemeMode.valueOf(prefs.getString(KEY_MODE, ThemeMode.SYSTEM.name)!!) }
            .getOrDefault(ThemeMode.SYSTEM)

    fun selectMode(value: ThemeMode) {
        mode = value
        prefs.edit().putString(KEY_MODE, value.name).apply()
    }

    private companion object {
        const val KEY_MODE = "mode"
    }
}

val LocalThemeController = staticCompositionLocalOf<ThemeController> {
    error("ThemeController not provided")
}
