package com.eldercare.elder.ui.caregiver

import androidx.lifecycle.ViewModel
import com.eldercare.elder.data.Session
import com.eldercare.elder.data.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val tokenStore: TokenStore,
) : ViewModel() {

    val session: StateFlow<Session?> = tokenStore.session

    fun logout() = tokenStore.clear()
}
