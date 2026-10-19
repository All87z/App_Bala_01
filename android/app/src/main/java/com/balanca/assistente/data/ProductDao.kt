package com.balanca.assistente.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY name COLLATE NOCASE ASC")
    fun getAllProducts(): Flow<List<Product>>

    @Query("SELECT * FROM products WHERE code = :code LIMIT 1")
    suspend fun getByCode(code: String): Product?

    @Query("SELECT * FROM products WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): Product?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(product: Product): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(products: List<Product>)

    @Update
    suspend fun update(product: Product)

    @Delete
    suspend fun delete(product: Product)

    @Query("SELECT COUNT(*) FROM products")
    suspend fun count(): Int

    // Recentes
    @Query("SELECT * FROM recent_products ORDER BY accessedAt DESC LIMIT 10")
    fun getRecentProducts(): Flow<List<RecentProduct>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecent(recent: RecentProduct)

    @Query("DELETE FROM recent_products WHERE code = :code")
    suspend fun deleteRecentByCode(code: String)

    @Query("DELETE FROM recent_products")
    suspend fun clearRecents()
}
