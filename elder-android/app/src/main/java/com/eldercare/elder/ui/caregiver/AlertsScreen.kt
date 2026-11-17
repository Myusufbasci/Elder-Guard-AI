package com.eldercare.elder.ui.caregiver

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.eldercare.elder.network.AlertDto
import com.eldercare.elder.ui.theme.EcTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    viewModel: AlertsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val severity by viewModel.severity.collectAsState()
    val onlyUnack by viewModel.onlyUnack.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Uyarılar") }) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Filters
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(selected = severity == null, onClick = { viewModel.setSeverity(null) }, label = { Text("Tümü") })
                FilterChip(selected = severity == "HIGH", onClick = { viewModel.setSeverity("HIGH") }, label = { Text("Yüksek") })
                FilterChip(selected = severity == "CRITICAL", onClick = { viewModel.setSeverity("CRITICAL") }, label = { Text("Kritik") })
                FilterChip(selected = onlyUnack, onClick = { viewModel.toggleUnack() }, label = { Text("Onaysız") })
            }

            Box(modifier = Modifier.fillMaxSize()) {
                when (val s = state) {
                    is AlertsState.Loading ->
                        CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))

                    is AlertsState.Error ->
                        Column(
                            modifier = Modifier.align(Alignment.Center).padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(s.message, color = MaterialTheme.colorScheme.error)
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = { viewModel.refresh() }) { Text("Tekrar dene") }
                        }

                    is AlertsState.Success -> {
                        if (s.items.isEmpty()) {
                            Text(
                                "Uyarı yok. Her şey yolunda 👍",
                                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize().padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                items(s.items, key = { it.id }) { alert ->
                                    AlertCard(alert = alert, onAck = { viewModel.acknowledge(alert.id) })
                                }
                                if (s.cursor != null) {
                                    item {
                                        Box(modifier = Modifier.fillMaxWidth().padding(8.dp), contentAlignment = Alignment.Center) {
                                            if (s.loadingMore) {
                                                CircularProgressIndicator()
                                            } else {
                                                OutlinedButton(onClick = { viewModel.loadMore() }) { Text("Daha fazla") }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AlertCard(alert: AlertDto, onAck: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SeverityBadge(alert.severity)
                Spacer(Modifier.height(0.dp))
                Text(
                    "  ${metricLabel(alert.metric)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(6.dp))
            val name = alert.elder?.user?.let { "${it.firstName} ${it.lastName}" } ?: "Yaşlı"
            Text(
                "$name • ${kindLabel(alert.kind)}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Ölçülen: ${alert.observedValue.toInt()} (medyan ${alert.medianValue.toInt()}, z=${String.format("%.1f", alert.modifiedZScore)})",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                alert.detectedAt.take(19).replace("T", " "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            if (alert.acknowledged) {
                Text("✓ Onaylandı", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            } else {
                Button(onClick = onAck) { Text("Onayla") }
            }
        }
    }
}

@Composable
private fun SeverityBadge(severity: String) {
    val c = EcTheme.colors
    val (label, fg, bg) = when (severity) {
        "CRITICAL" -> Triple("KRİTİK", c.critical, c.criticalSoft)
        "HIGH" -> Triple("YÜKSEK", c.warnDeep, c.warnSoft)
        "MEDIUM" -> Triple("ORTA", c.accentDeep, c.accentSoft)
        else -> Triple(severity, c.text3, c.chip)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(label, color = fg, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
    }
}

private fun metricLabel(metric: String): String = when (metric) {
    "heart_rate" -> "Nabız"
    "resting_heart_rate" -> "Dinlenme Nabzı"
    "steps" -> "Adım"
    "sleep_duration" -> "Uyku"
    else -> metric
}

private fun kindLabel(kind: String): String = when (kind) {
    "THRESHOLD_BREACH" -> "Eşik aşımı"
    "PERSISTENCE" -> "Süreklilik"
    "MULTI_METRIC" -> "Çoklu metrik"
    else -> kind
}
