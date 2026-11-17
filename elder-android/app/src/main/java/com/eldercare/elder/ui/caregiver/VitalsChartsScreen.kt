package com.eldercare.elder.ui.caregiver

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VitalsChartsScreen(
    elderId: String,
    elderName: String,
    onBack: () -> Unit,
    viewModel: VitalsChartsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val range by viewModel.range.collectAsState()

    LaunchedEffect(elderId) { viewModel.start(elderId) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Grafikler — ${elderName.ifBlank { "Yaşlı" }}") },
                navigationIcon = { TextButton(onClick = onBack) { Text("←") } },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Time-range selector (mirrors web TimeRangeSelector)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TimeRange.entries.forEach { r ->
                        FilterChip(
                            selected = range == r,
                            onClick = { viewModel.setRange(r) },
                            label = { Text(r.label) },
                        )
                    }
                }

                when (val s = state) {
                    is VitalsChartsState.Loading ->
                        Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                        }

                    is VitalsChartsState.Error ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                            Text(s.message, color = MaterialTheme.colorScheme.error)
                            Spacer(Modifier.height(8.dp))
                            Button(onClick = { viewModel.setRange(range) }) { Text("Tekrar dene") }
                        }

                    is VitalsChartsState.Success -> {
                        val c = s.charts
                        ChartCard("Nabız (bpm)", "bpm") {
                            MetricLineChart(c.heartRate.values, Color(0xFFC98A76), it)
                            ChartLegendRow(c.heartRate.min, c.heartRate.max, c.heartRate.avg, "bpm")
                        }
                        ChartCard("Dinlenme Nabzı (bpm)", "bpm") {
                            MetricLineChart(c.restingHr.values, Color(0xFF5B8A72), it)
                            ChartLegendRow(c.restingHr.min, c.restingHr.max, c.restingHr.avg, "bpm")
                        }
                        ChartCard("Adım", "adım") {
                            MetricBarChart(c.steps.values, Color(0xFF3F6B56), it)
                            ChartLegendRow(c.steps.min, c.steps.max, c.steps.avg, "")
                        }
                        ChartCard("Uyku (saat)", "saat") {
                            MetricBarChart(c.sleepHours.values, Color(0xFFD99E54), it)
                            ChartLegendRow(c.sleepHours.min, c.sleepHours.max, c.sleepHours.avg, "saat")
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartCard(title: String, unit: String, content: @Composable (Modifier) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            content(Modifier)
        }
    }
}
