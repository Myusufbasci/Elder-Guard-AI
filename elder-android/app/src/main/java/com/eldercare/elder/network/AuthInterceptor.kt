package com.eldercare.elder.network

import com.eldercare.elder.data.TokenStore
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val skipAuth = original.url.encodedPath.let {
            it.endsWith("/v1/elder/pairing/redeem") || it.endsWith("/v1/auth/refresh")
        }
        if (skipAuth) return chain.proceed(original)

        val token = tokenStore.accessToken() ?: return chain.proceed(original)
        val authorized = original.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
        return chain.proceed(authorized)
    }
}
