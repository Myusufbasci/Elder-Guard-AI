package com.eldercare.elder

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.ui.pairing.PairingScreen
import com.eldercare.elder.ui.theme.EldercareTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStore: TokenStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            EldercareTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var paired by remember { mutableStateOf(tokenStore.hasTokens()) }
                    if (paired) {
                        PairedStatus()
                    } else {
                        PairingScreen(onPaired = {
                            paired = true
                            finish()
                        })
                    }
                }
            }
        }
    }
}

@Composable
private fun PairedStatus() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "System Connected", style = MaterialTheme.typography.headlineMedium)
        Text(text = "Health monitoring is active", style = MaterialTheme.typography.bodyMedium)
    }
}
