package com.balanca.assistente.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import java.io.File
import java.io.FileOutputStream
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.balanca.assistente.data.Product
import com.balanca.assistente.data.OperatorRecord
import com.balanca.assistente.util.TextNormalizer
import com.balanca.assistente.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScaleAssistantApp(
    viewModel: ProductViewModel,
    onRequestMicrophonePermission: () -> Unit
) {
    val context = LocalContext.current
    val searchQuery by viewModel.searchQuery.collectAsState()
    val products by viewModel.filteredProducts.collectAsState()
    val selectedSpotlight by viewModel.selectedSpotlightProduct.collectAsState()
    val isAddEditDialogOpen by viewModel.isAddEditDialogOpen.collectAsState()
    val productToEdit by viewModel.productToEdit.collectAsState()
    val productToDelete by viewModel.productToDelete.collectAsState()
    val formErrorMessage by viewModel.formErrorMessage.collectAsState()
    val statusNotice by viewModel.statusNotice.collectAsState()
    val isListening by viewModel.isListening.collectAsState()
    val isSyncingSheets by viewModel.isSyncingSheets.collectAsState()

    var isDataBackupDialogOpen by remember { mutableStateOf(false) }

    // Launcher para salvar arquivo CSV exportado
    val exportCsvLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        uri?.let {
            try {
                context.contentResolver.openOutputStream(it)?.use { stream ->
                    val csvData = viewModel.getCsvContent()
                    stream.write(csvData.toByteArray(Charsets.UTF_8))
                    Toast.makeText(context, "CSV salvo com sucesso!", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Erro ao exportar CSV: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // Launcher para importar arquivo CSV
    val importCsvLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            try {
                context.contentResolver.openInputStream(it)?.use { stream ->
                    viewModel.importFromCsv(stream)
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Falha ao abrir CSV: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // Launcher para salvar backup completo ZIP (com fotos)
    val exportZipLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/zip")
    ) { uri ->
        uri?.let {
            try {
                context.contentResolver.openOutputStream(it)?.use { stream ->
                    viewModel.exportZip(context, stream)
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Erro ao exportar ZIP: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // Launcher para restaurar backup completo ZIP (com fotos)
    val importZipLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            try {
                context.contentResolver.openInputStream(it)?.use { stream ->
                    viewModel.importZip(context, stream)
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Falha ao abrir ZIP: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // Copiar código para a área de transferência
    fun copyCode(code: String, productName: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Código de Balança", code)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "Código $code copiado ($productName)", Toast.LENGTH_SHORT).show()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Assistente de Balança",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = PrimaryYellow
                            )
                        )
                        Text(
                            text = "${products.size} produto(s) disponível(is)",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextMuted)
                        )
                    }
                },
                actions = {},
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BackgroundDark
                )
            )
        },
        containerColor = BackgroundDark
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            // Barra de Busca Grande
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                placeholder = {
                    Text(
                        text = "Digite o nome ou código...",
                        style = MaterialTheme.typography.bodyLarge.copy(fontSize = 18.sp, color = TextMuted)
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Buscar",
                        tint = PrimaryYellow,
                        modifier = Modifier.size(28.dp)
                    )
                },
                trailingIcon = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.clearSearchQuery() }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Limpar busca",
                                    tint = TextMuted
                                )
                            }
                        }
                        IconButton(
                            onClick = {
                                if (isListening) {
                                    viewModel.stopVoiceRecognition()
                                } else {
                                    onRequestMicrophonePermission()
                                    viewModel.startVoiceRecognition(context)
                                }
                            },
                            modifier = Modifier
                                .padding(end = 4.dp)
                                .size(44.dp)
                                .background(
                                    if (isListening) DangerRed else SurfaceVariantDark,
                                    shape = CircleShape
                                )
                        ) {
                            Icon(
                                imageVector = if (isListening) Icons.Default.MicOff else Icons.Default.Mic,
                                contentDescription = "Pesquisar por voz em pt-BR",
                                tint = if (isListening) Color.White else PrimaryYellow
                            )
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = SurfaceDark,
                    unfocusedContainerColor = SurfaceDark,
                    focusedBorderColor = PrimaryYellow,
                    unfocusedBorderColor = SurfaceVariantDark,
                    focusedTextColor = TextLight,
                    unfocusedTextColor = TextLight
                )
            )

            // Área de Sincronização: Nuvem Sheets (Google Sheets)
            Surface(
                onClick = { isDataBackupDialogOpen = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 4.dp),
                shape = RoundedCornerShape(10.dp),
                color = SurfaceDark,
                border = BorderStroke(1.dp, SurfaceVariantDark)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    if (isSyncingSheets) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = AccentGreen,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Sincronizando...",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = AccentGreen,
                                fontSize = 13.sp
                            )
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Cloud,
                            contentDescription = "Nuvem Sheets",
                            tint = AccentGreen,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Nuvem Sheets",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = TextLight,
                                fontSize = 13.sp
                            )
                        )
                    }
                }
            }

            // Aviso de status ou voz offline
            AnimatedVisibility(
                visible = statusNotice != null,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                statusNotice?.let { notice ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        shape = RoundedCornerShape(12.dp),
                        color = SurfaceVariantDark,
                        border = BorderStroke(1.dp, PrimaryYellow.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(12.dp)
                                .fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = notice,
                                style = MaterialTheme.typography.bodySmall.copy(color = TextLight),
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = { viewModel.clearStatusNotice() }) {
                                Text("OK", color = PrimaryYellow, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Lista de Resultados
            if (products.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(bottom = 96.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Nenhum produto encontrado",
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = TextMuted,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (searchQuery.isNotEmpty()) "Tente outro nome ou código" else "Sincronize com a planilha para exibir os produtos",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextMuted.copy(alpha = 0.7f))
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 96.dp)
                ) {
                    items(products, key = { it.id }) { product ->
                        ProductCard(
                            product = product,
                            onCardClick = { viewModel.openSpotlight(product) },
                            onToggleAvailability = { viewModel.toggleProductAvailability(product) }
                        )
                    }
                }
            }
        }
    }

    // Modal de Destaque do Código (Números Gigantes para Balança)
    selectedSpotlight?.let { product ->
        SpotlightDialog(
            product = product,
            onDismiss = { viewModel.closeSpotlight() },
            onCopy = { copyCode(product.code, TextNormalizer.getDisplayName(product.name)) },
            onToggleAvailability = { viewModel.toggleProductAvailability(product) }
        )
    }

    // Modal de Backup / Importação / Exportação Completo
    if (isDataBackupDialogOpen) {
        DataBackupDialog(
            viewModel = viewModel,
            onDismiss = { isDataBackupDialogOpen = false },
            onExportCsv = {
                exportCsvLauncher.launch("produtos_balanca_${System.currentTimeMillis()}.csv")
            },
            onCopyCsv = {
                val csvData = viewModel.getCsvContent()
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Backup CSV Balança", csvData))
                Toast.makeText(context, "CSV copiado para a área de transferência!", Toast.LENGTH_SHORT).show()
            },
            onImportCsv = {
                importCsvLauncher.launch("*/*")
            },
            onExportZip = {
                exportZipLauncher.launch("backup_balanca_${System.currentTimeMillis()}.zip")
            },
            onImportZip = {
                importZipLauncher.launch("*/*")
            }
        )
    }

    // Diálogo de Confirmação de Exclusão
    productToDelete?.let { product ->
        AlertDialog(
            onDismissRequest = { viewModel.cancelDeleteConfirmation() },
            title = {
                Text(
                    text = "Confirmar exclusão?",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = TextLight)
                )
            },
            text = {
                Text(
                    text = "Deseja realmente remover o produto \"${product.name}\" (Código: ${product.code})?",
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextMuted)
                )
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.confirmDelete() },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) {
                    Text("Excluir", fontWeight = FontWeight.Bold, color = Color.White)
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { viewModel.cancelDeleteConfirmation() }) {
                    Text("Cancelar", color = TextLight)
                }
            },
            containerColor = SurfaceDark,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

