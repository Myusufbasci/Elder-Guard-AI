package com.eldercare.elder.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface EldercareApi {

    @POST("v1/elder/pairing/redeem")
    suspend fun redeem(@Body req: RedeemRequest): Response<ApiEnvelope<RedeemResponse>>

    @POST("v1/elder/telemetry")
    suspend fun ingestTelemetry(@Body req: TelemetryRequest): Response<ApiEnvelope<IngestResult>>

    @POST("v1/auth/refresh")
    suspend fun refresh(@Body req: RefreshRequest): Response<ApiEnvelope<RefreshResponse>>
}
