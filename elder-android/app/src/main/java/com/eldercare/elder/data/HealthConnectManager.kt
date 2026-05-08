package com.eldercare.elder.data

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.eldercare.elder.network.TelemetrySample
import java.io.IOException
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.reflect.KClass

/**
 * Wraps Health Connect for ElderCare. Implements the differential changes-token
 * pattern (REVERSE Pattern 8): persist nextChangesToken per record type, refetch
 * baseline on changesTokenExpired, never re-scan history on each tick.
 */
@Singleton
class HealthConnectManager @Inject constructor(
    private val context: Context,
) {

    enum class Availability { INSTALLED, NOT_INSTALLED, NOT_SUPPORTED }

    val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    fun availability(): Availability =
        when (HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PROVIDER)) {
            HealthConnectClient.SDK_AVAILABLE -> Availability.INSTALLED
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> Availability.NOT_INSTALLED
            else -> Availability.NOT_SUPPORTED
        }

    private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    suspend fun hasAllPermissions(): Boolean =
        client().permissionController.getGrantedPermissions().containsAll(permissions)

    /**
     * Pulls all new samples since the last changes token for the given record types.
     * Returns the API DTO list ready to POST and the next-token map keyed by record type.
     *
     * Why per-record-type tokens: Health Connect mints tokens against a specific
     * RecordType set; mixing types across calls invalidates them.
     */
    suspend fun pullChanges(tokenStore: SyncTokenStore): Result {
        val samples = mutableListOf<TelemetrySample>()
        val newTokens = mutableMapOf<String, String>()
        for ((typeKey, recordType) in TRACKED_TYPES) {
            val token = tokenStore.getToken(typeKey)
            if (token == null) {
                samples.addAll(readBaseline(recordType))
                newTokens[typeKey] = mintToken(recordType)
            } else {
                val (typeSamples, nextToken) = try {
                    drainChanges(token, recordType)
                } catch (e: TokenExpiredException) {
                    samples.addAll(readBaseline(recordType))
                    val refreshed = mintToken(recordType)
                    Pair(emptyList(), refreshed)
                }
                samples.addAll(typeSamples)
                newTokens[typeKey] = nextToken
            }
        }
        return Result(samples, newTokens)
    }

    private suspend fun mintToken(recordType: KClass<out androidx.health.connect.client.records.Record>): String =
        client().getChangesToken(ChangesTokenRequest(recordTypes = setOf(recordType)))

    private suspend fun drainChanges(
        startToken: String,
        recordType: KClass<out androidx.health.connect.client.records.Record>,
    ): Pair<List<TelemetrySample>, String> {
        var token = startToken
        val collected = mutableListOf<TelemetrySample>()
        var more = true
        while (more) {
            val response = client().getChanges(token)
            if (response.changesTokenExpired) throw TokenExpiredException()
            response.changes.forEach { change ->
                val upserted = (change as? androidx.health.connect.client.changes.UpsertionChange)
                    ?.record ?: return@forEach
                collected.addAll(mapRecord(upserted))
            }
            token = response.nextChangesToken
            more = response.hasMore
        }
        return collected to token
    }

    private suspend fun readBaseline(
        recordType: KClass<out androidx.health.connect.client.records.Record>,
    ): List<TelemetrySample> {
        val end = Instant.now()
        val start = end.minus(24, ChronoUnit.HOURS)
        val request = ReadRecordsRequest(
            recordType = recordType,
            timeRangeFilter = TimeRangeFilter.between(start, end),
        )
        @Suppress("UNCHECKED_CAST")
        val response = client().readRecords(request as ReadRecordsRequest<androidx.health.connect.client.records.Record>)
        return response.records.flatMap { mapRecord(it) }
    }

    fun mapRecord(record: androidx.health.connect.client.records.Record): List<TelemetrySample> = when (record) {
        is HeartRateRecord -> record.samples.map { s ->
            TelemetrySample(
                time = s.time.toString(),
                metric = "heart_rate",
                value = s.beatsPerMinute.toDouble(),
                quality = null,
            )
        }
        is RestingHeartRateRecord -> listOf(
            TelemetrySample(
                time = record.time.toString(),
                metric = "resting_heart_rate",
                value = record.beatsPerMinute.toDouble(),
                quality = null,
            )
        )
        is StepsRecord -> listOf(
            TelemetrySample(
                time = record.endTime.toString(),
                metric = "steps",
                value = record.count.toDouble(),
                quality = null,
            )
        )
        is SleepSessionRecord -> listOf(
            TelemetrySample(
                time = record.endTime.toString(),
                metric = "sleep_duration",
                value = ChronoUnit.SECONDS.between(record.startTime, record.endTime).toDouble(),
                quality = null,
            )
        )
        else -> emptyList()
    }

    data class Result(
        val samples: List<TelemetrySample>,
        val newTokens: Map<String, String>,
    )

    private class TokenExpiredException : IOException("Health Connect changes token expired")

    companion object {
        const val HEALTH_CONNECT_PROVIDER = "com.google.android.apps.healthdata"
        val TRACKED_TYPES: Map<String, KClass<out androidx.health.connect.client.records.Record>> = mapOf(
            "heart_rate" to HeartRateRecord::class,
            "resting_heart_rate" to RestingHeartRateRecord::class,
            "steps" to StepsRecord::class,
            "sleep" to SleepSessionRecord::class,
        )
    }
}
