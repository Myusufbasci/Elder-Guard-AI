package com.eldercare.elder.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun RegisterScreen(
    onRegistered: () -> Unit,
    onBack: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordConfirm by remember { mutableStateOf("") }

    LaunchedEffect(state) {
        if (state is AuthUiState.Success) {
            onRegistered()
            viewModel.reset()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Bakıcı Kaydı", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = firstName,
            onValueChange = { firstName = it },
            label = { Text("Ad") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = state !is AuthUiState.Loading,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = lastName,
            onValueChange = { lastName = it },
            label = { Text("Soyad") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = state !is AuthUiState.Loading,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
            enabled = state !is AuthUiState.Loading,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = "Kayıt sonrası bu adrese bir doğrulama bağlantısı göndereceğiz.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Şifre (en az 8 karakter)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            enabled = state !is AuthUiState.Loading,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = passwordConfirm,
            onValueChange = { passwordConfirm = it },
            label = { Text("Şifre (tekrar)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            visualTransformation = PasswordVisualTransformation(),
            isError = passwordConfirm.isNotEmpty() && passwordConfirm != password,
            modifier = Modifier.fillMaxWidth(),
            enabled = state !is AuthUiState.Loading,
        )
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                if (password != passwordConfirm) {
                    viewModel.reset()
                    return@Button
                }
                viewModel.register(email, password, firstName, lastName)
            },
            enabled = state !is AuthUiState.Loading
                && password.isNotEmpty()
                && password == passwordConfirm,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state is AuthUiState.Loading) "Kayıt yapılıyor…" else "Kayıt ol")
        }
        Spacer(Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(Modifier.height(16.dp))
        OutlinedButton(
            onClick = { viewModel.signInWithGoogle(context) },
            enabled = state !is AuthUiState.Loading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Google ile devam et")
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onBack) {
            Text("Geri")
        }
        when (val s = state) {
            is AuthUiState.Error -> {
                Spacer(Modifier.height(12.dp))
                Text(text = s.message, color = MaterialTheme.colorScheme.error)
            }
            else -> Unit
        }
    }
}
