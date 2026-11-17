package com.eldercare.elder.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface EldercareApi {

    // Elder pairing flow
    @POST("v1/elder/pairing/redeem")
    suspend fun redeem(@Body req: RedeemRequest): Response<ApiEnvelope<RedeemResponse>>

    @POST("v1/elder/telemetry")
    suspend fun ingestTelemetry(@Body req: TelemetryRequest): Response<ApiEnvelope<IngestResult>>

    // Session-validity probe: 401 once the caregiver deletes this elder, which
    // triggers RefreshAuthenticator to clear tokens → device logs out (sync).
    @GET("v1/elder/me")
    suspend fun getMe(): Response<Unit>

    // "Reset pairing" on the device: deletes the elder server-side so the caregiver's
    // web list drops it and any open detail page is redirected out.
    @DELETE("v1/elder/me")
    suspend fun unpair(): Response<Unit>

    // Auth
    @POST("v1/auth/login")
    suspend fun login(@Body req: LoginRequest): Response<ApiEnvelope<AuthTokensResponse>>

    @POST("v1/auth/register")
    suspend fun register(@Body req: RegisterRequest): Response<ApiEnvelope<AuthTokensResponse>>

    @POST("v1/auth/google")
    suspend fun googleLogin(@Body req: GoogleLoginRequest): Response<ApiEnvelope<AuthTokensResponse>>

    @POST("v1/auth/refresh")
    suspend fun refresh(@Body req: RefreshRequest): Response<ApiEnvelope<RefreshResponse>>

    // Account snapshot (incl. emailVerified) + resend verification email.
    // Named getAuthMe to avoid colliding with the elder session-probe getMe() above.
    @GET("v1/auth/me")
    suspend fun getAuthMe(): Response<ApiEnvelope<MeResponse>>

    @POST("v1/auth/resend-verification")
    suspend fun resendVerification(): Response<ApiEnvelope<ResendVerificationResponse>>

    // Caregiver — elders
    @GET("v1/caregiver/elders")
    suspend fun listElders(): Response<ApiEnvelope<List<ElderSummaryDto>>>

    @POST("v1/caregiver/elders")
    suspend fun createElder(@Body req: CreateElderRequest): Response<ApiEnvelope<PairingCodeResponse>>

    @DELETE("v1/caregiver/elders/{elderId}")
    suspend fun deleteElder(@Path("elderId") elderId: String): Response<Unit>

    // Caregiver — elder detail / vitals / location / AI summary
    @GET("v1/caregiver/elders/{elderId}/vitals")
    suspend fun getVitals(
        @Path("elderId") elderId: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): Response<ApiEnvelope<Map<String, List<VitalsBucketDto>>>>

    @GET("v1/caregiver/elders/{elderId}/location")
    suspend fun getLocation(
        @Path("elderId") elderId: String,
    ): Response<ApiEnvelope<LocationResponse>>

    @GET("v1/caregiver/elders/{elderId}/summary")
    suspend fun getSummary(
        @Path("elderId") elderId: String,
    ): Response<ApiEnvelope<AiSummaryDto?>>

    // Caregiver — alerts feed
    @GET("v1/caregiver/alerts")
    suspend fun getAlerts(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("severity") severity: String? = null,
        @Query("metric") metric: String? = null,
        @Query("acknowledged") acknowledged: Boolean? = null,
    ): Response<ApiEnvelope<AlertsPage>>

    @POST("v1/caregiver/alerts/{id}/ack")
    suspend fun acknowledgeAlert(
        @Path("id") alertId: String,
    ): Response<ApiEnvelope<AckResponse>>
}
