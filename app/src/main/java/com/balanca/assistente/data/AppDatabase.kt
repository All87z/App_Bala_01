package com.balanca.assistente.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.balanca.assistente.util.TextNormalizer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [Product::class, RecentProduct::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun productDao(): ProductDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "balanca_database.db"
                )
                    .addCallback(AppDatabaseCallback(scope))
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class AppDatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        populateInitialData(database.productDao())
                    }
                }
            }

            suspend fun populateInitialData(dao: ProductDao) {
                // Exemplos iniciais obrigatórios solicitados:
                // Banana prata — 102
                // Batata inglesa — 215
                // Queijo mussarela — 347
                val initialList = listOf(
                    Product(
                        name = "Banana prata",
                        normalizedName = TextNormalizer.normalize("Banana prata"),
                        code = "102"
                    ),
                    Product(
                        name = "Batata inglesa",
                        normalizedName = TextNormalizer.normalize("Batata inglesa"),
                        code = "215"
                    ),
                    Product(
                        name = "Queijo mussarela",
                        normalizedName = TextNormalizer.normalize("Queijo mussarela"),
                        code = "347"
                    )
                )
                dao.insertAll(initialList)
            }
        }
    }
}
