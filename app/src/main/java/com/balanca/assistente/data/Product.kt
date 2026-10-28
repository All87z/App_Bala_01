package com.balanca.assistente.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Representa um produto de balança comercial.
 * O código é armazenado como String para preservar com segurança zeros à esquerda (ex: "005", "0102").
 */
@Entity(
    tableName = "products",
    indices = [Index(value = ["code"], unique = true)]
)
data class Product(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val normalizedName: String,
    val code: String,
    val description: String? = null,
    val imageUri: String? = null,
    val price: String? = null,
    val unit: String = "kg",
    val isAvailable: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
