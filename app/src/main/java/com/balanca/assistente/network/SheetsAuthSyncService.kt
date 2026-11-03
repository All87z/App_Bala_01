package com.balanca.assistente.network

import android.util.Base64
import com.balanca.assistente.data.AdminSession
import com.balanca.assistente.data.OperatorRecord
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

// Modelos de Resultado para a Área do Administrador
sealed class AdminLoginResult {
    data class Success(val session: AdminSession) : AdminLoginResult()
    data class Error(val message: String) : AdminLoginResult()
}

sealed class AdminOperatorsResult {
    data class Success(
        val operators: List<OperatorRecord>,
        val total: Int,
        val maxLimit: Int
    ) : AdminOperatorsResult()
    data class SessionExpired(val message: String) : AdminOperatorsResult()
    data class Error(val message: String) : AdminOperatorsResult()
}

sealed class AdminOperationResult {
    data class Success(val message: String) : AdminOperationResult()
    data class SessionExpired(val message: String) : AdminOperationResult()
    data class Error(val message: String) : AdminOperationResult()
}

object SheetsAuthSyncService {

    // =========================================================================
    // ROTAS DO OPERADOR DA BALANÇA
    // =========================================================================

    /**
     * Realiza login por Matrícula e Senha Individual contra o Google Apps Script.
     * Envia também a identificação do aparelho.
     */
    fun login(
        endpointUrl: String,
        matricula: String,
        senha: String,
        aparelho: String
    ): LoginResult {
        return try {
            val aparelhoIdentificado = aparelho.trim().ifBlank {
                "Android não identificado"
            }

            val postData = "action=login" +
                    "&matricula=" + URLEncoder.encode(matricula.trim(), "UTF-8") +
                    "&senha=" + URLEncoder.encode(senha, "UTF-8") +
                    "&aparelho=" + URLEncoder.encode(aparelhoIdentificado, "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val token = json.getString("token")
                val expiresAt = json.optLong(
                    "expiresAt",
                    System.currentTimeMillis() + 30L * 24 * 3600 * 1000
                )

                val opJson = json.optJSONObject("operador")
                val opNome = opJson?.optString("nome", "Operador") ?: "Operador"
                val opMat = opJson?.optString("matricula", matricula.trim())
                    ?: matricula.trim()

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
            LoginResult.Error(
                "Falha de conexão com o servidor: ${e.localizedMessage ?: "Verifique a internet"}"
            )
        }
    }

    /**
     * Encerra a sessão do operador no servidor.
     */
    fun logout(endpointUrl: String, token: String) {
        try {
            val postData = "action=logout&token=" + URLEncoder.encode(token, "UTF-8")
            executeHttpRequest(endpointUrl, "POST", postData)
        } catch (e: Exception) {
            // Ignora falhas de rede no logout.
        }
    }

    /**
     * Sincroniza a lista de produtos (exige token de sessão de operador válido).
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

            val array = json.optJSONArray("produtos")
                ?: return SyncCatalogResult.Success(emptyList(), 0)

            val list = mutableListOf<RemoteProductDto>()

            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val rawCode = obj.optString("codigo", "").trim()
                if (rawCode.isEmpty()) continue

                val id = obj.optString("id", "PROD_$rawCode")
                val nome = obj.optString("nome", "Produto sem nome")
                val preco = if (obj.has("preco") && !obj.isNull("preco")) {
                    obj.getString("preco").trim()
                } else null

                val categoria = if (obj.has("categoria") && !obj.isNull("categoria")) {
                    obj.getString("categoria").trim()
                } else null

                val descricao = if (obj.has("descricao") && !obj.isNull("descricao")) {
                    obj.getString("descricao").trim().ifBlank { null }
                } else if (obj.has("description") && !obj.isNull("description")) {
                    obj.getString("description").trim().ifBlank { null }
                } else if (obj.has("desc") && !obj.isNull("desc")) {
                    obj.getString("desc").trim().ifBlank { null }
                } else if (obj.has("descrição") && !obj.isNull("descrição")) {
                    obj.getString("descrição").trim().ifBlank { null }
                } else null

                val imagemId = if (obj.has("imagem_id") && !obj.isNull("imagem_id")) {
                    obj.getString("imagem_id").trim()
                } else null

                val atualizadoEm = if (obj.has("atualizado_em") && !obj.isNull("atualizado_em")) {
                    obj.getString("atualizado_em")
                } else null

                val unidade = obj.optString("unidade", "kg").trim().lowercase()
                val disp = obj.optBoolean("disponibilidade", true)

                list.add(
                    RemoteProductDto(
                        id = id,
                        nome = nome,
                        codigo = rawCode,
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
            SyncCatalogResult.Error(
                "Erro na sincronização: ${e.localizedMessage ?: "Verifique a internet"}"
            )
        }
    }

    /**
     * Baixa a imagem privada do Google Drive via token do Apps Script e salva localmente.
     */
    fun downloadDriveImage(
        endpointUrl: String,
        token: String,
        driveImageId: String,
        destFile: File
    ): Boolean {
        if (destFile.exists() && destFile.length() > 0) {
            return true
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

    // =========================================================================
    // ROTAS EXCLUSIVAS DA ÁREA DO ADMINISTRADOR
    // =========================================================================

    /**
     * Autentica o administrador com matrícula e senha administrativa exclusiva (action=admin_login).
     */
    fun loginAdmin(
        endpointUrl: String,
        matricula: String,
        senha: String,
        aparelho: String
    ): AdminLoginResult {
        return try {
            val aparelhoIdentificado = aparelho.trim().ifBlank {
                "Android não identificado"
            }
            val postData = "action=admin_login" +
                    "&matricula=" + URLEncoder.encode(matricula.trim(), "UTF-8") +
                    "&senha=" + URLEncoder.encode(senha, "UTF-8") +
                    "&aparelho=" + URLEncoder.encode(aparelhoIdentificado, "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val adminToken = json.getString("adminToken")
                val expiresAt = json.optLong(
                    "expiresAt",
                    System.currentTimeMillis() + 8L * 3600 * 1000
                )
                val mat = json.optString("matricula", matricula.trim().uppercase())
                    .ifBlank { matricula.trim().uppercase() }

                AdminLoginResult.Success(
                    AdminSession(
                        token = adminToken,
                        matricula = mat,
                        expiresAt = expiresAt
                    )
                )
            } else {
                val erro = json.optString("erro", "Credenciais administrativas inválidas.")
                AdminLoginResult.Error(erro)
            }
        } catch (e: Exception) {
            AdminLoginResult.Error(
                "Falha de conexão com o servidor: ${e.localizedMessage ?: "Verifique a internet"}"
            )
        }
    }

    /**
     * Encerra a sessão do administrador no servidor (action=admin_logout).
     */
    fun logoutAdmin(endpointUrl: String, adminToken: String) {
        try {
            val postData = "action=admin_logout&adminToken=" + URLEncoder.encode(adminToken, "UTF-8")
            executeHttpRequest(endpointUrl, "POST", postData)
        } catch (e: Exception) {
            // Ignora falhas de rede no logout
        }
    }

    /**
     * Lista até 10 operadores cadastrados na aba Operadores (action=admin_listar_operadores).
     */
    fun listOperatorsAdmin(endpointUrl: String, adminToken: String): AdminOperatorsResult {
        return try {
            val postData = "action=admin_listar_operadores&adminToken=" + URLEncoder.encode(adminToken, "UTF-8")
            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val array = json.optJSONArray("operadores")
                val list = mutableListOf<OperatorRecord>()
                if (array != null) {
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val mat = obj.optString("matricula", "").trim()
                        if (mat.isEmpty()) continue
                        val nome = obj.optString("nome", "Operador").trim()
                        val status = obj.optString("status", "ATIVO").trim()
                        val criadoEm = if (obj.has("criadoEm") && !obj.isNull("criadoEm")) {
                            obj.getString("criadoEm")
                        } else null
                        list.add(OperatorRecord(mat, nome, status, criadoEm))
                    }
                }
                val total = json.optInt("total", list.size)
                val limiteMaximo = json.optInt("limiteMaximo", 10)
                AdminOperatorsResult.Success(list, total, limiteMaximo)
            } else {
                val isExpired = json.optBoolean("sessaoExpirada", false)
                val erro = json.optString("erro", "Falha ao listar operadores.")
                if (isExpired) {
                    AdminOperatorsResult.SessionExpired(erro)
                } else {
                    AdminOperatorsResult.Error(erro)
                }
            }
        } catch (e: Exception) {
            AdminOperatorsResult.Error("Erro na conexão: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    /**
     * Cadastra antecipadamente um novo operador na aba Operadores (action=admin_cadastrar_operador).
     */
    fun registerOperatorAdmin(
        endpointUrl: String,
        adminToken: String,
        matricula: String,
        nome: String,
        senha: String
    ): AdminOperationResult {
        return try {
            val postData = "action=admin_cadastrar_operador" +
                    "&adminToken=" + URLEncoder.encode(adminToken, "UTF-8") +
                    "&matricula=" + URLEncoder.encode(matricula.trim(), "UTF-8") +
                    "&nome=" + URLEncoder.encode(nome.trim(), "UTF-8") +
                    "&senha=" + URLEncoder.encode(senha, "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val msg = json.optString("mensagem", "Operador cadastrado com sucesso!")
                AdminOperationResult.Success(msg)
            } else {
                val isExpired = json.optBoolean("sessaoExpirada", false)
                val erro = json.optString("erro", "Falha ao cadastrar operador.")
                if (isExpired) AdminOperationResult.SessionExpired(erro) else AdminOperationResult.Error(erro)
            }
        } catch (e: Exception) {
            AdminOperationResult.Error("Erro na requisição: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    /**
     * Edita nome, senha ou status de um operador (action=admin_editar_operador).
     */
    fun updateOperatorAdmin(
        endpointUrl: String,
        adminToken: String,
        matricula: String,
        novoNome: String?,
        novaSenha: String?,
        status: String?
    ): AdminOperationResult {
        return try {
            var postData = "action=admin_editar_operador" +
                    "&adminToken=" + URLEncoder.encode(adminToken, "UTF-8") +
                    "&matricula=" + URLEncoder.encode(matricula.trim(), "UTF-8")

            if (!novoNome.isNullOrBlank()) {
                postData += "&novoNome=" + URLEncoder.encode(novoNome.trim(), "UTF-8")
            }
            if (!novaSenha.isNullOrBlank()) {
                postData += "&novaSenha=" + URLEncoder.encode(novaSenha, "UTF-8")
            }
            if (!status.isNullOrBlank()) {
                postData += "&status=" + URLEncoder.encode(status.trim(), "UTF-8")
            }

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val msg = json.optString("mensagem", "Operador atualizado com sucesso!")
                AdminOperationResult.Success(msg)
            } else {
                val isExpired = json.optBoolean("sessaoExpirada", false)
                val erro = json.optString("erro", "Falha ao atualizar operador.")
                if (isExpired) AdminOperationResult.SessionExpired(erro) else AdminOperationResult.Error(erro)
            }
        } catch (e: Exception) {
            AdminOperationResult.Error("Erro na requisição: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    /**
     * Ativa ou desativa um operador (action=admin_alternar_status).
     */
    fun toggleOperatorStatusAdmin(
        endpointUrl: String,
        adminToken: String,
        matricula: String,
        status: String
    ): AdminOperationResult {
        return try {
            val postData = "action=admin_alternar_status" +
                    "&adminToken=" + URLEncoder.encode(adminToken, "UTF-8") +
                    "&matricula=" + URLEncoder.encode(matricula.trim(), "UTF-8") +
                    "&status=" + URLEncoder.encode(status.trim().uppercase(), "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val msg = json.optString("mensagem", "Status do operador alterado para $status.")
                AdminOperationResult.Success(msg)
            } else {
                val isExpired = json.optBoolean("sessaoExpirada", false)
                val erro = json.optString("erro", "Falha ao alternar status do operador.")
                if (isExpired) AdminOperationResult.SessionExpired(erro) else AdminOperationResult.Error(erro)
            }
        } catch (e: Exception) {
            AdminOperationResult.Error("Erro na requisição: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    /**
     * Altera a senha da conta de Administrador (action=admin_alterar_senha_propria).
     */
    fun changeAdminPassword(
        endpointUrl: String,
        adminToken: String,
        novaSenha: String
    ): AdminOperationResult {
        return try {
            val postData = "action=admin_alterar_senha_propria" +
                    "&adminToken=" + URLEncoder.encode(adminToken, "UTF-8") +
                    "&novaSenha=" + URLEncoder.encode(novaSenha, "UTF-8")

            val jsonStr = executeHttpRequest(endpointUrl, "POST", postData)
            val json = JSONObject(jsonStr)

            if (json.optBoolean("sucesso", false)) {
                val msg = json.optString("mensagem", "Senha administrativa alterada com sucesso!")
                AdminOperationResult.Success(msg)
            } else {
                val isExpired = json.optBoolean("sessaoExpirada", false)
                val erro = json.optString("erro", "Falha ao alterar senha de administrador.")
                if (isExpired) AdminOperationResult.SessionExpired(erro) else AdminOperationResult.Error(erro)
            }
        } catch (e: Exception) {
            AdminOperationResult.Error("Erro na requisição: ${e.localizedMessage ?: "Verifique a internet"}")
        }
    }

    // =========================================================================
    // UTILITÁRIOS INTERNOS
    // =========================================================================

    private fun sanitizeUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        val qIdx = trimmed.indexOf('?')
        if (qIdx == -1) return trimmed

        val base = trimmed.substring(0, qIdx)
        val query = trimmed.substring(qIdx + 1)

        val filtered = query.split("&").filterNot {
            val key = it.substringBefore("=").lowercase().trim()
            key == "token" || key == "senha" || key == "matricula" || key == "admintoken"
        }.joinToString("&")

        return if (filtered.isEmpty()) base else "$base?$filtered"
    }

    /**
     * Utilitário HTTP com suporte a redirecionamentos do Google Apps Script.
     */
    private fun executeHttpRequest(
        urlStr: String,
        method: String,
        postData: String?
    ): String {
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
            conn.instanceFollowRedirects = false

            if (currentMethod == "POST" && currentData != null) {
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty(
                    "Content-Type",
                    "application/x-www-form-urlencoded; charset=UTF-8"
                )

                OutputStreamWriter(conn.outputStream, "UTF-8").use { writer ->
                    writer.write(currentData)
                    writer.flush()
                }
            } else {
                conn.requestMethod = "GET"
            }

            val code = conn.responseCode

            if (
                code == HttpURLConnection.HTTP_MOVED_TEMP ||
                code == HttpURLConnection.HTTP_MOVED_PERM ||
                code == HttpURLConnection.HTTP_SEE_OTHER ||
                code == 307
            ) {
                val newUrl = conn.getHeaderField("Location")
                    ?: throw Exception("Redirecionamento sem Location")

                conn.disconnect()
                currentUrl = newUrl
                currentMethod = "GET"
                currentData = null
                redirects++
                continue
            }

            if (code in 200..299) {
                val sb = StringBuilder()

                BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        sb.append(line)
                    }
                }

                conn.disconnect()
                return sb.toString()
            } else {
                val errorStream = conn.errorStream
                val errorMsg = if (errorStream != null) {
                    BufferedReader(InputStreamReader(errorStream, "UTF-8")).use {
                        it.readText()
                    }
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
