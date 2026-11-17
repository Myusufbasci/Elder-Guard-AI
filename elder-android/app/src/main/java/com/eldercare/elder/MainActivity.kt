package com.eldercare.elder

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.health.connect.client.PermissionController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.eldercare.elder.data.HealthConnectManager
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.sync.HealthSyncService
import com.eldercare.elder.data.UserRole
import com.eldercare.elder.network.ElderSummaryDto
import com.eldercare.elder.ui.auth.LoginScreen
import com.eldercare.elder.ui.auth.RegisterScreen
import com.eldercare.elder.ui.auth.RoleSelectScreen
import com.eldercare.elder.ui.caregiver.AddElderScreen
import com.eldercare.elder.ui.caregiver.AlertsScreen
import com.eldercare.elder.ui.caregiver.ElderDetailScreen
import com.eldercare.elder.ui.caregiver.EldersScreen
import com.eldercare.elder.ui.caregiver.SettingsScreen
import com.eldercare.elder.ui.caregiver.VitalsChartsScreen
import com.eldercare.elder.ui.pairing.ElderHomeViewModel
import com.eldercare.elder.ui.pairing.PairingScreen
import androidx.hilt.navigation.compose.hiltViewModel
import com.eldercare.elder.ui.theme.EldercareTheme
import com.eldercare.elder.ui.theme.LocalThemeController
import com.eldercare.elder.ui.theme.ThemeController
import com.eldercare.elder.ui.theme.ThemeMode
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay
import javax.inject.Inject

private object Routes {
    const val ROLE_SELECT = "role_select"
    const val CAREGIVER_LOGIN = "caregiver_login"
    const val CAREGIVER_REGISTER = "caregiver_register"
    const val CAREGIVER_HOME = "caregiver_home"
    const val CAREGIVER_ADD_ELDER = "caregiver_add_elder"
    const val CAREGIVER_ELDER_DETAIL = "caregiver_elder_detail/{elderId}/{elderName}"
    const val CAREGIVER_VITALS = "caregiver_vitals/{elderId}/{elderName}"
    const val ELDER_PAIRING = "elder_pairing"
    const val ELDER_PAIRED = "elder_paired"

    fun elderDetail(id: String, name: String) =
        "caregiver_elder_detail/$id/${Uri.encode(name)}"

    fun vitals(id: String, name: String) =
        "caregiver_vitals/$id/${Uri.encode(name)}"
}

enum class CaregiverTab { ELDERS, ALERTS, SETTINGS }

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStore: TokenStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val themeController = remember { ThemeController(applicationContext) }
            val darkTheme = when (themeController.mode) {
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
            }
            CompositionLocalProvider(LocalThemeController provides themeController) {
                EldercareTheme(darkTheme = darkTheme) {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        AppNav(tokenStore = tokenStore)
                    }
                }
            }
        }
    }
}

