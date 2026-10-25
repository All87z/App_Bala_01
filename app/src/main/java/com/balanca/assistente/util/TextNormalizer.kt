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

    /**
     * Retorna o nome real do produto sem prefixo de categoria ou título composto (ex: "HORTIFRUTI - Maçã" -> "Maçã").
     */
    fun getDisplayName(name: String, category: String? = null): String {
        val cleanName = name.trim()
        if (cleanName.isEmpty()) return ""

        if (!category.isNullOrBlank()) {
            val cat = category.trim()
            val pattern = Pattern.compile("^" + Pattern.quote(cat) + "[\\s\\-–—:/|\\]]*", Pattern.CASE_INSENSITIVE)
            val matcher = pattern.matcher(cleanName)
            if (matcher.find()) {
                val stripped = matcher.replaceFirst("").trim()
                if (stripped.isNotEmpty()) return stripped
            }
        }

        // Título entre colchetes: [CATEGORIA] Produto
        val bracketMatcher = Pattern.compile("^\\[[^\\]]+\\]\\s*(.+)").matcher(cleanName)
        if (bracketMatcher.matches()) {
            val stripped = bracketMatcher.group(1)?.trim()
            if (!stripped.isNullOrEmpty()) return stripped
        }

        // Título com separador: CATEGORIA - Produto
        val sepMatcher = Pattern.compile("^([A-Za-zÀ-ÖØ-öø-ÿ0-9\\s]{2,30})\\s*[-–—:/|]\\s*(.+)").matcher(cleanName)
        if (sepMatcher.matches()) {
            val stripped = sepMatcher.group(2)?.trim()
            if (!stripped.isNullOrEmpty()) return stripped
        }

        return cleanName
    }
}
