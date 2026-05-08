package com.eldercare.elder

import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.BaseUrl
import com.eldercare.elder.network.RefreshAuthenticator
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class RefreshAuthenticatorTest {

    private lateinit var server: MockWebServer
    private lateinit var tokenStore: TokenStore
    private lateinit var authenticator: RefreshAuthenticator
    private val moshi: Moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()

    @Before
    fun setUp() {
        server = MockWebServer().also { it.start() }
        tokenStore = mockk(relaxed = true)
        authenticator = RefreshAuthenticator(tokenStore, BaseUrl(server.url("/").toString()), moshi)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `on 401 successfully refreshes and retries with new bearer`() {
        every { tokenStore.refreshToken() } returns "OLD_REFRESH"
        every { tokenStore.accessToken() } returns "OLD_ACCESS"

        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{"data":{"accessToken":"NEW_ACCESS","refreshToken":"NEW_REFRESH"}}"""
            )
        )

        val original = Request.Builder()
            .url(server.url("/v1/elder/telemetry"))
            .header("Authorization", "Bearer OLD_ACCESS")
            .post(okhttp3.RequestBody.create(null, ""))
            .build()
        val unauthorized = okhttp3.Response.Builder()
            .request(original)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retry = authenticator.authenticate(null, unauthorized)
        assertEquals("Bearer NEW_ACCESS", retry?.header("Authorization"))
        verify { tokenStore.saveTokens("NEW_ACCESS", "NEW_REFRESH") }
    }

    @Test
    fun `gives up and clears tokens when refresh itself returns 401`() {
        every { tokenStore.refreshToken() } returns "STALE"
        every { tokenStore.accessToken() } returns "STALE_ACCESS"

        server.enqueue(MockResponse().setResponseCode(401).setBody("{}"))

        val original = Request.Builder()
            .url(server.url("/v1/elder/telemetry"))
            .header("Authorization", "Bearer STALE_ACCESS")
            .post(okhttp3.RequestBody.create(null, ""))
            .build()
        val unauthorized = okhttp3.Response.Builder()
            .request(original)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retry = authenticator.authenticate(null, unauthorized)
        assertNull(retry)
        verify { tokenStore.clear() }
    }

    @Test
    fun `does not retry after a second 401 response in the chain`() {
        every { tokenStore.refreshToken() } returns "R"
        every { tokenStore.accessToken() } returns "A"

        val first = Request.Builder()
            .url(server.url("/v1/elder/telemetry"))
            .header("Authorization", "Bearer A")
            .post(okhttp3.RequestBody.create(null, ""))
            .build()
        val firstResp = okhttp3.Response.Builder()
            .request(first)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()
        val secondResp = okhttp3.Response.Builder()
            .request(first)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .priorResponse(firstResp)
            .build()

        // OkHttpClient field exists only to silence the unused-import lint;
        // we test the authenticator method directly.
        val unused: OkHttpClient? = null
        unused?.dispatcher

        assertNull(authenticator.authenticate(null, secondResp))
    }
}
