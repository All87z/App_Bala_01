import JSZip from 'jszip';

export interface AndroidFileRecord {
  path: string;
  content: string;
}

export const ANDROID_FILES: AndroidFileRecord[] = [
  {
    path: 'build.gradle.kts',
    content: `// Top-level build file for Assistente de Balança Android App
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}
`,
  },
  {
    path: 'settings.gradle.kts',
    content: `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "AssistenteDeBalanca"
include(":app")
`,
  },
  {
    path: 'gradle.properties',
    content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`,
  },
  {
    path: 'gradle/libs.versions.toml',
    content: `[versions]
agp = "8.7.3"
kotlin = "2.0.21"
coreKtx = "1.15.0"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.11.00"
room = "2.6.1"
ksp = "2.0.21-1.0.28"
coroutines = "1.9.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }

# Room SQLite Database
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

# Coroutines
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
`,
  },
  {
    path: 'app/build.gradle.kts',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.balanca.assistente"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.balanca.assistente"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)

    // Room Database
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    debugImplementation(libs.androidx.ui.tooling)
}
`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissão para reconhecimento de voz da pesquisa -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <queries>
        <!-- Permite ao app consultar se o serviço de reconhecimento de voz está instalado no Android -->
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@android:drawable/sym_def_app_icon"
        android:label="@string/app_name"
        android:roundIcon="@android:drawable/sym_def_app_icon"
        android:supportsRtl="true"
        android:theme="@style/Theme.AssistenteDeBalanca">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize"
            android:theme="@style/Theme.AssistenteDeBalanca">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`,
  },
  {
    path: 'app/src/main/res/values/strings.xml',
    content: `<resources>
    <string name="app_name">Assistente de Balança</string>
</resources>
`,
  },
  {
    path: 'app/src/main/res/values/themes.xml',
    content: `<resources>
    <style name="Theme.AssistenteDeBalanca" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:statusBarColor">#0F172A</item>
        <item name="android:navigationBarColor">#0F172A</item>
    </style>
</resources>
`,
  },
  {
    path: 'app/src/main/res/xml/backup_rules.xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <include domain="database" path="balanca_database.db" />
</full-backup-content>
`,
  },
  {
    path: 'app/src/main/res/xml/data_extraction_rules.xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <include domain="database" path="balanca_database.db" />
    </cloud-backup>
    <device-transfer>
        <include domain="database" path="balanca_database.db" />
    </device-transfer>
</data-extraction-rules>
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/MainActivity.kt',
    content: `package com.balanca.assistente

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import com.balanca.assistente.ui.ProductViewModel
import com.balanca.assistente.ui.ScaleAssistantApp
import com.balanca.assistente.ui.theme.AssistenteDeBalancaTheme

class MainActivity : ComponentActivity() {

    private val viewModel: ProductViewModel by viewModels()

    private val requestAudioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.startVoiceRecognition(this)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            AssistenteDeBalancaTheme {
                ScaleAssistantApp(
                    viewModel = viewModel,
                    onRequestMicrophonePermission = {
                        val permission = Manifest.permission.RECORD_AUDIO
                        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                            requestAudioPermissionLauncher.launch(permission)
                        } else {
                            viewModel.startVoiceRecognition(this)
                        }
                    }
                )
            }
        }
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/data/Product.kt',
    content: `package com.balanca.assistente.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

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
    val imageUri: String? = null,
    val price: String? = null,
    val unit: String = "kg",
    val isAvailable: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/data/RecentProduct.kt',
    content: `package com.balanca.assistente.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recent_products")
data class RecentProduct(
    @PrimaryKey
    val code: String,
    val name: String,
    val accessedAt: Long = System.currentTimeMillis()
)
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/data/ProductDao.kt',
    content: `package com.balanca.assistente.data

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

    @Query("SELECT * FROM recent_products ORDER BY accessedAt DESC LIMIT 10")
    fun getRecentProducts(): Flow<List<RecentProduct>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecent(recent: RecentProduct)

    @Query("DELETE FROM recent_products WHERE code = :code")
    suspend fun deleteRecentByCode(code: String)
}
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/data/AppDatabase.kt',
    content: `package com.balanca.assistente.data

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
                        database.productDao().insertAll(initialList)
                    }
                }
            }
        }
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/util/TextNormalizer.kt',
    content: `package com.balanca.assistente.util

import java.text.Normalizer
import java.util.Locale
import java.util.regex.Pattern

object TextNormalizer {
    private val REGEX_UNACCENT = Pattern.compile("\\\\p{InCombiningDiacriticalMarks}+")

    fun normalize(input: String): String {
        val nfd = Normalizer.normalize(input, Normalizer.Form.NFD)
        return REGEX_UNACCENT.matcher(nfd)
            .replaceAll("")
            .lowercase(Locale.ROOT)
            .trim()
    }

    fun matches(productName: String, productCode: String, query: String): Boolean {
        val cleanQuery = normalize(query)
        if (cleanQuery.isEmpty()) return true
        if (productCode.trim().contains(cleanQuery, ignoreCase = true)) return true
        return normalize(productName).contains(cleanQuery)
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/balanca/assistente/util/CsvHelper.kt',
    content: `package com.balanca.assistente.util

import com.balanca.assistente.data.Product
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader

object CsvHelper {
    fun exportToCsv(products: List<Product>): String {
        val sb = StringBuilder()
        sb.append("codigo;nome\\n")
        for (p in products) {
            val safeName = p.name.replace("\"", "\"\"")
            sb.append("\${p.code};\\"\${safeName}\\"\\n")
        }
        return sb.toString()
    }

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
                    if (isFirst && (rawCode.equals("codigo", true) || rawCode.equals("code", true))) {
                        // Skip header
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
`,
  },
  {
    path: 'gradle/wrapper/gradle-wrapper.properties',
    content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
  },
  {
    path: '.github/workflows/android-build.yml',
    content: `name: Compilação Android (APK)

on:
  workflow_dispatch:
  push:
    branches:
      - main
      - master
  pull_request:
    branches:
      - main
      - master

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-apk:
    name: Compilar APK Debug (Kotlin + Jetpack Compose)
    runs-on: ubuntu-latest

    permissions:
      contents: read

    steps:
      - name: 1. Baixar código do repositório (Checkout)
        uses: actions/checkout@v4

      - name: 2. Configurar JDK 17 (Java)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'gradle'

      - name: 3. Configurar Android SDK
        uses: android-actions/setup-android@v3

      - name: 4. Aceitar licenças do Android SDK
        run: |
          yes | sdkmanager --licenses || true

      - name: 5. Conceder permissão de execução ao Gradle Wrapper
        run: |
          if [ -f "./gradlew" ]; then
            chmod +x ./gradlew
          fi
          if [ -f "./android/gradlew" ]; then
            chmod +x ./android/gradlew
          fi

      - name: 6. Compilar APK com Gradle (assembleDebug)
        run: |
          if [ -f "./gradlew" ]; then
            ./gradlew assembleDebug --stacktrace
          elif [ -f "./android/gradlew" ]; then
            cd android
            ./gradlew assembleDebug --stacktrace
          else
            echo "Erro: gradlew não encontrado!"
            exit 1
          fi

      - name: 7. Publicar APK como Artefato para Download
        uses: actions/upload-artifact@v4
        with:
          name: assistente-de-balanca-debug-apk
          path: |
            app/build/outputs/apk/debug/*.apk
            android/app/build/outputs/apk/debug/*.apk
          retention-days: 14
          if-no-files-found: error
`,
  },
  {
    path: 'README.md',
    content: `# Assistente de Balança — Projeto Android Nativo (Kotlin + Jetpack Compose)

Projeto completo, configurado com Room (SQLite offline), pesquisa sem acentos, dígitos extragrandes para balança e compilação automática no GitHub Actions.

## Como Gerar o APK pelo GitHub Actions:
1. Envie o projeto para o GitHub.
2. Vá até a aba **Actions**.
3. Selecione o workflow **Compilação Android (APK)**.
4. Clique em **Run workflow**.
5. Quando o build terminar, baixe o arquivo APK gerado na seção **Artifacts**!

## Como Gerar o APK localmente no Android Studio:
1. Abra esta pasta no Android Studio.
2. Aguarde a sincronização automática do Gradle (Gradle 8.10.2 + JDK 17).
3. No menu superior: Build > Build Bundle(s) / APK(s) > Build APK(s).
4. Clique em "locate" e copie o arquivo app-debug.apk para qualquer celular Android!
`,
  },
];

/**
 * Empacota todos os arquivos do projeto Android em um arquivo .ZIP pronto para download
 */
export async function downloadAndroidProjectZip(): Promise<void> {
  const zip = new JSZip();

  for (const file of ANDROID_FILES) {
    zip.file(file.path, file.content);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'assistente-de-balanca-android-projeto.zip');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
