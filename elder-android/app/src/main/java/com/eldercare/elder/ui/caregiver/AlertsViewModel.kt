package com.eldercare.elder.ui.caregiver

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.network.AlertDto
import com.eldercare.elder.network.EldercareApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface AlertsState {
    data object Loading : AlertsState
    data class Success(
        val items: List<AlertDto>,
        val cursor: String?,
        val loadingMore: Boolean = false,
    ) : AlertsState
    data class Error(val message: String) : AlertsState
}

/** null = all; true/false = acknowledged filter. */
@HiltViewModel
class AlertsViewModel @Inject constructor(
    private val api: EldercareApi,
) : ViewModel() {

    private val _state = MutableStateFlow<AlertsState>(AlertsState.Loading)
    val state: StateFlow<AlertsState> = _state.asStateFlow()

    private val _severity = MutableStateFlow<String?>(null)
    val severity: StateFlow<String?> = _severity.asStateFlow()

    private val _onlyUnack = MutableStateFlow(false)
    val onlyUnack: StateFlow<Boolean> = _onlyUnack.asStateFlow()

    init {
        refresh()
    }

    fun setSeverity(value: String?) {
        if (_severity.value == value) return
        _severity.value = value
        refresh()
    }

    fun toggleUnack() {
        _onlyUnack.value = !_onlyUnack.value
        refresh()
    }

    fun refresh() {
        _state.value = AlertsState.Loading
        viewModelScope.launch {
            try {
                val resp = api.getAlerts(
                    cursor = null,
                    limit = 20,
                    severity = _severity.value,
                    acknowledged = if (_onlyUnack.value) false else null,
                )
                if (!resp.isSuccessful) {
                    _state.value = AlertsState.Error("Uyarılar yüklenemedi (${resp.code()}).")
                    return@launch
                }
                val page = resp.body()?.data
                _state.value = AlertsState.Success(page?.items.orEmpty(), page?.cursor)
            } catch (e: Exception) {
                _state.value = AlertsState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }

    fun loadMore() {
        val current = _state.value
        if (current !is AlertsState.Success || current.cursor == null || current.loadingMore) return
        _state.value = current.copy(loadingMore = true)
        viewModelScope.launch {
            try {
                val resp = api.getAlerts(
                    cursor = current.cursor,
                    limit = 20,
                    severity = _severity.value,
                    acknowledged = if (_onlyUnack.value) false else null,
                )
                if (!resp.isSuccessful) {
                    _state.value = current.copy(loadingMore = false)
                    return@launch
                }
                val page = resp.body()?.data
                _state.value = AlertsState.Success(
                    items = current.items + page?.items.orEmpty(),
                    cursor = page?.cursor,
                )
            } catch (e: Exception) {
                _state.value = current.copy(loadingMore = false)
            }
        }
    }

    fun acknowledge(alertId: String) {
        val current = _state.value
        if (current !is AlertsState.Success) return
        // Optimistic update
        _state.value = current.copy(
            items = current.items.map {
                if (it.id == alertId) it.copy(acknowledged = true) else it
            }
        )
        viewModelScope.launch {
            try {
                val resp = api.acknowledgeAlert(alertId)
                if (!resp.isSuccessful) refresh()
            } catch (e: Exception) {
                refresh()
            }
        }
    }
}