/**
 * Renderizador de imagem persistente do produto para APK e dispositivos móveis
 */
@Composable
fun ProductThumbnail(
    imageUri: String?,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val bitmap = remember(imageUri) {
        if (!imageUri.isNullOrEmpty()) {
            try {
                if (imageUri.startsWith("/")) {
                    val file = File(imageUri)
                    if (file.exists() && file.length() > 0) {
                        BitmapFactory.decodeFile(file.absolutePath)
                    } else null
                } else if (imageUri.startsWith("content://") || imageUri.startsWith("file://")) {
                    val uri = android.net.Uri.parse(imageUri)
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        BitmapFactory.decodeStream(stream)
                    }
                } else null
            } catch (e: Exception) {
                null
            }
        } else null
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = BackgroundDark,
        border = BorderStroke(1.dp, SurfaceVariantDark),
        modifier = modifier.size(size)
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Foto do produto",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(12.dp))
            )
        } else {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    imageVector = Icons.Default.Image,
                    contentDescription = "Sem foto",
                    tint = PrimaryYellow,
                    modifier = Modifier.size((size.value * 0.45f).dp)
                )
            }
        }
    }
}


/**
 * Card do produto na lista com CÓDIGO EM NÚMEROS MUITO GRANDES
 */
@Composable
fun ProductCard(
    product: Product,
    onCardClick: () -> Unit,
    onToggleAvailability: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onCardClick() },
        color = SurfaceDark,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, SurfaceVariantDark)
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val isCompact = maxWidth < 540.dp

            if (isCompact) {
                // SMARTPHONE NA ORIENTAÇÃO VERTICAL (PORTRAIT: 320dp - 430dp)
                // Layout linear seguindo a hierarquia da referência visual sem nenhuma sobreposição
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    // 2. FOTO QUADRADA PROPORCIONAL: 64dp (faixa entre 56dp e 72dp) com imagem persistente
                    ProductThumbnail(
                        imageUri = product.imageUri,
                        size = 64.dp
                    )

                    Spacer(modifier = Modifier.width(12.dp))

                    // COLUNA CENTRAL: HIERARQUIA CONFORME REFERÊNCIA VISUAL
                    Column(
                        modifier = Modifier.weight(1f)
                    ) {
                        // 1. CÓDIGO DO PRODUTO: MAIOR DESTAQUE VISUAL
                        Text(
                            text = product.code,
                            style = MaterialTheme.typography.headlineSmall.copy(
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                color = PrimaryYellow,
                                letterSpacing = 1.sp
                            )
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        // 3. NOME REAL DO PRODUTO: SEM PREFIXO DE CATEGORIA
                        Text(
                            text = com.balanca.assistente.util.TextNormalizer.getDisplayName(product.name),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextLight,
                                lineHeight = 20.sp
                            ),
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis
                        )

                        // DESCRIÇÃO CURTA DO PRODUTO (COMO É VENDIDO)
                        if (!product.description.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = product.description.trim(),
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = TextMuted,
                                    lineHeight = 15.sp
                                ),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        // 4. STATUS DISPONÍVEL OU ESGOTADO: INTERATIVO E PERSISTIDO LOCALMENTE NO APARELHO
                        Surface(
                            onClick = onToggleAvailability,
                            shape = RoundedCornerShape(6.dp),
                            color = if (product.isAvailable) AccentGreen.copy(alpha = 0.2f) else DangerRed.copy(alpha = 0.2f),
                            border = BorderStroke(1.dp, if (product.isAvailable) AccentGreen.copy(alpha = 0.5f) else DangerRed.copy(alpha = 0.5f))
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(if (product.isAvailable) AccentGreen else DangerRed)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (product.isAvailable) "Disponível" else "Esgotado",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (product.isAvailable) AccentGreen else DangerRed
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        // 5. PREÇO E UNIDADE JUNTOS NA MESMA LINHA: R$ 8,99 / kg
                        if (!product.price.isNullOrEmpty()) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = BackgroundDark.copy(alpha = 0.8f),
                                border = BorderStroke(1.dp, SurfaceVariantDark)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.Bottom,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(
                                        text = "R$ ",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = AccentGreen
                                        )
                                    )
                                    Text(
                                        text = product.price,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontFamily = FontFamily.Monospace,
                                            color = AccentGreen
                                        )
                                    )
                                    Text(
                                        text = "/${product.unit}",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 11.sp,
                                            color = TextMuted
                                        )
                                    )
                                }
                            }
                        } else {
                            Text(
                                text = "Preço a definir",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontSize = 11.sp,
                                    color = TextMuted.copy(alpha = 0.7f)
                                )
                            )
                        }
                    }
                }
            } else {
                // TABLET E SMARTPHONE HORIZONTAL (>= 540dp) - Layout original lado a lado preservado
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Imagem de Referência Visual ANTES da palavra / nome com imagem persistente
                    ProductThumbnail(
                        imageUri = product.imageUri,
                        size = 56.dp
                    )

                    Spacer(modifier = Modifier.width(12.dp))

                    // Nome do Produto, Status e Preço
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = com.balanca.assistente.util.TextNormalizer.getDisplayName(product.name),
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextLight
                                ),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )

                            Spacer(modifier = Modifier.width(6.dp))

                            // Badge de Disponibilidade Clicável
                            Surface(
                                onClick = onToggleAvailability,
                                shape = RoundedCornerShape(6.dp),
                                color = if (product.isAvailable) AccentGreen.copy(alpha = 0.2f) else DangerRed.copy(alpha = 0.2f),
                                border = BorderStroke(1.dp, if (product.isAvailable) AccentGreen.copy(alpha = 0.5f) else DangerRed.copy(alpha = 0.5f))
                            ) {
                                Text(
                                    text = if (product.isAvailable) "Disponível" else "Esgotado",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (product.isAvailable) AccentGreen else DangerRed
                                    ),
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        // DESCRIÇÃO CURTA DO PRODUTO (COMO É VENDIDO)
                        if (!product.description.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = product.description.trim(),
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = TextMuted
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        // Preço
                        if (!product.price.isNullOrEmpty()) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "R$ ${product.price}/${product.unit}",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontFamily = FontFamily.Monospace,
                                    color = AccentGreen
                                )
                            )
                        } else {
                            Text(
                                text = "Toque para tela cheia",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = TextMuted.copy(alpha = 0.6f)
                                )
                            )
                        }
                    }

                    // Código em NÚMEROS MUITO GRANDES (Exibição destacada)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.End
                    ) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = BackgroundDark,
                            border = BorderStroke(2.dp, PrimaryYellow.copy(alpha = 0.8f)),
                            modifier = Modifier.padding(horizontal = 6.dp)
                        ) {
                            Text(
                                text = product.code,
                                style = MaterialTheme.typography.headlineLarge.copy(
                                    fontSize = 32.sp,
                                    fontWeight = FontWeight.Black,
                                    fontFamily = FontFamily.Monospace,
                                    color = PrimaryYellow,
                                    letterSpacing = 1.sp
                                ),
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Diálogo de Destaque Colossal para o operador da balança
 */
@Composable
fun SpotlightDialog(
    product: Product,
    onDismiss: () -> Unit,
    onCopy: () -> Unit,
    onToggleAvailability: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = SurfaceDark,
            border = BorderStroke(2.dp, PrimaryYellow),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "CÓDIGO DE BALANÇA",
                    style = MaterialTheme.typography.labelLarge.copy(
                        color = TextMuted,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = com.balanca.assistente.util.TextNormalizer.getDisplayName(product.name),
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = TextLight,
                        textAlign = TextAlign.Center
                    )
                )
                if (!product.description.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = product.description.trim(),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextMuted,
                            textAlign = TextAlign.Center
                        )
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                // Badge de Disponibilidade Interativo no Destaque
                Surface(
                    onClick = onToggleAvailability,
                    shape = RoundedCornerShape(8.dp),
                    color = if (product.isAvailable) AccentGreen.copy(alpha = 0.2f) else DangerRed.copy(alpha = 0.2f),
                    border = BorderStroke(1.dp, if (product.isAvailable) AccentGreen.copy(alpha = 0.5f) else DangerRed.copy(alpha = 0.5f))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (product.isAvailable) AccentGreen else DangerRed)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (product.isAvailable) "Disponível" else "Esgotado",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = if (product.isAvailable) AccentGreen else DangerRed
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                // NÚMERO COLOSSAL
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = BackgroundDark,
                    border = BorderStroke(3.dp, PrimaryYellow),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = product.code,
                        style = MaterialTheme.typography.displayLarge.copy(
                            fontSize = 68.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            color = PrimaryYellow,
                            textAlign = TextAlign.Center,
                            letterSpacing = 4.sp
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("Fechar", color = TextLight, fontSize = 16.sp)
                    }

                    Button(
                        onClick = {
                            onCopy()
                            onDismiss()
                        },
                        modifier = Modifier
                            .weight(1.3f)
                            .height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = null,
                            tint = BackgroundDark
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Copiar Código",
                            color = BackgroundDark,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }
            }
        }
    }
}

