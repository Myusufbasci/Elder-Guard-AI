package com.eldercare.elder.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

private val Context.changesTokenDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "health_connect_changes_tokens"
)

/**
 * Per-record-type changes token storage. Health Connect tokens are bound to the
 * specific RecordType set requested when minted, so we keep one token per record type.
 *
 * Why DataStore (not EncryptedSharedPreferences): tokens are not credentials and the
 * app needs async, transactional reads from coroutines.
 */
@Singleton
class SyncTokenStore @Inject constructor(context: Context) {

    private val ds = context.changesTokenDataStore

    suspend fun getToken(recordType: String): String? {
        val key = stringPreferencesKey(recordType)
        return ds.data.firstOrNull()?.get(key)
    }

    suspend fun setToken(recordType: String, token: String) {
        val key = stringPreferencesKey(recordType)
        ds.edit { it[key] = token }
    }

    suspend fun clearToken(recordType: String) {
        val key = stringPreferencesKey(recordType)
        ds.edit { it.remove(key) }
    }
}
