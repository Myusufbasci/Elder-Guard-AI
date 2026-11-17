package com.eldercare.elder.ui.caregiver

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.network.CreateElderRequest
import com.eldercare.elder.network.ElderSummaryDto
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.PairingCodeResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface ElderListState {
    data object Loading : ElderListState
    data class Success(val elders: List<ElderSummaryDto>) : ElderListState
    data class Error(val message: String) : ElderListState
}

sealed interface CreateElderState {
    data object Idle : CreateElderState
    data object Loading : CreateElderState
    data class Success(val response: PairingCodeResponse) : CreateElderState
    data class Error(val message: String) : CreateElderState
}

// Soft email-verification reminder state for the caregiver home banner.
data class VerifyState(
    val show: Boolean = false,
    val email: String? = null,
    val resend: ResendStatus = ResendStatus.Idle,
)

enum class ResendStatus { Idle, Sending, Sent, Cooldown, Error }

@HiltViewModel
class EldersViewModel @Inject constructor(
    private val api: EldercareApi,
) : ViewModel() {

    private val _list = MutableStateFlow<ElderListState>(ElderListState.Loading)
    val list: StateFlow<ElderListState> = _list.asStateFlow()

    private val _create = MutableStateFlow<CreateElderState>(CreateElderState.Idle)
    val create: StateFlow<CreateElderState> = _create.asStateFlow()

    private val _verify = MutableStateFlow(VerifyState())
    val verify: StateFlow<VerifyState> = _verify.asStateFlow()

    /** Fetch the account snapshot; show the reminder banner if email unverified. */
    fun loadVerificationStatus() {
        viewModelScope.launch {
            try {
                val response = api.getAuthMe()
                val me = response.body()?.data
                if (response.isSuccessful && me != null && !me.emailVerified && me.email != null) {
                    _verify.value = VerifyState(show = true, email = me.email)
                } else {
                    _verify.value = VerifyState(show = false)
                }
            } catch (_: Exception) {
                // Best-effort — never surface an error for the banner probe.
            }
        }
    }

    fun resendVerification() {
        _verify.value = _verify.value.copy(resend = ResendStatus.Sending)
        viewModelScope.launch {
            try {
                val response = api.resendVerification()
                _verify.value = _verify.value.copy(
                    resend = when {
                        response.isSuccessful -> ResendStatus.Sent
                        response.code() == 409 -> ResendStatus.Cooldown
                        else -> ResendStatus.Error
                    },
                )
            } catch (_: Exception) {
                _verify.value = _verify.value.copy(resend = ResendStatus.Error)
            }
        }
    }

    fun dismissVerifyBanner() {
        _verify.value = _verify.value.copy(show = false)
    }

    fun refresh() {
        _list.value = ElderListState.Loading
        viewModelScope.launch {
            try {
                val response = api.listElders()
                if (!response.isSuccessful) {
                    _list.value = ElderListState.Error("Yaşlılar yüklenemedi (${response.code()}).")
                    return@launch
                }
                val elders = response.body()?.data.orEmpty()
                _list.value = ElderListState.Success(elders)
            } catch (e: Exception) {
                _list.value = ElderListState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }

    /** dateOfBirth in ISO yyyy-MM-dd format. Elders have no email. */
    fun createElder(firstName: String, lastName: String, dateOfBirth: String) {
        if (firstName.isBlank() || lastName.isBlank() || dateOfBirth.isBlank()) {
            _create.value = CreateElderState.Error("Tüm alanları doldur.")
            return
        }
        _create.value = CreateElderState.Loading
        viewModelScope.launch {
            try {
                val response = api.createElder(
                    CreateElderRequest(
                        firstName = firstName.trim(),
                        lastName = lastName.trim(),
                        dateOfBirth = dateOfBirth.trim(),
                    )
                )
                if (!response.isSuccessful) {
                    _create.value = CreateElderState.Error(
                        when (response.code()) {
                            400 -> "Geçersiz form. Tarih biçimi: 1950-01-15"
                            else -> "Eklenemedi (${response.code()})."
                        }
                    )
                    return@launch
                }
                val payload = response.body()?.data
                if (payload == null) {
                    _create.value = CreateElderState.Error("Boş yanıt.")
                    return@launch
                }
                _create.value = CreateElderState.Success(payload)
                refresh()
            } catch (e: Exception) {
                _create.value = CreateElderState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }

    fun resetCreate() {
        _create.value = CreateElderState.Idle
    }

    fun deleteElder(elderId: String) {
        viewModelScope.launch {
            try {
                val response = api.deleteElder(elderId)
                if (response.isSuccessful) {
                    refresh()
                } else {
                    _list.value = ElderListState.Error("Silinemedi (${response.code()}).")
                }
            } catch (e: Exception) {
                _list.value = ElderListState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }
}
