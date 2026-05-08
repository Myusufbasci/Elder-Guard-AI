package com.eldercare.elder.network

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
