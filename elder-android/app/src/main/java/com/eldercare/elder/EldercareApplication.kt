package com.eldercare.elder

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.data.UserRole
import com.eldercare.elder.sync.WorkManagerScheduler
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class EldercareApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var tokenStore: TokenStore
    @Inject lateinit var scheduler: WorkManagerScheduler

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        // Only the elder role drives Health Connect telemetry uploads; caregivers
        // don't need WorkManager periodic sync.
        if (tokenStore.hasTokens() && tokenStore.role() == UserRole.ELDER) {
            scheduler.enqueuePeriodicSync()
        }
    }
}
