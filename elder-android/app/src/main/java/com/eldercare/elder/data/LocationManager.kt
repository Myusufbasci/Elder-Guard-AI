package com.eldercare.elder.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.math.floor

/**
 * Wraps FusedLocationProviderClient. Privacy: precision is reduced to ~110m by
 * truncating lat/lng to 3 decimal places before exposing.
 *
 * Why CurrentLocationRequest (not LocationRequest callbacks): callers (worker +
 * service) sample at 5-15 minute intervals — pull-mode is the right shape and
 * avoids leaking a long-lived listener.
 */
@Singleton
class LocationManager @Inject constructor(
    private val context: Context,
) {

    private val cached = AtomicReference<Fix?>()

    data class Fix(
        val latitude: Double,
        val longitude: Double,
        val timeIso: String,
    )

    @SuppressLint("MissingPermission")
    suspend fun lastReducedFix(): Fix? {
        if (!hasPermission()) return cached.get()
        val client = LocationServices.getFusedLocationProviderClient(context)
        val tokenSource = CancellationTokenSource()
        val request = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
            .setMaxUpdateAgeMillis(5L * 60L * 1000L)
            .build()

        val location = suspendCancellableCoroutine<Location?> { cont ->
            client.getCurrentLocation(request, tokenSource.token)
                .addOnSuccessListener { cont.resume(it) }
                .addOnFailureListener { cont.resume(null) }
            cont.invokeOnCancellation { tokenSource.cancel() }
        } ?: return cached.get()

        val fix = Fix(
            latitude = reduce(location.latitude),
            longitude = reduce(location.longitude),
            timeIso = Instant.ofEpochMilli(location.time).toString(),
        )
        cached.set(fix)
        return fix
    }

    private fun hasPermission(): Boolean {
        val coarse = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val fine = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        return coarse || fine
    }

    companion object {
        // 3 decimal places ≈ 110 m at the equator (precision target ≈ 100 m).
        fun reduce(coord: Double): Double = floor(coord * 1000.0) / 1000.0
    }
}
