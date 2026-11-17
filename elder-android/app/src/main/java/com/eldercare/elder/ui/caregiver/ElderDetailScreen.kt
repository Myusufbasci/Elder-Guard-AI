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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ElderDetailScreen(
    elderId: String,
    elderName: String,
    onBack: () -> Unit,
    onVitals: () -> Unit,
    onAlerts: () -> Unit,
    viewModel: ElderDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(elderId) { viewModel.load(elderId) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(elderName.ifBlank { "Yaşlı detayı" }) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("←") }
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val s = state) {
                is ElderDetailState.Loading ->
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))

                is ElderDetailState.Error ->
                    Column(
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(s.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { viewModel.load(elderId) }) { Text("Tekrar dene") }
                    }

                is ElderDetailState.Success -> {
                    val d = s.detail
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        VitalsSnapshotCard(d)
                        AiSummaryCard(d)
                        LocationCard(d)

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Button(onClick = onVitals, modifier = Modifier.weight(1f)) {
                                Text("Grafikler")
                            }
                            OutlinedButton(onClick = onAlerts, modifier = Modifier.weight(1f)) {
                                Text("Uyarılar")
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun VitalsSnapshotCard(d: ElderDetail) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionTitle("Son Ölçümler (24s)")
            Spacer(Modifier.height(12.dp))
            val hr = d.latestVitals["heart_rate"]?.avg
            val rhr = d.latestVitals["resting_heart_rate"]?.avg
            val steps = d.latestVitals["steps"]?.avg
            val sleep = d.latestVitals["sleep_duration"]?.avg
            Row(modifier = Modifier.fillMaxWidth()) {
                MetricCell("Nabız", hr?.let { "${it.toInt()}" } ?: "—", "bpm", Modifier.weight(1f))
                MetricCell("Din. Nabız", rhr?.let { "${it.toInt()}" } ?: "—", "bpm", Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                MetricCell("Adım", steps?.let { "${it.toInt()}" } ?: "—", "bugün", Modifier.weight(1f))
                MetricCell("Uyku", sleep?.let { String.format("%.1f", it / 3600.0) } ?: "—", "saat", Modifier.weight(1f))
            }
            if (d.latestVitals.isEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Henüz ölçüm verisi yok.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun MetricCell(label: String, value: String, unit: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(2.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(0.dp))
            Text(" $unit", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AiSummaryCard(d: ElderDetail) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionTitle("Yapay Zeka Günlük Özet")
            Spacer(Modifier.height(8.dp))
            val s = d.summary
            if (s?.summaryText.isNullOrBlank()) {
                Text(
                    "Henüz özet oluşturulmadı. (Her gün 06:00 UTC'de üretilir.)",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                s?.statusCategory?.let { StatusChip(it) }
                Spacer(Modifier.height(8.dp))
                Text(s?.summaryText ?: "", style = MaterialTheme.typography.bodyMedium)
                if (!s?.actionRecommendation.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Öneri: ${s?.actionRecommendation}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                if (s?.anomaliesNoted == true) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "⚠ Son 24 saatte anomali tespit edildi",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}

@Composable
private fun LocationCard(d: ElderDetail) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionTitle("Konum")
            Spacer(Modifier.height(8.dp))
            val loc = d.location
            if (loc == null) {
                Text(
                    "Konum verisi yok.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text(
                    "Enlem: ${String.format("%.5f", loc.lat)}  Boylam: ${String.format("%.5f", loc.lng)}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Son güncelleme: ${loc.time.take(19).replace("T", " ")}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
internal fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
internal fun StatusChip(status: String) {
    val (label, color) = when (status) {
        "stable" -> "Stabil" to MaterialTheme.colorScheme.primary
        "needs_attention" -> "Dikkat" to MaterialTheme.colorScheme.tertiary
        "critical" -> "Kritik" to MaterialTheme.colorScheme.error
        else -> status to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(text = label, color = color, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
}