@Composable
private fun AppNav(tokenStore: TokenStore) {
    val nav = rememberNavController()
    val session by tokenStore.session.collectAsState()
    var caregiverTab by rememberSaveable { mutableStateOf(CaregiverTab.ELDERS) }

    val startRoute = when (session?.role) {
        UserRole.CAREGIVER -> Routes.CAREGIVER_HOME
        UserRole.ELDER -> Routes.ELDER_PAIRED
        null -> Routes.ROLE_SELECT
    }

    // React to session changes (login/logout) and steer the back stack accordingly.
    LaunchedEffect(session?.role) {
        val target = when (session?.role) {
            UserRole.CAREGIVER -> Routes.CAREGIVER_HOME
            UserRole.ELDER -> Routes.ELDER_PAIRED
            null -> Routes.ROLE_SELECT
        }
        val current = nav.currentBackStackEntry?.destination?.route
        val rootForCurrent = when (current) {
            Routes.CAREGIVER_HOME, Routes.CAREGIVER_ADD_ELDER,
            Routes.CAREGIVER_ELDER_DETAIL, Routes.CAREGIVER_VITALS -> UserRole.CAREGIVER
            Routes.ELDER_PAIRED -> UserRole.ELDER
            else -> null
        }
        if (rootForCurrent != session?.role) {
            nav.navigate(target) {
                popUpTo(nav.graph.startDestinationId) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    NavHost(navController = nav, startDestination = startRoute) {
        composable(Routes.ROLE_SELECT) {
            RoleSelectScreen(
                onCaregiver = { nav.navigate(Routes.CAREGIVER_LOGIN) },
                onElder = { nav.navigate(Routes.ELDER_PAIRING) },
            )
        }
        composable(Routes.CAREGIVER_LOGIN) {
            LoginScreen(
                onLoggedIn = { /* AppNav LaunchedEffect handles routing */ },
                onRegisterClick = { nav.navigate(Routes.CAREGIVER_REGISTER) },
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.CAREGIVER_REGISTER) {
            RegisterScreen(
                onRegistered = { /* session change re-routes */ },
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.CAREGIVER_HOME) {
            CaregiverShell(
                selectedTab = caregiverTab,
                onTabChange = { caregiverTab = it },
                onAddElder = { nav.navigate(Routes.CAREGIVER_ADD_ELDER) },
                onOpenElder = { elder ->
                    nav.navigate(Routes.elderDetail(elder.id, "${elder.firstName} ${elder.lastName}"))
                },
                onLogout = { tokenStore.clear() },
            )
        }
        composable(Routes.CAREGIVER_ADD_ELDER) {
            AddElderScreen(onClose = { nav.popBackStack() })
        }
        composable(Routes.CAREGIVER_ELDER_DETAIL) { entry ->
            val elderId = entry.arguments?.getString("elderId").orEmpty()
            val elderName = Uri.decode(entry.arguments?.getString("elderName").orEmpty())
            ElderDetailScreen(
                elderId = elderId,
                elderName = elderName,
                onBack = { nav.popBackStack() },
                onVitals = { nav.navigate(Routes.vitals(elderId, elderName)) },
                onAlerts = {
                    caregiverTab = CaregiverTab.ALERTS
                    nav.popBackStack(Routes.CAREGIVER_HOME, inclusive = false)
                },
            )
        }
        composable(Routes.CAREGIVER_VITALS) { entry ->
            val elderId = entry.arguments?.getString("elderId").orEmpty()
            val elderName = Uri.decode(entry.arguments?.getString("elderName").orEmpty())
            VitalsChartsScreen(
                elderId = elderId,
                elderName = elderName,
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.ELDER_PAIRING) {
            PairingScreen(onPaired = { /* session change re-routes */ })
        }
        composable(Routes.ELDER_PAIRED) {
            ElderPairedScreen()
        }
    }
}

@Composable
private fun CaregiverShell(
    selectedTab: CaregiverTab,
    onTabChange: (CaregiverTab) -> Unit,
    onAddElder: () -> Unit,
    onOpenElder: (ElderSummaryDto) -> Unit,
    onLogout: () -> Unit,
) {
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == CaregiverTab.ELDERS,
                    onClick = { onTabChange(CaregiverTab.ELDERS) },
                    icon = { Icon(Icons.Filled.People, contentDescription = null) },
                    label = { Text("Yaşlılar") },
                )
                NavigationBarItem(
                    selected = selectedTab == CaregiverTab.ALERTS,
                    onClick = { onTabChange(CaregiverTab.ALERTS) },
                    icon = { Icon(Icons.Filled.Notifications, contentDescription = null) },
                    label = { Text("Uyarılar") },
                )
                NavigationBarItem(
                    selected = selectedTab == CaregiverTab.SETTINGS,
                    onClick = { onTabChange(CaregiverTab.SETTINGS) },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    label = { Text("Ayarlar") },
                )
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (selectedTab) {
                CaregiverTab.ELDERS -> EldersScreen(
                    onAddElder = onAddElder,
                    onOpenElder = onOpenElder,
                )
                CaregiverTab.ALERTS -> AlertsScreen()
                CaregiverTab.SETTINGS -> SettingsScreen(onLogout = onLogout)
            }
        }
    }
}

@Composable
private fun ElderPairedScreen(
    viewModel: ElderHomeViewModel = hiltViewModel(),
) {
    // Creating the ViewModel starts the session heartbeat (see ElderHomeViewModel).
    val context = LocalContext.current
    val health by viewModel.health.collectAsState()
    var runtimeReady by remember { mutableStateOf(hasRuntimePermissions(context)) }
    var syncMsg by remember { mutableStateOf<String?>(null) }

    // Health Connect read-permission grant flow (heart rate / steps / sleep).
    val healthLauncher = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract(),
    ) { _ ->
        viewModel.recheckHealthAccess()
    }
    // Runtime dangerous permissions (location + activity recognition + body sensors
    // + notifications). The sensor ones are what let the type=health FGS start.
    val runtimeLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { _ ->
        runtimeReady = hasRuntimePermissions(context)
    }

    // Re-check on (re)entry — covers grants the elder made via system settings.
    LaunchedEffect(Unit) {
        viewModel.recheckHealthAccess()
        runtimeReady = hasRuntimePermissions(context)
    }

    val healthInstalled = health.availability == HealthConnectManager.Availability.INSTALLED
    val allReady = healthInstalled && health.granted && runtimeReady

    // Once every permission is in place, (re)start the foreground sync service AND
    // fire an immediate one-off sync so the elder's data lands on the web panel within
    // seconds of pairing — not after the 15-min periodic worker. The earlier defensive
    // start at pairing time stops itself when sensor permission is missing, so this is
    // the point where continuous monitoring actually begins.
    LaunchedEffect(allReady) {
        if (allReady) {
            HealthSyncService.start(context)
            viewModel.syncNow()
        }
    }

    // Location works INDEPENDENTLY of Health Connect: as soon as the location/
    // runtime permission is granted, fire a sync so the elder's position reaches
    // the panel even when health data is unavailable (e.g. Mi Fitness not feeding
    // Health Connect). The periodic 15-min worker keeps it updated thereafter.
    LaunchedEffect(runtimeReady) {
        if (runtimeReady && !allReady) {
            viewModel.syncNow()
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Sistem Bağlı", style = MaterialTheme.typography.headlineMedium)
        Text(
            text = when {
                allReady -> "Sağlık ve konum takibi aktif"
                runtimeReady -> "Konum takibi aktif. Sağlık verisi için Health Connect izni gerekli."
                else -> "Takibi başlatmak için aşağıdaki izinleri verin"
            },
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))

        if (!allReady) {
            PermissionGate(
                healthInstalled = healthInstalled,
                healthGranted = health.granted,
                runtimeReady = runtimeReady,
                onGrantHealth = { healthLauncher.launch(viewModel.healthPermissions) },
                onGrantRuntime = { runtimeLauncher.launch(runtimePermissionArray()) },
            )
            Spacer(Modifier.height(24.dp))
        }

        if (runtimeReady) {
            // Demo control: push the latest data (incl. location) to the panel on
            // demand. Available once location/runtime permission is granted — does
            // not require Health Connect.
            Button(onClick = {
                viewModel.syncNow()
                syncMsg = "Veriler gönderiliyor…"
            }) {
                Text(text = "Verileri şimdi gönder")
            }
            if (syncMsg != null) {
                Spacer(Modifier.height(8.dp))
                Text(text = syncMsg!!, style = MaterialTheme.typography.bodySmall)
                LaunchedEffect(syncMsg) {
                    delay(3000)
                    syncMsg = null
                }
            }
            Spacer(Modifier.height(24.dp))
        }

        // Unpairs server-side (caregiver list/detail update) then clears local tokens.
        OutlinedButton(onClick = { viewModel.unpair() }) {
            Text(text = "Eşleşmeyi sıfırla")
        }
    }
}

@Composable
private fun PermissionGate(
    healthInstalled: Boolean,
    healthGranted: Boolean,
    runtimeReady: Boolean,
    onGrantHealth: () -> Unit,
    onGrantRuntime: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!healthInstalled) {
            Text(
                text = "Health Connect kurulu değil. Saatinizin verisini görebilmemiz " +
                    "için Play Store'dan Health Connect'i kurun ve saat uygulamanızı " +
                    "(Mi Fitness / Zepp) Health Connect'e bağlayın.",
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            PermissionRow(
                label = "Sağlık verisi (nabız, adım, uyku)",
                granted = healthGranted,
                onGrant = onGrantHealth,
            )
        }
        PermissionRow(
            label = "Konum ve hareket algılama",
            granted = runtimeReady,
            onGrant = onGrantRuntime,
        )
    }
}

@Composable
private fun PermissionRow(
    label: String,
    granted: Boolean,
    onGrant: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = (if (granted) "✓  " else "•  ") + label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f).padding(end = 12.dp),
        )
        if (!granted) {
            Button(onClick = onGrant) { Text("İzin ver") }
        }
    }
}

/** Runtime permissions to request for telemetry + location + type=health FGS. */
private fun runtimePermissionArray(): Array<String> = buildList {
    add(Manifest.permission.ACCESS_FINE_LOCATION)
    add(Manifest.permission.ACCESS_COARSE_LOCATION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        add(Manifest.permission.ACTIVITY_RECOGNITION)
    }
    add(Manifest.permission.BODY_SENSORS)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        add(Manifest.permission.POST_NOTIFICATIONS)
    }
}.toTypedArray()

/**
 * "Runtime ready" = location granted (for the location feature) AND activity
 * recognition granted (the sensor permission that lets the type=health foreground
 * service attach on Android 14+). Body sensors / notifications are best-effort.
 */
private fun hasRuntimePermissions(context: Context): Boolean {
    fun granted(p: String) =
        ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED
    val location = granted(Manifest.permission.ACCESS_FINE_LOCATION) ||
        granted(Manifest.permission.ACCESS_COARSE_LOCATION)
    val activity = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        granted(Manifest.permission.ACTIVITY_RECOGNITION)
    return location && activity
}
