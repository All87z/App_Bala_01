package com.balanca.assistente.data

import android.content.Context
import android.content.SharedPreferences

data class OperatorSession(
    val token: String,
    val matricula: String,
    val nome: String,
    val expiresAt: Long
)

class SessionManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "balanca_session_prefs"
        private const val KEY_ENDPOINT_URL = "sheets_endpoint_url"
        private const val KEY_TOKEN = "session_token"
        private const val KEY_MATRICULA = "session_matricula"
        private const val KEY_NOME = "session_nome"
        private const val KEY_EXPIRES_AT = "session_expires_at"
        private const val KEY_LAST_SYNC_TIME = "session_last_sync_time"

        const val DEFAULT_ENDPOINT_URL =
            "https://script.google.com/macros/s/AKfycbyfaojZh81dEvfsWQcmqBM28yxPq3X3tk92IDPhCINHb7E0iayjNZxNagWwyzs4ttry/exec"
    }

    fun getEndpointUrl(): String {
        return prefs.getString(KEY_ENDPOINT_URL, DEFAULT_ENDPOINT_URL) ?: DEFAULT_ENDPOINT_URL
    }

    fun setEndpointUrl(url: String) {
        prefs.edit().putString(KEY_ENDPOINT_URL, url.trim()).apply()
    }

    fun saveSession(token: String, matricula: String, nome: String, expiresAt: Long) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_MATRICULA, matricula)
            .putString(KEY_NOME, nome)
            .putLong(KEY_EXPIRES_AT, expiresAt)
            .apply()
    }

    fun getSession(): OperatorSession? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val matricula = prefs.getString(KEY_MATRICULA, "") ?: ""
        val nome = prefs.getString(KEY_NOME, "Operador") ?: "Operador"
        val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L)

        // Se a sessão expirou localmente, limpa
        if (expiresAt > 0 && System.currentTimeMillis() > expiresAt) {
            clearSession()
            return null
        }

        return OperatorSession(token, matricula, nome, expiresAt)
    }

    fun isLoggedIn(): Boolean {
        return getSession() != null
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_MATRICULA)
            .remove(KEY_NOME)
            .remove(KEY_EXPIRES_AT)
            .apply()
    }

    fun setLastSyncTime(timestamp: Long) {
        prefs.edit().putLong(KEY_LAST_SYNC_TIME, timestamp).apply()
    }

    fun getLastSyncTime(): Long {
        return prefs.getLong(KEY_LAST_SYNC_TIME, 0L)
    }
}
