package com.eldercare.elder.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.eldercare.elder.BuildConfig
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/**
 * Wraps the Credential Manager API for "Sign in with Google" on Android.
 * Returns a Google ID token (JWT) that the backend `/v1/auth/google` verifies.
 *
 * Configuration: requires `GOOGLE_WEB_CLIENT_ID` Gradle property (or env var). This is
 * the OAuth *Web* client ID — same one configured on the backend (GOOGLE_CLIENT_ID)
 * and on caregiver-web (Firebase). NOT the Android client ID.
 *
 * Setup checklist:
 * 1. Google Cloud Console → APIs & Services → Credentials → create OAuth client of
 *    type "Web application" (or reuse the one used by caregiver-web).
 * 2. Same console: create an OAuth client of type "Android" with this app's package
 *    name (debug: com.eldercare.elder.debug; release: com.eldercare.elder) and SHA-1
 *    fingerprint of the signing key.
 * 3. Pass the *Web* client ID at build time:
 *      ./gradlew :app:assembleDebug -PGOOGLE_WEB_CLIENT_ID=<...apps.googleusercontent.com>
 *    or in `~/.gradle/gradle.properties` / `local.properties`:
 *      GOOGLE_WEB_CLIENT_ID=<...apps.googleusercontent.com>
 */
sealed interface GoogleSignInResult {
    data class Success(val idToken: String) : GoogleSignInResult
    data object Cancelled : GoogleSignInResult
    data object NoAccount : GoogleSignInResult
    data class Error(val message: String) : GoogleSignInResult
}

class GoogleSignInHelper(private val context: Context) {

    suspend fun signIn(): GoogleSignInResult {
        val webClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
        if (webClientId.isBlank()) {
            return GoogleSignInResult.Error(
                "Google sign-in yapılandırılmamış (GOOGLE_WEB_CLIENT_ID eksik).",
            )
        }

        val credentialManager = CredentialManager.create(context)
        // Pass false on first attempt so a brand-new account can be picked. Falling
        // back to authorized-only would skip the Google account chooser entirely.
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(webClientId)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        return try {
            val response = credentialManager.getCredential(context, request)
            val cred = response.credential
            if (cred is CustomCredential &&
                cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                val idTokenCred = GoogleIdTokenCredential.createFrom(cred.data)
                GoogleSignInResult.Success(idTokenCred.idToken)
            } else {
                GoogleSignInResult.Error("Beklenmeyen kimlik türü.")
            }
        } catch (e: GetCredentialCancellationException) {
            GoogleSignInResult.Cancelled
        } catch (e: NoCredentialException) {
            GoogleSignInResult.NoAccount
        } catch (e: GoogleIdTokenParsingException) {
            GoogleSignInResult.Error("Google ID token okunamadı: ${e.message}")
        } catch (e: GetCredentialException) {
            GoogleSignInResult.Error(e.message ?: "Kimlik alınamadı.")
        }
    }
}
