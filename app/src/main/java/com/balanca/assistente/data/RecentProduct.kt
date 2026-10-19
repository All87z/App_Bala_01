package com.balanca.assistente.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Registra os códigos de produtos consultados recentemente pelo operador da balança.
 */
@Entity(tableName = "recent_products")
data class RecentProduct(
    @PrimaryKey
    val code: String,
    val name: String,
    val accessedAt: Long = System.currentTimeMillis()
)
