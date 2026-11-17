package com.eldercare.elder.ui.pairing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.data.HealthConnectManager
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.sync.WorkManagerScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the "paired" home screen. Two jobs:
 *
 * 1. Foreground session heartbeat: every 30s it pings GET /v1/elder/me. Once the
 *    caregiver removes this elder, that returns 401 → RefreshAuthenticator clears
 *    the tokens → TokenStore.session emits null → AppNav re-routes to role select.
 *
 * 2. Health Connect access state: exposes whether the provider is installed and
 *    whether all read permissions are granted, so the screen can gate the sync on
 *    the elder actually granting access (without which no telemetry is ever read —
 *    the root cause of "nothing shows on the web panel").
 *
 * Scoped to the elder_paired nav entry: when logout re-routes away, the entry is
 * destroyed, this ViewModel is cleared, and the heartbeat loop is cancelled.
 */
@HiltViewModel
class ElderHomeViewModel @Inject constructor(
    private val api: EldercareApi,
    private val tokenStore: TokenStore,
    private val healthConnect: HealthConnectManager,
    private val scheduler: WorkManagerScheduler,
) : ViewModel() {

    /** Health Connect read permissions to request (heart rate, resting HR, steps, sleep). */
    val healthPermissions: Set<String> = healthConnect.permissions

    private val _health = MutableStateFlow(HealthAccess())
    val health: StateFlow<HealthAccess> = _health.asStateFlow()

    init {
        viewModelScope.launch {
            while (isActive) {
                runCatching { api.getMe() }
                delay(HEARTBEAT_MS)
            }
        }
        recheckHealthAccess()
    }

    /**
     * Fire an immediate one-off telemetry sync (pushes the last-24h Health Connect
     * baseline + a location fix to the server now). Called automatically once all
     * permissions are granted, and by the "Verileri şimdi gönder" demo button.
     */
    fun syncNow() {
        scheduler.enqueueImmediateSync()
    }

    /** Re-reads Health Connect availability + whether all read permissions are granted. */
    fun recheckHealthAccess() {
        viewModelScope.launch {
            val availability = healthConnect.availability()
            val granted = if (availability == HealthConnectManager.Availability.INSTALLED) {
                runCatching { healthConnect.hasAllPermissions() }.getOrDefault(false)
            } else {
                false
            }
            _health.value = HealthAccess(availability = availability, granted = granted)
        }
    }

    /**
     * "Eşleşmeyi sıfırla": delete the elder server-side (best-effort) so the
     * caregiver's web view drops it, then clear local tokens → re-route to role
     * select. Tokens are cleared even if the network call fails so the device
     * always leaves the paired state.
     */
    fun unpair() {
        viewModelScope.launch {
            runCatching { api.unpair() }
            tokenStore.clear()
        }
    }

    data class HealthAccess(
        val availability: HealthConnectManager.Availability =
            HealthConnectManager.Availability.NOT_INSTALLED,
        val granted: Boolean = false,
    )

    companion object {
        private const val HEARTBEAT_MS = 30_000L
    }
}
