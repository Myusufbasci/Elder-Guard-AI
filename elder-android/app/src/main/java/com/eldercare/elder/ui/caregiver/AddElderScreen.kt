package com.eldercare.elder.ui.caregiver

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.OffsetDateTime
import kotlin.math.max

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddElderScreen(
    onClose: () -> Unit,
    viewModel: EldersViewModel = hiltViewModel(),
) {
    val state by viewModel.create.collectAsState()
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var dateOfBirth by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Yeni yaşlı ekle") },
                navigationIcon = {
                    IconButton(onClick = onClose) { Text("←") }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when (val s = state) {
                is CreateElderState.Success -> {
                    PairingCodeView(
                        code = s.response.code,
                        expiresAt = s.response.expiresAt,
                        onDone = {
                            viewModel.resetCreate()
                            onClose()
                        },
                    )
                }
                else -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(24.dp),
                    ) {
                        OutlinedTextField(
                            value = firstName,
                            onValueChange = { firstName = it },
                            label = { Text("Ad") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = state !is CreateElderState.Loading,
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = lastName,
                            onValueChange = { lastName = it },
                            label = { Text("Soyad") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = state !is CreateElderState.Loading,
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = dateOfBirth,
                            onValueChange = { dateOfBirth = it },
                            label = { Text("Doğum tarihi (yyyy-MM-dd)") },
                            placeholder = { Text("1950-01-15") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = state !is CreateElderState.Loading,
                        )
                        Spacer(Modifier.height(20.dp))
                        Button(
                            onClick = {
                                viewModel.createElder(firstName, lastName, dateOfBirth)
                            },
                            enabled = state !is CreateElderState.Loading,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                if (state is CreateElderState.Loading) "Kaydediliyor…"
                                else "Ekle ve eşleşme kodu oluştur"
                            )
                        }
                        if (state is CreateElderState.Error) {
                            Spacer(Modifier.height(12.dp))
                            Text(
                                text = (state as CreateElderState.Error).message,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PairingCodeView(
    code: String,
    expiresAt: String,
    onDone: () -> Unit,
) {
    val expiresAtMs = remember(expiresAt) {
        runCatching { OffsetDateTime.parse(expiresAt).toInstant().toEpochMilli() }
            .getOrDefault(System.currentTimeMillis() + 15 * 60 * 1000L)
    }
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(expiresAtMs) {
        while (nowMs < expiresAtMs) {
            delay(1000)
            nowMs = System.currentTimeMillis()
        }
    }
    val remainingSec = max(0L, (expiresAtMs - nowMs) / 1000)
    val mm = remainingSec / 60
    val ss = remainingSec % 60

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Eşleşme kodu",
            style = MaterialTheme.typography.headlineMedium,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Bu kodu yaşlının cihazına gir",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(32.dp))
        Card {
            Text(
                text = code,
                modifier = Modifier.padding(horizontal = 32.dp, vertical = 24.dp),
                style = MaterialTheme.typography.displayLarge.copy(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 56.sp,
                    letterSpacing = 8.sp,
                ),
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(24.dp))
        Text(
            text = if (remainingSec > 0) "Geçerlilik: %02d:%02d".format(mm, ss) else "Süresi doldu",
            style = MaterialTheme.typography.titleMedium,
            color = if (remainingSec > 0) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.error,
        )
        Spacer(Modifier.height(48.dp))
        Button(
            onClick = onDone,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Tamam")
        }
    }
}
