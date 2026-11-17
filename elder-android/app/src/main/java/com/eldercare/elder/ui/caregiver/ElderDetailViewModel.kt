package com.eldercare.elder.ui.caregiver

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.network.AiSummaryContent
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.LocationPointDto
import com.eldercare.elder.network.VitalsBucketDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Latest snapshot value for a single metric, derived from the most recent bucket. */
data class LatestVital(
    val metric: String,
    val avg: Double,
)

data class ElderDetail(
    val latestVitals: Map<String, LatestVital>,
    val location: LocationPointDto?,
    val summary: AiSummaryContent?,
    val summaryAt: String?,
)

sealed interface ElderDetailState {
    data object Loading : ElderDetailState
    data class Success(val detail: ElderDetail) : ElderDetailState
    data class Error(val message: String) : ElderDetailState
}

@HiltViewModel
class ElderDetailViewModel @Inject constructor(
    private val api: EldercareApi,
) : ViewModel() {

    private val _state = MutableStateFlow<ElderDetailState>(ElderDetailState.Loading)
    val state: StateFlow<ElderDetailState> = _state.asStateFlow()

    fun load(elderId: String) {
        _state.value = ElderDetailState.Loading
        viewModelScope.launch {
            try {
                // 24h window for the snapshot, mirroring the web elder detail page.
                val from = java.time.Instant.now().minusSeconds(24 * 3600).toString()

                val vitalsDeferred = async { runCatching { api.getVitals(elderId, from = from) }.getOrNull() }
                val locationDeferred = async { runCatching { api.getLocation(elderId) }.getOrNull() }
                val summaryDeferred = async { runCatching { api.getSummary(elderId) }.getOrNull() }

                val vitalsResp = vitalsDeferred.await()
                val locationResp = locationDeferred.await()
                val summaryResp = summaryDeferred.await()

                val grouped: Map<String, List<VitalsBucketDto>> =
                    vitalsResp?.takeIf { it.isSuccessful }?.body()?.data.orEmpty()
                val latest = grouped.mapNotNull { (metric, buckets) ->
                    buckets.lastOrNull()?.let { metric to LatestVital(metric, it.avgValue) }
                }.toMap()

                val location = locationResp?.takeIf { it.isSuccessful }?.body()?.data?.latest
                val summaryDto = summaryResp?.takeIf { it.isSuccessful }?.body()?.data

                _state.value = ElderDetailState.Success(
                    ElderDetail(
                        latestVitals = latest,
                        location = location,
                        summary = summaryDto?.content,
                        summaryAt = summaryDto?.sentAt,
                    )
                )
            } catch (e: Exception) {
                _state.value = ElderDetailState.Error(e.message ?: "Veriler yüklenemedi.")
            }
        }
    }
}
