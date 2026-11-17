package com.eldercare.elder.sync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.data.UserRole
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Re-enqueues PeriodicWorkRequest after device boot. WorkManager survives reboot but
 * only after first app launch — the receiver triggers it without launching the UI.
 */
@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var tokenStore: TokenStore
    @Inject lateinit var scheduler: WorkManagerScheduler

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) return

        // Only elder role needs telemetry sync after boot.
        if (!tokenStore.hasTokens() || tokenStore.role() != UserRole.ELDER) return
        scheduler.enqueuePeriodicSync()
        HealthSyncService.start(context)
    }
}