/**
 * Diálogo de Formulário para Adicionar ou Editar Produto
 */
@Composable
fun ProductFormDialog(
    productToEdit: Product?,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onSave: (name: String, code: String, imageUri: String?, price: String?, unit: String, isAvailable: Boolean) -> Unit
) {
    val context = LocalContext.current
    var name by remember { mutableStateOf(productToEdit?.name ?: "") }
    var code by remember { mutableStateOf(productToEdit?.code ?: "") }
    var price by remember { mutableStateOf(productToEdit?.price ?: "") }
    var unit by remember { mutableStateOf(productToEdit?.unit ?: "kg") }
    var isAvailable by remember { mutableStateOf(productToEdit?.isAvailable ?: true) }
    var imageUri by remember { mutableStateOf(productToEdit?.imageUri) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { pickedUri ->
            try {
                val imagesDir = File(context.filesDir, "product_images")
                if (!imagesDir.exists()) imagesDir.mkdirs()
                val destFile = File(imagesDir, "prod_${System.currentTimeMillis()}.jpg")
                context.contentResolver.openInputStream(pickedUri)?.use { input ->
                    val originalBitmap = BitmapFactory.decodeStream(input)
                    if (originalBitmap != null) {
                        val maxDim = 400
                        val width = originalBitmap.width
                        val height = originalBitmap.height
                        val scale = (maxDim.toFloat() / maxOf(width, height)).coerceAtMost(1f)
                        val scaledBitmap = if (scale < 1f) {
                            Bitmap.createScaledBitmap(originalBitmap, (width * scale).toInt(), (height * scale).toInt(), true)
                        } else {
                            originalBitmap
                        }
                        FileOutputStream(destFile).use { out ->
                            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
                        }
                        imageUri = destFile.absolutePath
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Erro ao processar imagem: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = SurfaceDark,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Text(
                    text = if (productToEdit != null) "Editar Produto" else "Adicionar Novo Produto",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Bold,
                        color = PrimaryYellow
                    )
                )
                Spacer(modifier = Modifier.height(14.dp))

                // Apenas a ação de marcar como esgotado
                Button(
                    onClick = { isAvailable = false },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (!isAvailable) DangerRed else SurfaceVariantDark,
                        contentColor = if (!isAvailable) Color.White else TextMuted
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = if (!isAvailable) "Produto Marcado como Esgotado" else "Marcar como Esgotado",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Botão de Imagem da Galeria
                OutlinedButton(
                    onClick = { photoPickerLauncher.launch("image/*") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AddPhotoAlternate,
                        contentDescription = "Selecionar Foto",
                        tint = PrimaryYellow
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (!imageUri.isNullOrEmpty()) "Trocar Foto da Galeria" else "Adicionar Foto da Galeria",
                        color = TextLight
                    )
                }

                // Pré-visualização da Imagem Selecionada com opção de remover
                if (!imageUri.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceVariantDark.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ProductThumbnail(imageUri = imageUri, size = 52.dp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Foto pronta para salvar",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = AccentGreen,
                                fontWeight = FontWeight.SemiBold
                            ),
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { imageUri = null }) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Remover foto",
                                tint = DangerRed
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Campo Nome
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do Produto (ex: Maçã Fuji)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Campo Código (Tratado como texto para preservar zeros à esquerda!)
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text("Código da Balança (ex: 102 ou 005)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Campo Preço
                OutlinedTextField(
                    value = price,
                    onValueChange = { price = it },
                    label = { Text("Preço de Venda (R$ por $unit)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentGreen,
                        focusedLabelColor = AccentGreen,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Unidade de Venda da Balança (UN, PCT, KG, 100G, G, BDJ)
                Text(
                    text = "Unidade de Venda da Balança",
                    style = MaterialTheme.typography.labelMedium.copy(
                        color = TextLight,
                        fontWeight = FontWeight.SemiBold
                    )
                )
                Spacer(modifier = Modifier.height(6.dp))
                val availableUnits = listOf("UN", "PCT", "KG", "100G", "G", "BDJ")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    availableUnits.forEach { u ->
                        val isSelected = unit.equals(u, ignoreCase = true)
                        Surface(
                            onClick = { unit = u.lowercase() },
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) PrimaryYellow else SurfaceVariantDark,
                            border = BorderStroke(1.dp, if (isSelected) PrimaryYellow else SurfaceVariantDark),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = u,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) BackgroundDark else TextLight,
                                    textAlign = TextAlign.Center
                                ),
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }
                    }
                }

                // Mensagem de Erro / Duplicidade
                errorMessage?.let { error ->
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall.copy(color = DangerRed, fontWeight = FontWeight.SemiBold)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar", color = TextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSave(name, code, imageUri, price.ifBlank { null }, unit, isAvailable) },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow)
                    ) {
                        Text(
                            text = if (productToEdit != null) "Atualizar" else "Salvar",
                            color = BackgroundDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

/**
 * Diálogo de Backup, Importação, Exportação e Sincronização Nuvem (Google Sheets & Drive)
 * Inclui abas: "Operador" e "Administrador" (totalmente independentes)
 */
@Composable
fun DataBackupDialog(
    viewModel: ProductViewModel,
    onDismiss: () -> Unit,
    onExportCsv: () -> Unit,
    onCopyCsv: () -> Unit,
    onImportCsv: () -> Unit,
    onExportZip: () -> Unit,
    onImportZip: () -> Unit
) {
    val context = LocalContext.current
    var selectedAuthTab by remember { mutableStateOf(0) } // 0 = Operador, 1 = Administrador

    // Estados do Operador
    val currentSession by viewModel.currentSession.collectAsState()
    val isSyncingSheets by viewModel.isSyncingSheets.collectAsState()
    val sheetsSyncNotice by viewModel.sheetsSyncNotice.collectAsState()
    var matriculaInput by remember { mutableStateOf("") }
    var senhaInput by remember { mutableStateOf("") }
    var loginError by remember { mutableStateOf<String?>(null) }
    var isLoggingIn by remember { mutableStateOf(false) }

    // Estados do Administrador
    val currentAdminSession by viewModel.currentAdminSession.collectAsState()
    val operatorsList by viewModel.operatorsList.collectAsState()
    val operatorsTotal by viewModel.operatorsTotal.collectAsState()
    val operatorsLimit by viewModel.operatorsLimit.collectAsState()
    val isLoadingAdmin by viewModel.isLoadingAdmin.collectAsState()
    val adminNotice by viewModel.adminNotice.collectAsState()

    var adminMatriculaInput by remember { mutableStateOf("ADMIN") }
    var adminSenhaInput by remember { mutableStateOf("") }
    var showAdminPassword by remember { mutableStateOf(false) }
    var adminLoginError by remember { mutableStateOf<String?>(null) }

    // Modais internos do Administrador
    var isCreateOpDialogOpen by remember { mutableStateOf(false) }
    var operatorToEdit by remember { mutableStateOf<OperatorRecord?>(null) }
    var isChangeAdminPassDialogOpen by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = SurfaceDark,
            border = BorderStroke(1.dp, SurfaceVariantDark),
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.92f)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Top Header com Botão Fechar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Nuvem Sheets & Acesso",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = PrimaryYellow
                        )
                    )
                    IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                        Icon(imageVector = Icons.Default.Clear, contentDescription = "Fechar", tint = TextMuted)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Seletor de Abas: Operador | Administrador
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(BackgroundDark)
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Aba 1: Operador
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (selectedAuthTab == 0) PrimaryYellow else Color.Transparent,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { selectedAuthTab = 0 }
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = if (selectedAuthTab == 0) BackgroundDark else TextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Operador",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (selectedAuthTab == 0) BackgroundDark else TextMuted
                                )
                            )
                        }
                    }

                    // Aba 2: Administrador
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (selectedAuthTab == 1) PrimaryYellow else Color.Transparent,
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                selectedAuthTab = 1
                                if (currentAdminSession != null) {
                                    viewModel.loadOperatorsAdmin()
                                }
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = if (selectedAuthTab == 1) BackgroundDark else TextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Administrador",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (selectedAuthTab == 1) BackgroundDark else TextMuted
                                )
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Conteúdo rolável de acordo com a aba selecionada
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(scrollState)
                ) {
                    if (selectedAuthTab == 0) {
                        // =====================================================
                        // CONTEÚDO DA ABA OPERADOR (MANTIDO INTACTO)
                        // =====================================================
                        Text(
                            text = "SINCRONIZAÇÃO NUVEM (GOOGLE SHEETS & DRIVE)",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = PrimaryYellow,
                                letterSpacing = 1.sp
                            )
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Autenticação por Matrícula e Senha Individual com hash seguro e salt. Os produtos e fotos do Drive são salvos no celular para uso 100% offline.",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextMuted)
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        if (currentSession == null) {
                            // Formulário de Login do Operador
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = BackgroundDark,
                                border = BorderStroke(1.dp, SurfaceVariantDark),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "Acesso do Operador da Balança",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = TextLight
                                        )
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))

                                    OutlinedTextField(
                                        value = matriculaInput,
                                        onValueChange = { matriculaInput = it },
                                        label = { Text("Matrícula (ex: OP001)") },
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true,
                                        leadingIcon = {
                                            Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = PrimaryYellow, modifier = Modifier.size(20.dp))
                                        },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = PrimaryYellow,
                                            focusedLabelColor = PrimaryYellow,
                                            focusedTextColor = TextLight,
                                            unfocusedTextColor = TextLight
                                        )
                                    )

                                    Spacer(modifier = Modifier.height(8.dp))

                                    OutlinedTextField(
                                        value = senhaInput,
                                        onValueChange = { senhaInput = it },
                                        label = { Text("Senha Individual") },
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true,
                                        visualTransformation = PasswordVisualTransformation(),
                                        leadingIcon = {
                                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = PrimaryYellow, modifier = Modifier.size(20.dp))
                                        },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = PrimaryYellow,
                                            focusedLabelColor = PrimaryYellow,
                                            focusedTextColor = TextLight,
                                            unfocusedTextColor = TextLight
                                        )
                                    )

                                    loginError?.let { err ->
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(text = err, style = MaterialTheme.typography.bodySmall.copy(color = DangerRed))
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    Button(
                                        onClick = {
                                            if (matriculaInput.isBlank() || senhaInput.isBlank()) {
                                                loginError = "Informe a matrícula e a senha."
                                                return@Button
                                            }
                                            loginError = null
                                            isLoggingIn = true
                                            viewModel.loginOperator(matriculaInput, senhaInput) { success, msg ->
                                                isLoggingIn = false
                                                if (!success) {
                                                    loginError = msg
                                                } else {
                                                    senhaInput = ""
                                                }
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                                        shape = RoundedCornerShape(10.dp),
                                        enabled = !isLoggingIn
                                    ) {
                                        if (isLoggingIn) {
                                            Text("Autenticando...", color = BackgroundDark, fontWeight = FontWeight.Bold)
                                        } else {
                                            Text("Entrar & Sincronizar", color = BackgroundDark, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        } else {
                            // Painel de Operador Autenticado
                            val session = currentSession!!
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = BackgroundDark,
                                border = BorderStroke(1.dp, AccentGreen.copy(alpha = 0.5f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = AccentGreen, modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Column {
                                                Text(
                                                    text = session.nome,
                                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = TextLight)
                                                )
                                                Text(
                                                    text = "Matrícula: ${session.matricula} • Sessão Ativa",
                                                    style = MaterialTheme.typography.labelSmall.copy(color = AccentGreen)
                                                )
                                            }
                                        }
                                        TextButton(onClick = { viewModel.logoutOperator() }) {
                                            Text("Sair", color = DangerRed, fontSize = 12.sp)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    Button(
                                        onClick = {
                                            viewModel.syncWithSheets(context) { _, _ -> }
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                                        shape = RoundedCornerShape(10.dp),
                                        enabled = !isSyncingSheets
                                    ) {
                                        Icon(imageVector = Icons.Default.Refresh, contentDescription = null, tint = BackgroundDark, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = if (isSyncingSheets) "Sincronizando..." else "Sincronizar Catálogo Agora",
                                            color = BackgroundDark,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    if (isSyncingSheets && sheetsSyncNotice != null) {
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = sheetsSyncNotice!!,
                                            style = MaterialTheme.typography.labelSmall.copy(color = PrimaryYellow)
                                        )
                                    }
                                }
                            }
                        }

                    } else {
                        // =====================================================
                        // CONTEÚDO DA ABA ADMINISTRADOR (NOVA FUNCIONALIDADE)
                        // =====================================================
                        Text(
                            text = "ÁREA EXCLUSIVA DO ADMINISTRADOR (ADM)",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = PrimaryYellow,
                                letterSpacing = 1.sp
                            )
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Gerenciamento de operadores, credenciais e senhas com armazenamento na aba Operadores da planilha Google Sheets.",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextMuted)
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        if (currentAdminSession == null) {
                            // FORMULÁRIO DE LOGIN DO ADMINISTRADOR
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = BackgroundDark,
                                border = BorderStroke(1.dp, SurfaceVariantDark),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "Login do Administrador",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = TextLight
                                        )
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))

                                    OutlinedTextField(
                                        value = adminMatriculaInput,
                                        onValueChange = { adminMatriculaInput = it },
                                        label = { Text("Matrícula ADM") },
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true,
                                        leadingIcon = {
                                            Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = PrimaryYellow, modifier = Modifier.size(20.dp))
                                        },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = PrimaryYellow,
                                            focusedLabelColor = PrimaryYellow,
                                            focusedTextColor = TextLight,
                                            unfocusedTextColor = TextLight
                                        )
                                    )

                                    Spacer(modifier = Modifier.height(8.dp))

                                    OutlinedTextField(
                                        value = adminSenhaInput,
                                        onValueChange = { adminSenhaInput = it },
                                        label = { Text("Senha do Administrador") },
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true,
                                        visualTransformation = if (showAdminPassword) VisualTransformation.None else PasswordVisualTransformation(),
                                        leadingIcon = {
                                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = PrimaryYellow, modifier = Modifier.size(20.dp))
                                        },
                                        trailingIcon = {
                                            IconButton(onClick = { showAdminPassword = !showAdminPassword }) {
                                                Icon(
                                                    imageVector = if (showAdminPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                                    contentDescription = if (showAdminPassword) "Ocultar senha" else "Ver senha",
                                                    tint = TextMuted,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }
                                        },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = PrimaryYellow,
                                            focusedLabelColor = PrimaryYellow,
                                            focusedTextColor = TextLight,
                                            unfocusedTextColor = TextLight
                                        )
                                    )

                                    adminLoginError?.let { err ->
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(text = err, style = MaterialTheme.typography.bodySmall.copy(color = DangerRed))
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    Button(
                                        onClick = {
                                            if (adminMatriculaInput.isBlank() || adminSenhaInput.isBlank()) {
                                                adminLoginError = "Informe a matrícula e a senha de administrador."
                                                return@Button
                                            }
                                            adminLoginError = null
                                            viewModel.loginAdmin(adminMatriculaInput, adminSenhaInput) { success, msg ->
                                                if (!success) {
                                                    adminLoginError = msg
                                                } else {
                                                    adminSenhaInput = ""
                                                }
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                                        shape = RoundedCornerShape(10.dp),
                                        enabled = !isLoadingAdmin
                                    ) {
                                        if (isLoadingAdmin) {
                                            Text("Autenticando ADM...", color = BackgroundDark, fontWeight = FontWeight.Bold)
                                        } else {
                                            Text("Entrar como Administrador", color = BackgroundDark, fontWeight = FontWeight.Bold)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "A credencial padrão inicial é matrícula ADMIN. A senha provisória pode ser alterada no painel após o login.",
                                        style = MaterialTheme.typography.bodySmall.copy(color = TextMuted, fontSize = 11.sp)
                                    )
                                }
                            }
                        } else {
                            // PAINEL PROTEGIDO DO ADMINISTRADOR AUTENTICADO
                            val adminSession = currentAdminSession!!

                            // Status do Administrador e Botão Sair
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = BackgroundDark,
                                border = BorderStroke(1.dp, PrimaryYellow.copy(alpha = 0.5f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = PrimaryYellow, modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Column {
                                                Text(
                                                    text = "Administrador (${adminSession.matricula})",
                                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = TextLight)
                                                )
                                                Text(
                                                    text = "Sessão Administrativa Ativa",
                                                    style = MaterialTheme.typography.labelSmall.copy(color = AccentGreen)
                                                )
                                            }
                                        }
                                        TextButton(onClick = { viewModel.logoutAdmin() }) {
                                            Text("Sair ADM", color = DangerRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    // Botões de Ação Rápida
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        // Botão Cadastrar Novo Operador
                                        Button(
                                            onClick = { isCreateOpDialogOpen = true },
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                                        ) {
                                            Icon(imageVector = Icons.Default.Add, contentDescription = null, tint = BackgroundDark, modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Novo Operador", color = BackgroundDark, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        }

                                        // Botão Alterar Senha ADM
                                        OutlinedButton(
                                            onClick = { isChangeAdminPassDialogOpen = true },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(8.dp),
                                            border = BorderStroke(1.dp, PrimaryYellow.copy(alpha = 0.8f)),
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                                        ) {
                                            Text("Senha ADM", color = PrimaryYellow, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Header da Lista de Operadores com contador e botão Atualizar
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Operadores (${operatorsList.size} de $operatorsLimit)",
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = PrimaryYellow
                                    )
                                )
                                TextButton(
                                    onClick = { viewModel.loadOperatorsAdmin() },
                                    enabled = !isLoadingAdmin
                                ) {
                                    Icon(imageVector = Icons.Default.Refresh, contentDescription = null, tint = CodeHighlight, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = if (isLoadingAdmin) "Atualizando..." else "Atualizar",
                                        color = CodeHighlight,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            if (isLoadingAdmin && operatorsList.isEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(24.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = PrimaryYellow, modifier = Modifier.size(28.dp))
                                }
                            } else if (operatorsList.isEmpty()) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = BackgroundDark,
                                    border = BorderStroke(1.dp, SurfaceVariantDark),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text(
                                            text = "Nenhum operador cadastrado.",
                                            style = MaterialTheme.typography.bodyMedium.copy(color = TextMuted)
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Button(
                                            onClick = { isCreateOpDialogOpen = true },
                                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text("Cadastrar Primeiro Operador", color = BackgroundDark, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        }
                                    }
                                }
                            } else {
                                // Lista de Operadores Cadastrados
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    operatorsList.forEach { op ->
                                        OperatorCard(
                                            operator = op,
                                            onToggleStatus = {
                                                viewModel.toggleOperatorStatusAdmin(op.matricula, op.status) { _, msg ->
                                                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                                }
                                            },
                                            onEdit = {
                                                operatorToEdit = op
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("Fechar", color = TextMuted)
                }
            }
        }
    }

    // =========================================================================
    // MODAIS DE SUPORTE DO ADMINISTRADOR (CADASTRO, EDIÇÃO, TROCA DE SENHA)
    // =========================================================================

    // 1. Diálogo de Cadastrar Novo Operador
    if (isCreateOpDialogOpen) {
        CreateOperatorDialog(
            operatorsCount = operatorsList.size,
            operatorsLimit = operatorsLimit,
            onDismiss = { isCreateOpDialogOpen = false },
            onConfirm = { mat, nome, senha, onFinished ->
                viewModel.registerOperatorAdmin(mat, nome, senha) { success, msg ->
                    onFinished(success, msg)
                    if (success) {
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                        isCreateOpDialogOpen = false
                    }
                }
            }
        )
    }

    // 2. Diálogo de Editar Operador
    operatorToEdit?.let { op ->
        EditOperatorDialog(
            operator = op,
            onDismiss = { operatorToEdit = null },
            onConfirm = { mat, novoNome, novaSenha, status, onFinished ->
                viewModel.updateOperatorAdmin(mat, novoNome, novaSenha, status) { success, msg ->
                    onFinished(success, msg)
                    if (success) {
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                        operatorToEdit = null
                    }
                }
            }
        )
    }

    // 3. Diálogo de Alterar Senha do Administrador
    if (isChangeAdminPassDialogOpen) {
        ChangeAdminPasswordDialog(
            onDismiss = { isChangeAdminPassDialogOpen = false },
            onConfirm = { novaSenha, onFinished ->
                viewModel.changeAdminPassword(novaSenha) { success, msg ->
                    onFinished(success, msg)
                    if (success) {
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                        isChangeAdminPassDialogOpen = false
                    }
                }
            }
        )
    }
}

/**
 * Card para exibição de cada operador cadastrado
 */
@Composable
fun OperatorCard(
    operator: OperatorRecord,
    onToggleStatus: () -> Unit,
    onEdit: () -> Unit
) {
    val isAtivo = operator.status.trim().uppercase() == "ATIVO"

    Surface(
        shape = RoundedCornerShape(10.dp),
        color = BackgroundDark,
        border = BorderStroke(1.dp, if (isAtivo) SurfaceVariantDark else DangerRed.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            // Linha 1: Nome e Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = operator.nome,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = TextLight
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(6.dp))
                // Badge de Status
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = if (isAtivo) AccentGreen.copy(alpha = 0.2f) else DangerRed.copy(alpha = 0.2f),
                    border = BorderStroke(1.dp, if (isAtivo) AccentGreen else DangerRed)
                ) {
                    Text(
                        text = if (isAtivo) "ATIVO" else "INATIVO",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = if (isAtivo) AccentGreen else DangerRed,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Linha 2: Matrícula
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Matrícula: ${operator.matricula}",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = PrimaryYellow,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                )
                operator.criadoEm?.let {
                    Text(
                        text = it.take(10),
                        style = MaterialTheme.typography.labelSmall.copy(color = TextMuted, fontSize = 10.sp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Linha 3: Botões de Ação
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Alternar Status
                OutlinedButton(
                    onClick = onToggleStatus,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                    border = BorderStroke(1.dp, if (isAtivo) DangerRed.copy(alpha = 0.6f) else AccentGreen.copy(alpha = 0.6f)),
                    modifier = Modifier.height(28.dp)
                ) {
                    Text(
                        text = if (isAtivo) "Desativar" else "Ativar",
                        color = if (isAtivo) DangerRed else AccentGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Editar
                Button(
                    onClick = onEdit,
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SurfaceVariantDark),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                    modifier = Modifier.height(28.dp)
                ) {
                    Icon(imageVector = Icons.Default.Edit, contentDescription = null, tint = TextLight, modifier = Modifier.size(12.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Editar", color = TextLight, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * Diálogo para cadastrar novo operador antecipado
 */
@Composable
fun CreateOperatorDialog(
    operatorsCount: Int,
    operatorsLimit: Int,
    onDismiss: () -> Unit,
    onConfirm: (matricula: String, nome: String, senha: String, onFinished: (Boolean, String) -> Unit) -> Unit
) {
    var matricula by remember { mutableStateOf("") }
    var nome by remember { mutableStateOf("") }
    var senha by remember { mutableStateOf("") }
    var showSenha by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceDark,
            border = BorderStroke(1.dp, SurfaceVariantDark),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Cadastrar Novo Operador",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = PrimaryYellow
                    )
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Limite: $operatorsCount de $operatorsLimit operadores.",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextMuted)
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = matricula,
                    onValueChange = { matricula = it.uppercase() },
                    label = { Text("Matrícula (ex: OP001)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome Completo") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = senha,
                    onValueChange = { senha = it },
                    label = { Text("Senha Individual (mín. 12 caracteres)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = if (showSenha) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showSenha = !showSenha }) {
                            Icon(
                                imageVector = if (showSenha) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                errorMessage?.let { err ->
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = err, style = MaterialTheme.typography.bodySmall.copy(color = DangerRed))
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss, enabled = !isSubmitting) {
                        Text("Cancelar", color = TextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (matricula.isBlank()) {
                                errorMessage = "Informe a matrícula."
                                return@Button
                            }
                            if (nome.isBlank()) {
                                errorMessage = "Informe o nome do operador."
                                return@Button
                            }
                            if (senha.length < 12) {
                                errorMessage = "A senha deve conter no mínimo 12 caracteres."
                                return@Button
                            }
                            errorMessage = null
                            isSubmitting = true
                            onConfirm(matricula, nome, senha) { success, msg ->
                                isSubmitting = false
                                if (!success) errorMessage = msg
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !isSubmitting
                    ) {
                        Text(
                            text = if (isSubmitting) "Cadastrando..." else "Cadastrar",
                            color = BackgroundDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

/**
 * Diálogo para editar dados de operador existente
 */
@Composable
fun EditOperatorDialog(
    operator: OperatorRecord,
    onDismiss: () -> Unit,
    onConfirm: (matricula: String, novoNome: String?, novaSenha: String?, status: String?, onFinished: (Boolean, String) -> Unit) -> Unit
) {
    var nome by remember { mutableStateOf(operator.nome) }
    var novaSenha by remember { mutableStateOf("") }
    var showSenha by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf(operator.status.trim().uppercase()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceDark,
            border = BorderStroke(1.dp, SurfaceVariantDark),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Editar Operador: ${operator.matricula}",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = PrimaryYellow
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome do Operador") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = novaSenha,
                    onValueChange = { novaSenha = it },
                    label = { Text("Nova Senha (deixe vazio para manter)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = if (showSenha) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showSenha = !showSenha }) {
                            Icon(
                                imageVector = if (showSenha) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Seletor de Status (ATIVO / INATIVO)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Situação:", style = MaterialTheme.typography.bodySmall.copy(color = TextLight))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(
                            selected = status == "ATIVO",
                            onClick = { status = "ATIVO" },
                            label = { Text("ATIVO") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = AccentGreen,
                                selectedLabelColor = BackgroundDark
                            )
                        )
                        FilterChip(
                            selected = status == "INATIVO",
                            onClick = { status = "INATIVO" },
                            label = { Text("INATIVO") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = DangerRed,
                                selectedLabelColor = TextLight
                            )
                        )
                    }
                }

                errorMessage?.let { err ->
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = err, style = MaterialTheme.typography.bodySmall.copy(color = DangerRed))
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss, enabled = !isSubmitting) {
                        Text("Cancelar", color = TextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (nome.isBlank()) {
                                errorMessage = "O nome não pode ficar vazio."
                                return@Button
                            }
                            if (novaSenha.isNotEmpty() && novaSenha.length < 12) {
                                errorMessage = "A nova senha deve ter no mínimo 12 caracteres."
                                return@Button
                            }
                            errorMessage = null
                            isSubmitting = true
                            val senhaParam = if (novaSenha.isBlank()) null else novaSenha
                            onConfirm(operator.matricula, nome, senhaParam, status) { success, msg ->
                                isSubmitting = false
                                if (!success) errorMessage = msg
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !isSubmitting
                    ) {
                        Text(
                            text = if (isSubmitting) "Salvando..." else "Salvar Alterações",
                            color = BackgroundDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

/**
 * Diálogo para alterar a senha da própria conta Administrador
 */
@Composable
fun ChangeAdminPasswordDialog(
    onDismiss: () -> Unit,
    onConfirm: (novaSenha: String, onFinished: (Boolean, String) -> Unit) -> Unit
) {
    var novaSenha by remember { mutableStateOf("") }
    var confirmacao by remember { mutableStateOf("") }
    var showSenha by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceDark,
            border = BorderStroke(1.dp, SurfaceVariantDark),
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Alterar Senha do Administrador",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = PrimaryYellow
                    )
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "A nova senha deve ter no mínimo 12 caracteres e será gravada com PBKDF2 e novo salt no Apps Script.",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextMuted)
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = novaSenha,
                    onValueChange = { novaSenha = it },
                    label = { Text("Nova Senha ADM") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = if (showSenha) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showSenha = !showSenha }) {
                            Icon(
                                imageVector = if (showSenha) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = confirmacao,
                    onValueChange = { confirmacao = it },
                    label = { Text("Confirmar Nova Senha") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = if (showSenha) VisualTransformation.None else PasswordVisualTransformation(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryYellow,
                        focusedLabelColor = PrimaryYellow,
                        focusedTextColor = TextLight,
                        unfocusedTextColor = TextLight
                    )
                )

                errorMessage?.let { err ->
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = err, style = MaterialTheme.typography.bodySmall.copy(color = DangerRed))
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss, enabled = !isSubmitting) {
                        Text("Cancelar", color = TextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (novaSenha.length < 12) {
                                errorMessage = "A nova senha deve ter no mínimo 12 caracteres."
                                return@Button
                            }
                            if (novaSenha != confirmacao) {
                                errorMessage = "As senhas digitadas não coincidem."
                                return@Button
                            }
                            errorMessage = null
                            isSubmitting = true
                            onConfirm(novaSenha) { success, msg ->
                                isSubmitting = false
                                if (!success) errorMessage = msg
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryYellow),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !isSubmitting
                    ) {
                        Text(
                            text = if (isSubmitting) "Salvando..." else "Atualizar Senha",
                            color = BackgroundDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}


