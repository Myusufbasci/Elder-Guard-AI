package com.eldercare.elder.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.eldercare.elder.MainActivity
import com.eldercare.elder.R
import com.eldercare.elder.data.HealthConnectManager
import com.eldercare.elder.data.LocationManager
import com.eldercare.elder.data.SyncTokenStore
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.TelemetryRequest
import com.eldercare.elder.network.TelemetrySample
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground service of type=health (AGENTS.md Rule 12). Persistent notification at
 * IMPORTANCE_MIN — no sound, no vibration, no badge — labelled "System Connected"
 * so the elder is not alarmed.
 *
 * Heartbeat every 5 minutes pulls Health Connect changes and POSTs them. The 15-min
 * WorkManager pass remains the durable path; this service exists for near-real-time
 * anomaly inputs (REVERSE Cross-Repo Synthesis section 3).
 */
@AndroidEntryPoint
class HealthSyncService : Service() {

    @Inject lateinit var api: EldercareApi
    @Inject lateinit var healthConnect: HealthConnectManager
    @Inject lateinit var syncTokenStore: SyncTokenStore
    @Inject lateinit var tokenStore: TokenStore
    @Inject lateinit var locationManager: LocationManager

    private val supervisor: Job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + supervisor)

    override fun onCreate() {
        super.onCreate()
        createChannel()
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
        } else {
            startForeground(NOTIF_ID, notif)
        }
        scope.launch { heartbeatLoop() }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private suspend fun heartbeatLoop() {
        while (true) {
            runCatching { tick() }
            delay(HEARTBEAT_MS)
        }
    }

    private suspend fun tick() {
        val deviceId = tokenStore.deviceId() ?: return
        val pull = healthConnect.pullChanges(syncTokenStore)
        val fix = locationManager.lastReducedFix()
        val locSamples: List<TelemetrySample> = fix?.let {
            listOf(
                TelemetrySample(it.timeIso, "location_lat", it.latitude, null),
                TelemetrySample(it.timeIso, "location_lng", it.longitude, null),
            )
        } ?: emptyList()
        val payload = pull.samples + locSamples
        if (payload.isEmpty()) return
        for (batch in payload.chunked(200)) {
            val response = api.ingestTelemetry(TelemetryRequest(deviceId, batch))
            if (!response.isSuccessful) return
        }
        for ((type, token) in pull.newTokens) syncTokenStore.setToken(type, token)
    }

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_sync),
            NotificationManager.IMPORTANCE_MIN,
        ).apply {
            setShowBadge(false)
            setSound(null, null)
            enableVibration(false)
            enableLights(false)
            lockscreenVisibility = Notification.VISIBILITY_SECRET
        }
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notif_sync_title))
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setContentIntent(pi)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "eldercare_sync"
        private const val NOTIF_ID = 1001
        private const val HEARTBEAT_MS = 5L * 60L * 1000L

        fun start(context: Context) {
            val intent = Intent(context, HealthSyncService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
