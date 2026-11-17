package com.eldercare.elder.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

enum class UserRole { CAREGIVER, ELDER }

data class Session(
    val role: UserRole,
    val firstName: String?,
    val lastName: String?,
    val email: String?,
)

@Singleton
class TokenStore @Inject constructor(context: Context) {

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val _session = MutableStateFlow(loadSession())
    val session: StateFlow<Session?> = _session.asStateFlow()

    fun saveTokens(access: String, refresh: String) {
        prefs.edit().putString(KEY_ACCESS, access).putString(KEY_REFRESH, refresh).apply()
        _session.value = loadSession()
    }

    fun saveAccess(access: String) {
        prefs.edit().putString(KEY_ACCESS, access).apply()
    }

    fun saveRefresh(refresh: String) {
        prefs.edit().putString(KEY_REFRESH, refresh).apply()
    }

    fun accessToken(): String? = prefs.getString(KEY_ACCESS, null)
    fun refreshToken(): String? = prefs.getString(KEY_REFRESH, null)

    fun saveDeviceId(deviceId: String) {
        prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
    }

    fun deviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)

    fun saveRole(role: UserRole) {
        prefs.edit().putString(KEY_ROLE, role.name).apply()
        _session.value = loadSession()
    }

    fun role(): UserRole? = prefs.getString(KEY_ROLE, null)?.let {
        runCatching { UserRole.valueOf(it) }.getOrNull()
    }

    fun saveProfile(firstName: String?, lastName: String?, email: String?) {
        prefs.edit()
            .putString(KEY_FIRST_NAME, firstName)
            .putString(KEY_LAST_NAME, lastName)
            .putString(KEY_EMAIL, email)
            .apply()
        _session.value = loadSession()
    }

    fun firstName(): String? = prefs.getString(KEY_FIRST_NAME, null)
    fun lastName(): String? = prefs.getString(KEY_LAST_NAME, null)
    fun email(): String? = prefs.getString(KEY_EMAIL, null)

    fun hasTokens(): Boolean = accessToken() != null && refreshToken() != null

    fun clear() {
        prefs.edit().clear().apply()
        _session.value = null
    }

    private fun loadSession(): Session? {
        if (!hasTokens()) return null
        val r = role() ?: return null
        return Session(
            role = r,
            firstName = firstName(),
            lastName = lastName(),
            email = email(),
        )
    }

    companion object {
        private const val FILE_NAME = "eldercare_secure_prefs"
        private const val KEY_ACCESS = "access_token"
        private const val KEY_REFRESH = "refresh_token"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_ROLE = "user_role"
        private const val KEY_FIRST_NAME = "first_name"
        private const val KEY_LAST_NAME = "last_name"
        private const val KEY_EMAIL = "email"
    }
}
