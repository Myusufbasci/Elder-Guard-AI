package com.eldercare.elder.ui.pairing

import android.content.Context
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.RedeemRequest
import com.eldercare.elder.sync.HealthSyncService
import com.eldercare.elder.sync.WorkManagerScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface PairingUiState {
    data object Idle : PairingUiState
    data object Loading : PairingUiState
    data object Success : PairingUiState
    data class Error(val message: String) : PairingUiState
}

@HiltViewModel
class PairingViewModel @Inject constructor(
    private val api: EldercareApi,
    private val tokenStore: TokenStore,
    private val scheduler: WorkManagerScheduler,
    @ApplicationContext private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow<PairingUiState>(PairingUiState.Idle)
    val state: StateFlow<PairingUiState> = _state.asStateFlow()

    fun submit(code: String) {
        if (code.length != 6 || !code.all { it.isDigit() }) {
            _state.value = PairingUiState.Error("Code must be 6 digits.")
            return
        }
        _state.value = PairingUiState.Loading
        viewModelScope.launch {
            try {
                val req = RedeemRequest(
                    code = code,
                    fcmToken = null,
                    model = Build.MODEL,
                    osVersion = Build.VERSION.RELEASE,
                )
                val response = api.redeem(req)
                if (!response.isSuccessful) {
                    _state.value = PairingUiState.Error(
                        when (response.code()) {
                            404 -> "Code not found."
                            409 -> "Code already used."
                            410 -> "Code expired."
                            429 -> "Too many attempts. Try again later."
                            else -> "Pairing failed (${response.code()})."
                        }
                    )
                    return@launch
                }
                val payload = response.body()?.data
                if (payload == null) {
                    _state.value = PairingUiState.Error("Empty response.")
                    return@launch
                }
                tokenStore.saveTokens(payload.accessToken, payload.refreshToken)
                tokenStore.saveDeviceId(payload.deviceId)
                scheduler.enqueuePeriodicSync()
                HealthSyncService.start(appContext)
                _state.value = PairingUiState.Success
            } catch (e: Exception) {
                _state.value = PairingUiState.Error(e.message ?: "Network error.")
            }
        }
    }

    fun reset() {
        _state.value = PairingUiState.Idle
    }
}
