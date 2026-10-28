package com.balanca.assistente.network

import android.util.Base64
import com.balanca.assistente.data.OperatorSession
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class RemoteProductDto(
    val id: String,
    val nome: String,
    val codigo: String,
    val preco: String?,
    val categoria: String?,
    val descricao: String?,
    val imagemId: String?,
    val atualizadoEm: String?,
    val unidade: String,
    val disponibilidade: Boolean
)

sealed class LoginResult {
    data class Success(val session: OperatorSession) : LoginResult()
    data class Error(val message: String) : LoginResult()
}

sealed class SyncCatalogResult {
    data class Success(val products: List<RemoteProductDto>, val total: Int) : SyncCatalogResult()
    data class SessionExpired(val message: String) : SyncCatalogResult()
    data class Error(val message: String) : SyncCatalogResult()
}

object SheetsAuthSyncService {

    /**
     * Realiza login por Matrícula e Senha Individual contra o Google Apps Script
     */
    fun login(endpointUrl: String, matricula: String, senha: String): LoginResult {
        return try {
            val postData = "action=login" +
                    "&matricula=" + URLEncoder.encode(matricula.trim(), "UTF-8") +
                    "&senha=" + URLEncoder.encode(senha, "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val token = json.getString("token")
                val expiresAt = json.optLong("expiresAt", System.currentTimeMillis() + 30L * 24 * 3600 * 1000)
                val opJson = json.optJSONObject("operador")
                val opNome = opJson?.optString("nome", "Operador") ?: "Operador"
                val opMat = opJson?.optString("matricula", matricula.trim()) ?: matricula.trim()

                LoginResult.Success(
                    OperatorSession(
                        token = token,
                        matricula = opMat,
                        nome = opNome,
                        expiresAt = expiresAt
                    )
                )
            } else {
                val erro = json.optString("erro", "Matrícula ou senha incorretos.")
                LoginResult.Error(erro)
            }
        } catch (e: Exception) {
            LoginResult.Error("Falha de conexão com o servidor: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    /**
     * Encerra a sessão no servidor
     */
    fun logout(endpointUrl: String, token: String) {
        try {
            val postData = "action=logout&token=" + URLEncoder.encode(token, "UTF-8")
            executeHttpRequest(endpointUrl, "POST", postData)
        } catch (e: Exception) {
            // Ignora falhas de rede no logout
        }
    }

    /**
     * Sincroniza a lista de produtos (exige token de sessão válido)
     */
    fun syncCatalog(endpointUrl: String, token: String): SyncCatalogResult {
        return try {
            val postData = "action=sincronizar&token=" + URLEncoder.encode(token, "UTF-8")
            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (!json.optBoolean("sucesso", false)) {
                val isExpired = json.optBoolean("sessaoExpirada", false)
                val erro = json.optString("erro", "Acesso não autorizado.")
                return if (isExpired) {
                    SyncCatalogResult.SessionExpired(erro)
                } else {
                    SyncCatalogResult.Error(erro)
                }
            }

            val array = json.optJSONArray("produtos") ?: return SyncCatalogResult.Success(emptyList(), 0)
            val list = mutableListOf<RemoteProductDto>()

            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val rawCode = obj.optString("codigo", "").trim()
                if (rawCode.isEmpty()) continue

                val id = obj.optString("id", "PROD_$rawCode")
                val nome = obj.optString("nome", "Produto sem nome")
                val preco = if (obj.has("preco") && !obj.isNull("preco")) obj.getString("preco").trim() else null
                val categoria = if (obj.has("categoria") && !obj.isNull("categoria")) obj.getString("categoria").trim() else null
                val descricao = if (obj.has("descricao") && !obj.isNull("descricao")) {
                    obj.getString("descricao").trim().ifBlank { null }
                } else if (obj.has("description") && !obj.isNull("description")) {
                    obj.getString("description").trim().ifBlank { null }
                } else if (obj.has("desc") && !obj.isNull("desc")) {
                    obj.getString("desc").trim().ifBlank { null }
                } else if (obj.has("descrição") && !obj.isNull("descrição")) {
                    obj.getString("descrição").trim().ifBlank { null }
                } else null
                val imagemId = if (obj.has("imagem_id") && !obj.isNull("imagem_id")) obj.getString("imagem_id").trim() else null
                val atualizadoEm = if (obj.has("atualizado_em") && !obj.isNull("atualizado_em")) obj.getString("atualizado_em") else null
                val unidade = obj.optString("unidade", "kg").trim().lowercase()
                val disp = obj.optBoolean("disponibilidade", true)

                list.add(
                    RemoteProductDto(
                        id = id,
                        nome = nome,
                        codigo = rawCode, // ZEROS À ESQUERDA PRESERVADOS RIGOROSAMENTE
                        preco = preco?.ifBlank { null },
                        categoria = categoria?.ifBlank { null },
                        descricao = descricao,
                        imagemId = imagemId?.ifBlank { null },
                        atualizadoEm = atualizadoEm,
                        unidade = unidade.ifBlank { "kg" },
                        disponibilidade = disp
                    )
                )
            }

            SyncCatalogResult.Success(list, list.size)
        } catch (e: Exception) {
            SyncCatalogResult.Error("Erro na sincronização: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    /**
     * Baixa a imagem privada do Google Drive via token do Apps Script e salva localmente
     */
    fun downloadDriveImage(endpointUrl: String, token: String, driveImageId: String, destFile: File): Boolean {
        if (destFile.exists() && destFile.length() > 0) {
            return true // Já baixada e persistida localmente!
        }

        return try {
            val postData = "action=imagem" +
                    "&token=" + URLEncoder.encode(token, "UTF-8") +
                    "&id=" + URLEncoder.encode(driveImageId, "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false) && json.has("base64")) {
                val base64Str = json.getString("base64")
                val imageBytes = Base64.decode(base64Str, Base64.DEFAULT)

                destFile.parentFile?.let {
                    if (!it.exists()) it.mkdirs()
                }

                FileOutputStream(destFile).use { out ->
                    out.write(imageBytes)
                }
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun sanitizeUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        val qIdx = trimmed.indexOf('?')
        if (qIdx == -1) return trimmed
        val base = trimmed.substring(0, qIdx)
        val query = trimmed.substring(qIdx + 1)
        val filtered = query.split("&").filterNot {
            val key = it.substringBefore("=").lowercase().trim()
            key == "token" || key == "senha" || key == "matricula"
        }.joinToString("&")
        return if (filtered.isEmpty()) base else "$base?$filtered"
    }

    /**
     * Utilitário HTTP nativo com suporte obrigatório a redirecionamentos 302 do Google Apps Script
     */
    private fun executeHttpRequest(urlStr: String, method: String, postData: String?): String {
        var currentUrl = sanitizeUrl(urlStr)
        var currentMethod = method
        var currentData = postData
        var redirects = 0
        val maxRedirects = 6

        while (redirects < maxRedirects) {
            val url = URL(currentUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 20000
            conn.instanceFollowRedirects = false // Controlamos o redirect para suportar HTTPS->HTTPS e POST->GET do Apps Script

            if (currentMethod == "POST" && currentData != null) {
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                OutputStreamWriter(conn.outputStream, "UTF-8").use { writer ->
                    writer.write(currentData)
                    writer.flush()
                }
            } else {
                conn.requestMethod = "GET"
            }

            val code = conn.responseCode

            // Google Apps Script retorna 302 para script.googleusercontent.com
            if (code == HttpURLConnection.HTTP_MOVED_TEMP ||
                code == HttpURLConnection.HTTP_MOVED_PERM ||
                code == HttpURLConnection.HTTP_SEE_OTHER ||
                code == 307
            ) {
                val newUrl = conn.getHeaderField("Location") ?: throw Exception("Redirecionamento sem Location")
                conn.disconnect()
                currentUrl = newUrl
                currentMethod = "GET" // Ao seguir o 302 do Apps Script, a leitura do resultado é feita via GET
                currentData = null
                redirects++
                continue
            }

            if (code in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8"))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                conn.disconnect()
                return sb.toString()
            } else {
                val errorStream = conn.errorStream
                val errorMsg = if (errorStream != null) {
                    val reader = BufferedReader(InputStreamReader(errorStream, "UTF-8"))
                    reader.readText()
                } else {
                    "HTTP $code"
                }
                conn.disconnect()
                throw Exception("Servidor respondeu com código $code: $errorMsg")
            }
        }

        throw Exception("Limite de redirecionamentos atingido.")
    }
}
