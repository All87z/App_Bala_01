package com.balanca.assistente.util

import android.content.Context
import com.balanca.assistente.data.Product
import java.io.BufferedReader
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

data class CsvParseResult(
    val validProducts: List<Product>,
    val totalLines: Int,
    val invalidLinesCount: Int
)

object CsvHelper {
    /**
     * Exporta a lista de produtos completa para o formato CSV comercial com UTF-8 BOM.
     * Formato: codigo;nome;preco;unidade;disponibilidade
     */
    fun exportToCsv(products: List<Product>): String {
        val sb = StringBuilder()
        // Adiciona BOM UTF-8 (\uFEFF) para garantir correta acentuação no Excel e no Android
        sb.append("\uFEFFcodigo;nome;preco;unidade;disponibilidade\r\n")
        for (p in products) {
            val safeCode = p.code.trim().replace("\"", "\"\"")
            val safeName = p.name.trim().replace("\"", "\"\"")
            val safePrice = (p.price ?: "").trim().replace("\"", "\"\"")
            val safeUnit = p.unit.trim().uppercase().replace("\"", "\"\"")
            val safeStatus = if (p.isAvailable) "Disponivel" else "Esgotado"

            sb.append("\"$safeCode\";\"$safeName\";\"$safePrice\";\"$safeUnit\";\"$safeStatus\"\r\n")
        }
        return sb.toString()
    }

    /**
     * Importa produtos de um arquivo CSV.
     * Suporta delimitador ';' ou ',' e preserva zeros à esquerda no código.
     */
    fun parseCsv(inputStream: InputStream): CsvParseResult {
        val result = mutableListOf<Product>()
        val reader = BufferedReader(InputStreamReader(inputStream, Charsets.UTF_8))
        var line: String? = reader.readLine()
        var isFirst = true
        var total = 0
        var invalid = 0

        while (line != null) {
            val trimmed = line.trim().removePrefix("\uFEFF")
            if (trimmed.isNotEmpty()) {
                total++
                val delimiter = if (trimmed.contains(";")) ";" else ","
                val parts = splitCsvLine(trimmed, delimiter)

                if (parts.size >= 2) {
                    val rawCode = parts[0].trim().replace("\"", "")
                    val rawName = parts[1].trim().replace("\"", "")
                    val rawPrice = if (parts.size > 2) parts[2].trim().replace("\"", "") else ""
                    val rawUnit = if (parts.size > 3) parts[3].trim().replace("\"", "").lowercase() else "kg"
                    val rawStatus = if (parts.size > 4) parts[4].trim().replace("\"", "") else "Disponivel"

                    // Ignora cabeçalho
                    if (isFirst && (rawCode.equals("codigo", ignoreCase = true) || rawCode.equals("code", ignoreCase = true))) {
                        total--
                    } else if (rawCode.isNotEmpty() && rawName.isNotEmpty()) {
                        val isAvailable = !rawStatus.equals("esgotado", ignoreCase = true)
                        result.add(
                            Product(
                                name = rawName,
                                normalizedName = TextNormalizer.normalize(rawName),
                                code = rawCode,
                                price = rawPrice.ifBlank { null },
                                unit = if (rawUnit.isNotBlank()) rawUnit else "kg",
                                isAvailable = isAvailable
                            )
                        )
                    } else {
                        invalid++
                    }
                } else {
                    invalid++
                }
            }
            isFirst = false
            line = reader.readLine()
        }
        return CsvParseResult(result, total, invalid)
    }

    private fun splitCsvLine(line: String, delimiter: String): List<String> {
        val fields = mutableListOf<String>()
        var current = StringBuilder()
        var inQuotes = false
        val delChar = delimiter[0]

        for (ch in line) {
            if (ch == '\"') {
                inQuotes = !inQuotes
            } else if (ch == delChar && !inQuotes) {
                fields.add(current.toString())
                current = StringBuilder()
            } else {
                current.append(ch)
            }
        }
        fields.add(current.toString())
        return fields
    }

    /**
     * Exporta Backup Completo em ZIP contendo produtos.csv, manifest.json e pasta fotos/
     */
    fun exportZipBackup(products: List<Product>, context: Context, outputStream: OutputStream) {
        ZipOutputStream(outputStream).use { zipOut ->
            // 1. Arquivo CSV com BOM UTF-8
            val csvContent = exportToCsv(products)
            val csvEntry = ZipEntry("produtos.csv")
            zipOut.putNextEntry(csvEntry)
            zipOut.write(csvContent.toByteArray(Charsets.UTF_8))
            zipOut.closeEntry()

            // 2. Pasta fotos/
            for (p in products) {
                if (!p.imageUri.isNullOrEmpty()) {
                    try {
                        val photoFile = File(p.imageUri)
                        if (photoFile.exists()) {
                            val cleanCode = p.code.replace(Regex("[^a-zA-Z0-9_-]"), "_")
                            val photoEntry = ZipEntry("fotos/${cleanCode}_${p.id}.jpg")
                            zipOut.putNextEntry(photoEntry)
                            FileInputStream(photoFile).use { inStream ->
                                inStream.copyTo(zipOut)
                            }
                            zipOut.closeEntry()
                        }
                    } catch (_: Exception) {}
                }
            }
        }
    }

    /**
     * Restaura Backup Completo a partir de arquivo ZIP
     */
    fun importZipBackup(inputStream: InputStream, context: Context): List<Product> {
        val extractedProducts = mutableListOf<Product>()
        val savedPhotosMap = mutableMapOf<String, String>() // code -> absolutePath
        var csvBytes: ByteArray? = null

        val imagesDir = File(context.filesDir, "product_images")
        if (!imagesDir.exists()) imagesDir.mkdirs()

        ZipInputStream(inputStream).use { zipIn ->
            var entry: ZipEntry? = zipIn.nextEntry
            while (entry != null) {
                val entryName = entry.name.replace("\\", "/")
                if (entryName == "produtos.csv" || entryName.endsWith(".csv")) {
                    csvBytes = zipIn.readBytes()
                } else if (entryName.startsWith("fotos/") && !entry.isDirectory) {
                    val fileName = entryName.substringAfter("fotos/")
                    val destFile = File(imagesDir, "restored_${System.currentTimeMillis()}_$fileName")
                    FileOutputStream(destFile).use { out ->
                        zipIn.copyTo(out)
                    }
                    val codePrefix = fileName.substringBefore("_")
                    savedPhotosMap[codePrefix] = destFile.absolutePath
                }
                zipIn.closeEntry()
                entry = zipIn.nextEntry
            }
        }

        if (csvBytes != null) {
            val parseResult = parseCsv(csvBytes!!.inputStream())
            for (p in parseResult.validProducts) {
                val matchedPhoto = savedPhotosMap[p.code.replace(Regex("[^a-zA-Z0-9_-]"), "_")]
                extractedProducts.add(p.copy(imageUri = matchedPhoto))
            }
        }

        return extractedProducts
    }
}
