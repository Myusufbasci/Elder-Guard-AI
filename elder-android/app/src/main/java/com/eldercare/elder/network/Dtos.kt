package com.eldercare.elder.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class RedeemRequest(
    val code: String,
    val fcmToken: String? = null,
    val model: String? = null,
    val osVersion: String? = null,
)

@JsonClass(generateAdapter = true)
data class RedeemResponse(
    val accessToken: String,
    val refreshToken: String,
    val deviceId: String,
)

@JsonClass(generateAdapter = true)
data class TelemetrySample(
    val time: String,
    val metric: String,
    val value: Double,
    val quality: Int? = null,
)

@JsonClass(generateAdapter = true)
data class TelemetryRequest(
    val deviceId: String,
    val samples: List<TelemetrySample>,
)

@JsonClass(generateAdapter = true)
data class IngestResult(
    val inserted: Int,
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(
    val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class RefreshResponse(
    val accessToken: String,
    val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val data: T,
)

// --- Caregiver auth ---

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
)

@JsonClass(generateAdapter = true)
data class AuthTokensResponse(
    val accessToken: String,
    val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class GoogleLoginRequest(
    val idToken: String,
)

// Current account snapshot — drives the "verify your email" reminder banner.
@JsonClass(generateAdapter = true)
data class MeResponse(
    val id: String,
    val email: String?,
    val firstName: String,
    val lastName: String,
    val role: String,
    val emailVerified: Boolean,
)

@JsonClass(generateAdapter = true)
data class ResendVerificationResponse(
    val sent: Boolean,
)

// --- Caregiver elders ---

@JsonClass(generateAdapter = true)
data class ElderSummaryDto(
    val id: String,
    val firstName: String,
    val lastName: String,
    val dateOfBirth: String,
    val linkedAt: String,
)

// Elders have no email — only the other fields are collected.
@JsonClass(generateAdapter = true)
data class CreateElderRequest(
    val firstName: String,
    val lastName: String,
    val dateOfBirth: String,
)

@JsonClass(generateAdapter = true)
data class PairingCodeResponse(
    val code: String,
    val expiresAt: String,
    // No elder exists until the code is redeemed, so the backend no longer returns
    // these — kept nullable for backward/forward compatibility.
    val pairingToken: String? = null,
    val elderId: String? = null,
)

// --- Caregiver dashboard: vitals (telemetry_1h continuous aggregate) ---

// Raw SQL column names are snake_case; map them explicitly for Moshi.
@JsonClass(generateAdapter = true)
data class VitalsBucketDto(
    val bucket: String,
    @Json(name = "device_id") val deviceId: String,
    val metric: String,
    @Json(name = "avg_value") val avgValue: Double,
    @Json(name = "min_value") val minValue: Double,
    @Json(name = "max_value") val maxValue: Double,
)

// --- Caregiver dashboard: location ---

@JsonClass(generateAdapter = true)
data class LocationPointDto(
    val lat: Double,
    val lng: Double,
    val time: String,
)

@JsonClass(generateAdapter = true)
data class LocationResponse(
    val latest: LocationPointDto?,
    val trail: List<LocationPointDto>,
)

// --- Caregiver dashboard: AI daily summary ---

@JsonClass(generateAdapter = true)
data class AiSummaryContent(
    @Json(name = "status_category") val statusCategory: String?,
    @Json(name = "summary_text") val summaryText: String?,
    @Json(name = "anomalies_noted") val anomaliesNoted: Boolean?,
    @Json(name = "action_recommendation") val actionRecommendation: String?,
)

@JsonClass(generateAdapter = true)
data class AiSummaryDto(
    val id: String,
    val content: AiSummaryContent?,
    val sentAt: String,
)

// --- Caregiver alerts (AnomalyEvent feed) ---

@JsonClass(generateAdapter = true)
data class AlertElderUser(
    val firstName: String,
    val lastName: String,
)

@JsonClass(generateAdapter = true)
data class AlertElder(
    val user: AlertElderUser,
)

@JsonClass(generateAdapter = true)
data class AlertDto(
    val id: String,
    val elderId: String,
    val metric: String,
    val kind: String,
    val severity: String,
    val detectedAt: String,
    val modifiedZScore: Double,
    val observedValue: Double,
    val medianValue: Double,
    val madValue: Double,
    val acknowledged: Boolean,
    val acknowledgedAt: String?,
    val elder: AlertElder?,
)

@JsonClass(generateAdapter = true)
data class AlertsPage(
    val items: List<AlertDto>,
    val cursor: String?,
)

@JsonClass(generateAdapter = true)
data class AckResponse(
    val id: String,
    val acknowledged: Boolean,
    val acknowledgedAt: String?,
)
