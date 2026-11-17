package com.eldercare.elder.ui.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.auth.GoogleSignInHelper
import com.eldercare.elder.auth.GoogleSignInResult
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.data.UserRole
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.GoogleLoginRequest
import com.eldercare.elder.network.LoginRequest
import com.eldercare.elder.network.RegisterRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface AuthUiState {
    data object Idle : AuthUiState
    data object Loading : AuthUiState
    data object Success : AuthUiState
    data class Error(val message: String) : AuthUiState
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val api: EldercareApi,
    private val tokenStore: TokenStore,
) : ViewModel() {

    private val _state = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = AuthUiState.Error("Email ve şifre boş olamaz.")
            return
        }
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            try {
                val response = api.login(LoginRequest(email.trim(), password))
                if (!response.isSuccessful) {
                    _state.value = AuthUiState.Error(
                        when (response.code()) {
                            401 -> "Email veya şifre hatalı."
                            429 -> "Çok fazla deneme. Daha sonra tekrar dene."
                            else -> "Giriş başarısız (${response.code()})."
                        }
                    )
                    return@launch
                }
                val tokens = response.body()?.data
                if (tokens == null) {
                    _state.value = AuthUiState.Error("Boş yanıt.")
                    return@launch
                }
                tokenStore.saveRole(UserRole.CAREGIVER)
                tokenStore.saveProfile(firstName = null, lastName = null, email = email.trim())
                tokenStore.saveTokens(tokens.accessToken, tokens.refreshToken)
                _state.value = AuthUiState.Success
            } catch (e: Exception) {
                _state.value = AuthUiState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }

    fun register(email: String, password: String, firstName: String, lastName: String) {
        if (email.isBlank() || password.length < 8 || firstName.isBlank() || lastName.isBlank()) {
            _state.value = AuthUiState.Error("Tüm alanları doldur. Şifre en az 8 karakter.")
            return
        }
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            try {
                val response = api.register(
                    RegisterRequest(
                        email = email.trim(),
                        password = password,
                        firstName = firstName.trim(),
                        lastName = lastName.trim(),
                    )
                )
                if (!response.isSuccessful) {
                    _state.value = AuthUiState.Error(
                        when (response.code()) {
                            409 -> "Bu email zaten kayıtlı."
                            400 -> "Geçersiz form verisi."
                            else -> "Kayıt başarısız (${response.code()})."
                        }
                    )
                    return@launch
                }
                val tokens = response.body()?.data
                if (tokens == null) {
                    _state.value = AuthUiState.Error("Boş yanıt.")
                    return@launch
                }
                tokenStore.saveRole(UserRole.CAREGIVER)
                tokenStore.saveProfile(firstName.trim(), lastName.trim(), email.trim())
                tokenStore.saveTokens(tokens.accessToken, tokens.refreshToken)
                _state.value = AuthUiState.Success
            } catch (e: Exception) {
                _state.value = AuthUiState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }

    /**
     * Triggered from a Composable with a context (UI handle for the credential
     * picker). Calls Credential Manager → gets Google ID token → trades it at
     * /v1/auth/google for access+refresh tokens.
     */
    fun signInWithGoogle(context: Context) {
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            val helper = GoogleSignInHelper(context)
            when (val res = helper.signIn()) {
                is GoogleSignInResult.Cancelled -> _state.value = AuthUiState.Idle
                is GoogleSignInResult.NoAccount ->
                    _state.value = AuthUiState.Error(
                        "Cihazda Google hesabı yok. Önce bir hesap ekle."
                    )
                is GoogleSignInResult.Error ->
                    _state.value = AuthUiState.Error(res.message)
                is GoogleSignInResult.Success -> exchangeGoogleToken(res.idToken)
            }
        }
    }

    private suspend fun exchangeGoogleToken(idToken: String) {
        try {
            val response = api.googleLogin(GoogleLoginRequest(idToken))
            if (!response.isSuccessful) {
                _state.value = AuthUiState.Error("Google girişi reddedildi (${response.code()}).")
                return
            }
            val tokens = response.body()?.data
            if (tokens == null) {
                _state.value = AuthUiState.Error("Boş yanıt.")
                return
            }
            tokenStore.saveRole(UserRole.CAREGIVER)
            tokenStore.saveTokens(tokens.accessToken, tokens.refreshToken)
            _state.value = AuthUiState.Success
        } catch (e: Exception) {
            _state.value = AuthUiState.Error(e.message ?: "Ağ hatası.")
        }
    }

    fun reset() {
        _state.value = AuthUiState.Idle
    }
}
