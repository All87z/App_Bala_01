package com.balanca.assistente.util

import com.balanca.assistente.data.Product
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader

object CsvHelper {
    /**
     * Exporta a lista de produtos para o formato CSV.
     * Formato: codigo;nome
     */
    fun exportToCsv(products: List<Product>): String {
        val sb = StringBuilder()
        sb.append("codigo;nome\n")
        for (p in products) {
            // Escapa aspas duplas caso o nome contenha ponto e vírgula ou quebra
            val safeName = p.name.replace("\"", "\"\"")
            sb.append("${p.code};\"${safeName}\"\n")
        }
        return sb.toString()
    }

    /**
     * Importa produtos de um texto CSV.
     * Suporta delimitador ';' ou ',' e preserva zeros à esquerda no código.
     * Retorna lista de produtos válidos para inserção.
     */
    fun parseCsv(inputStream: InputStream): List<Product> {
        val result = mutableListOf<Product>()
        val reader = BufferedReader(InputStreamReader(inputStream))
        var line: String? = reader.readLine()
        var isFirst = true

        while (line != null) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty()) {
                val delimiter = if (trimmed.contains(";")) ";" else ","
                val parts = trimmed.split(delimiter)

                if (parts.size >= 2) {
                    val rawCode = parts[0].trim().replace("\"", "")
                    val rawName = parts[1].trim().replace("\"", "")

                    // Ignora linha de cabeçalho
                    if (isFirst && (rawCode.equals("codigo", ignoreCase = true) || rawCode.equals("code", ignoreCase = true))) {
                        // Header line, skip
                    } else if (rawCode.isNotEmpty() && rawName.isNotEmpty()) {
                        result.add(
                            Product(
                                name = rawName,
                                normalizedName = TextNormalizer.normalize(rawName),
                                code = rawCode
                            )
                        )
                    }
                }
            }
            isFirst = false
            line = reader.readLine()
        }
        return result
    }
}
