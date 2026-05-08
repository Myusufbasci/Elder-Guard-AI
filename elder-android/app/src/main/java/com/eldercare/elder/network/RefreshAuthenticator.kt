package com.eldercare.elder.network

import com.eldercare.elder.data.TokenStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

/**
 * OkHttp Authenticator: on a 401 from any authenticated request, attempts a single
 * refresh against /v1/auth/refresh, persists rotated tokens, and retries the original
 * request once. Returns null (giving up) if refresh fails or has already been retried.
 *
 * Why: backend issues single-use refresh tokens (rotated on every refresh).
 * The api Provider breaks a Hilt cycle: api → OkHttp → RefreshAuthenticator → api.
 */
@Singleton
class RefreshAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val baseUrl: BaseUrl,
    private val moshi: Moshi,
) : Authenticator {

    @Synchronized
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null
        val refreshToken = tokenStore.refreshToken() ?: return null

        // If another thread already rotated to a new access token, retry with that.
        val current = tokenStore.accessToken()
        val sentAuth = response.request.header("Authorization")
        if (current != null && sentAuth != "Bearer $current") {
            return response.request.newBuilder()
                .header("Authorization", "Bearer $current")
                .build()
        }

        val newAccess = runBlocking { performRefresh(refreshToken) } ?: return null
        return response.request.newBuilder()
            .header("Authorization", "Bearer $newAccess")
            .build()
    }

    private suspend fun performRefresh(refreshToken: String): String? {
        val client = OkHttpClient.Builder().build()
        val adapter = moshi.adapter(RefreshRequest::class.java)
        val body = adapter.toJson(RefreshRequest(refreshToken))
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("${baseUrl.value.trimEnd('/')}/v1/auth/refresh")
            .post(body)
            .build()
        return try {
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) {
                    if (res.code == 401) tokenStore.clear()
                    return null
                }
                val rawJson = res.body?.string() ?: return null
                val envelopeType = com.squareup.moshi.Types.newParameterizedType(
                    ApiEnvelope::class.java,
                    RefreshResponse::class.java,
                )
                val envAdapter = moshi.adapter<ApiEnvelope<RefreshResponse>>(envelopeType)
                val payload = envAdapter.fromJson(rawJson)?.data ?: return null
                tokenStore.saveTokens(payload.accessToken, payload.refreshToken)
                payload.accessToken
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior: Response? = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}

data class BaseUrl(val value: String)
