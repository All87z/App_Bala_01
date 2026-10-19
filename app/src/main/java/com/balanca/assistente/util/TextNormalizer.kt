package com.balanca.assistente.util

import java.text.Normalizer
import java.util.Locale
import java.util.regex.Pattern

object TextNormalizer {
    private val REGEX_UNACCENT = Pattern.compile("\\p{InCombiningDiacriticalMarks}+")

    /**
     * Remove acentos, pontuações redundantes e converte para minúsculas.
     * Exemplo: "Maçã Gala — Especial" -> "maca gala especial"
     */
    fun normalize(input: String): String {
        val nfd = Normalizer.normalize(input, Normalizer.Form.NFD)
        return REGEX_UNACCENT.matcher(nfd)
            .replaceAll("")
            .lowercase(Locale.ROOT)
            .trim()
    }

    /**
     * Verifica se o texto pesquisado casa com o nome ou com o código,
     * ignorando acentos, maiúsculas/minúsculas e correspondendo a qualquer parte.
     */
    fun matches(productName: String, productCode: String, query: String): Boolean {
        val cleanQuery = normalize(query)
        if (cleanQuery.isEmpty()) return true

        // Busca por código direto (preservando zeros ou verificando contenção)
        val cleanCode = productCode.trim()
        if (cleanCode.contains(cleanQuery, ignoreCase = true)) {
            return true
        }

        // Busca pelo nome sem acento
        val cleanName = normalize(productName)
        return cleanName.contains(cleanQuery)
    }
}
