package com.eldercare.elder.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.eldercare.elder.data.HealthConnectManager
import com.eldercare.elder.data.LocationManager
import com.eldercare.elder.data.SyncTokenStore
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.TelemetryRequest
import com.eldercare.elder.network.TelemetrySample
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * PeriodicWorkRequest at 15-min cadence (AGENTS.md Rule 13). Reads Health Connect
 * differential changes + location, batches into ≤200 samples per POST, advances
 * per-record-type changes tokens on success.
 *
 * Result.retry() on HTTP 5xx → WorkManager applies exponential backoff automatically
 * (REVERSE Pattern 9). Result.success() on 2xx; Result.failure() on terminal errors.
 */
@HiltWorker
class TelemetrySyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val api: EldercareApi,
    private val healthConnect: HealthConnectManager,
    private val syncTokenStore: SyncTokenStore,
    private val tokenStore: TokenStore,
    private val locationManager: LocationManager,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Session heartbeat: even when there is no telemetry to send, validate the
        // elder still exists. A 401 here makes RefreshAuthenticator clear tokens so
        // a caregiver-side deletion logs the device out (caregiver/elder sync).
        runCatching { api.getMe() }
        val deviceId = tokenStore.deviceId() ?: return Result.failure()

        // Health Connect pull is BEST-EFFORT and independent of location. If it
        // fails — no HC permission, Mi Fitness not feeding Health Connect, etc. —
        // we still collect and send GPS location. Location must never depend on
        // health data being available.
        val pull = try {
            healthConnect.pullChanges(syncTokenStore)
        } catch (e: Exception) {
            null
        }
        val healthSamples = pull?.samples ?: emptyList()

        val location = locationManager.lastReducedFix()
        val locationSamples: List<TelemetrySample> = location?.let {
            listOf(
                TelemetrySample(it.timeIso, "location_lat", it.latitude, null),
                TelemetrySample(it.timeIso, "location_lng", it.longitude, null),
            )
        } ?: emptyList()

        val all = healthSamples + locationSamples
        // Nothing from either source this tick — try again next period.
        if (all.isEmpty()) return Result.success()

        val batches = all.chunked(MAX_BATCH)
        for (batch in batches) {
            val response = try {
                api.ingestTelemetry(TelemetryRequest(deviceId = deviceId, samples = batch))
            } catch (e: Exception) {
                return Result.retry()
            }
            if (response.code() in 500..599) return Result.retry()
            if (!response.isSuccessful) return Result.failure()
        }

        // Persist advanced changes tokens only when the HC pull actually succeeded.
        if (pull != null) {
            for ((type, token) in pull.newTokens) syncTokenStore.setToken(type, token)
        }
        return Result.success()
    }

    companion object {
        const val MAX_BATCH = 200
    }
}
