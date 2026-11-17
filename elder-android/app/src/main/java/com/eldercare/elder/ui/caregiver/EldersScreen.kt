package com.eldercare.elder.ui.caregiver

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.eldercare.elder.network.ElderSummaryDto
import com.eldercare.elder.ui.theme.EcTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EldersScreen(
    onAddElder: () -> Unit,
    onOpenElder: (ElderSummaryDto) -> Unit,
    viewModel: EldersViewModel = hiltViewModel(),
) {
    val state by viewModel.list.collectAsState()
    val verify by viewModel.verify.collectAsState()
    var elderToDelete by remember { mutableStateOf<ElderSummaryDto?>(null) }

    // Refresh whenever the list re-enters composition (initial show, return from
    // Add-Elder, tab switch) — the ViewModel survives but data may be stale.
    LaunchedEffect(Unit) {
        viewModel.refresh()
        viewModel.loadVerificationStatus()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Yaşlılarım") },
                actions = {
                    TextButton(onClick = { viewModel.refresh() }) { Text("Yenile") }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onAddElder,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Yaşlı ekle")
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (verify.show) {
                VerifyEmailBanner(
                    state = verify,
                    onResend = { viewModel.resendVerification() },
                    onDismiss = { viewModel.dismissVerifyBanner() },
                )
            }
            Box(modifier = Modifier.fillMaxSize()) {
            when (val s = state) {
                is ElderListState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is ElderListState.Error -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(text = s.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { viewModel.refresh() }) { Text("Tekrar dene") }
                    }
                }
                is ElderListState.Success -> {
                    if (s.elders.isEmpty()) {
                        Column(
                            modifier = Modifier.align(Alignment.Center).padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = "Henüz yaşlı eklenmemiş.",
                                style = MaterialTheme.typography.bodyLarge,
                            )
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = onAddElder) { Text("İlk yaşlıyı ekle") }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize().padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(s.elders, key = { it.id }) { elder ->
                                ElderCard(
                                    elder = elder,
                                    onOpen = { onOpenElder(elder) },
                                    onDelete = { elderToDelete = elder },
                                )
                            }
                        }
                    }
                }
            }
            }
        }
    }

    elderToDelete?.let { elder ->
        AlertDialog(
            onDismissRequest = { elderToDelete = null },
            title = { Text("Yaşlıyı sil") },
            text = {
                Text("${elder.firstName} ${elder.lastName} silinecek. Bu işlem geri alınamaz.")
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteElder(elder.id)
                    elderToDelete = null
                }) {
                    Text("Sil", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { elderToDelete = null }) { Text("İptal") }
            },
        )
    }
}

@Composable
private fun ElderCard(
    elder: ElderSummaryDto,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, EcTheme.colors.border),
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val initials = buildString {
                elder.firstName.firstOrNull()?.let { append(it) }
                elder.lastName.firstOrNull()?.let { append(it) }
            }.uppercase().ifBlank { "?" }
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(EcTheme.colors.avatarBg),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = initials,
                    color = EcTheme.colors.accentDeep,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${elder.firstName} ${elder.lastName}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "Doğum: ${elder.dateOfBirth.take(10)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = onDelete) {
                Text("Sil", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

// Soft reminder shown on the caregiver home until their email is verified.
@Composable
private fun VerifyEmailBanner(
    state: VerifyState,
    onResend: () -> Unit,
    onDismiss: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "E-postanı doğrula",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
            Text(
                text = state.email?.let { "$it adresine gönderilen bağlantıyı kontrol et." }
                    ?: "Gelen kutunu kontrol et.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
        }
        Spacer(Modifier.width(8.dp))
        when (state.resend) {
            ResendStatus.Sent -> Text(
                text = "Gönderildi ✓",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
            ResendStatus.Cooldown -> Text(
                text = "Az önce gönderildi",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
            else -> TextButton(
                onClick = onResend,
                enabled = state.resend != ResendStatus.Sending,
            ) {
                Text(
                    if (state.resend == ResendStatus.Sending) "Gönderiliyor…"
                    else if (state.resend == ResendStatus.Error) "Tekrar dene"
                    else "Tekrar gönder",
                )
            }
        }
        TextButton(onClick = onDismiss) { Text("×") }
    }
}
