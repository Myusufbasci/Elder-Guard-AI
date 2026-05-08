package com.eldercare.elder

import app.cash.turbine.test
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.ApiEnvelope
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.RedeemRequest
import com.eldercare.elder.network.RedeemResponse
import com.eldercare.elder.sync.WorkManagerScheduler
import com.eldercare.elder.ui.pairing.PairingUiState
import com.eldercare.elder.ui.pairing.PairingViewModel
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class PairingViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var api: EldercareApi
    private lateinit var tokenStore: TokenStore
    private lateinit var scheduler: WorkManagerScheduler
    private lateinit var vm: PairingViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        api = mockk()
        tokenStore = mockk(relaxed = true)
        scheduler = mockk(relaxed = true)
        // Cannot start the foreground service from a JVM unit test — pass a relaxed
        // mock context so HealthSyncService.start no-ops via system service stubs.
        vm = PairingViewModel(api, tokenStore, scheduler, mockk(relaxed = true))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `rejects non-6-digit code without hitting the api`() = runTest(dispatcher) {
        vm.submit("12a")
        assertTrue(vm.state.value is PairingUiState.Error)
        coVerify(exactly = 0) { api.redeem(any()) }
    }

    @Test
    fun `successful redeem stores tokens and enqueues sync`() = runTest(dispatcher) {
        coEvery { api.redeem(any<RedeemRequest>()) } returns Response.success(
            ApiEnvelope(RedeemResponse("AT", "RT", "device-uuid"))
        )

        vm.state.test {
            assertEquals(PairingUiState.Idle, awaitItem())
            vm.submit("123456")
            assertEquals(PairingUiState.Loading, awaitItem())
            assertEquals(PairingUiState.Success, awaitItem())
        }

        verify { tokenStore.saveTokens("AT", "RT") }
        verify { tokenStore.saveDeviceId("device-uuid") }
        verify { scheduler.enqueuePeriodicSync() }
    }

    @Test
    fun `non-200 response surfaces an error and does not store tokens`() = runTest(dispatcher) {
        coEvery { api.redeem(any<RedeemRequest>()) } returns Response.error(
            410,
            "{}".toResponseBody("application/json".toMediaType()),
        )

        vm.submit("123456")
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(vm.state.value is PairingUiState.Error)
        verify(exactly = 0) { tokenStore.saveTokens(any(), any()) }
    }
}
