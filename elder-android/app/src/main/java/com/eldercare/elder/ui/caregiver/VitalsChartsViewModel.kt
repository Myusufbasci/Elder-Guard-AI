package com.eldercare.elder.ui.caregiver

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.VitalsBucketDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class TimeRange(val days: Long, val label: String) {
    WEEK(7, "7g"),
    MONTH(30, "30g"),
    QUARTER(90, "90g"),
}

data class MetricSeries(
    val values: List<Double>,
    val min: Double?,
    val max: Double?,
    val avg: Double?,
)

data class VitalsCharts(
    val heartRate: MetricSeries,
    val restingHr: MetricSeries,
    val steps: MetricSeries,
    val sleepHours: MetricSeries,
)

sealed interface VitalsChartsState {
    data object Loading : VitalsChartsState
    data class Success(val charts: VitalsCharts) : VitalsChartsState
    data class Error(val message: String) : VitalsChartsState
}

@HiltViewModel
class VitalsChartsViewModel @Inject constructor(
    private val api: EldercareApi,
) : ViewModel() {

    private val _state = MutableStateFlow<VitalsChartsState>(VitalsChartsState.Loading)
    val state: StateFlow<VitalsChartsState> = _state.asStateFlow()

    private val _range = MutableStateFlow(TimeRange.WEEK)
    val range: StateFlow<TimeRange> = _range.asStateFlow()

    private var elderId: String = ""

    fun start(elderId: String) {
        this.elderId = elderId
        load()
    }

    fun setRange(range: TimeRange) {
        if (_range.value == range) return
        _range.value = range
        load()
    }

    private fun load() {
        if (elderId.isBlank()) return
        _state.value = VitalsChartsState.Loading
        viewModelScope.launch {
            try {
                val from = java.time.Instant.now()
                    .minusSeconds(_range.value.days * 24 * 3600)
                    .toString()
                val resp = api.getVitals(elderId, from = from)
                if (!resp.isSuccessful) {
                    _state.value = VitalsChartsState.Error("Veriler yüklenemedi (${resp.code()}).")
                    return@launch
                }
                val grouped = resp.body()?.data.orEmpty()
                _state.value = VitalsChartsState.Success(
                    VitalsCharts(
                        heartRate = series(grouped["heart_rate"]),
                        restingHr = series(grouped["resting_heart_rate"]),
                        steps = series(grouped["steps"]),
                        sleepHours = series(grouped["sleep_duration"]) { it / 3600.0 },
                    )
                )
            } catch (e: Exception) {
                _state.value = VitalsChartsState.Error(e.message ?: "Ağ hatası.")
            }
        }
    }

    private fun series(
        buckets: List<VitalsBucketDto>?,
        transform: (Double) -> Double = { it },
    ): MetricSeries {
        val values = buckets.orEmpty().map { transform(it.avgValue) }
        return MetricSeries(
            values = values,
            min = values.minOrNull(),
            max = values.maxOrNull(),
            avg = if (values.isEmpty()) null else values.average(),
        )
    }
}
