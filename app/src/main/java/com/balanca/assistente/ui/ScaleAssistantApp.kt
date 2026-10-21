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
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Search
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
import com.balanca.assistente.data.RecentProduct
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
    val recentProducts by viewModel.recentProducts.collectAsState()
    val selectedSpotlight by viewModel.selectedSpotlightProduct.collectAsState()
    val isAddEditDialogOpen by viewModel.isAddEditDialogOpen.collectAsState()
    val productToEdit by viewModel.productToEdit.collectAsState()
    val productToDelete by viewModel.productToDelete.collectAsState()
    val formErrorMessage by viewModel.formErrorMessage.collectAsState()
    val statusNotice by viewModel.statusNotice.collectAsState()
    val isListening by viewModel.isListening.collectAsState()

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
                actions = {
                    IconButton(
                        onClick = { isDataBackupDialogOpen = true }
                    ) {
                        Icon(
                            imageVector = Icons.Default.FileDownload,
                            contentDescription = "Importar / Exportar Dados",
                            tint = PrimaryYellow
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BackgroundDark
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { viewModel.openAddDialog() },
                containerColor = PrimaryYellow,
                contentColor = BackgroundDark,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.height(48.dp),
                icon = {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Adicionar Produto",
                        modifier = Modifier.size(22.dp)
                    )
                },
                text = {
                    Text(
                        text = "Novo Produto",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    )
                }
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

            // Seção de Produtos Recentes
            if (recentProducts.isNotEmpty() && searchQuery.isBlank()) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = "Recentes",
                        tint = CodeHighlight,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "CONSULTADOS RECENTEMENTE",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = CodeHighlight,
                            letterSpacing = 1.sp
                        )
                    )
                }

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 4.dp)
                ) {
                    items(recentProducts, key = { it.code }) { recent ->
                        RecentProductChip(
                            recent = recent,
                            onClick = {
                                viewModel.setSearchQuery(recent.code)
                            }
                        )
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
                            text = if (searchQuery.isNotEmpty()) "Tente outro nome ou código" else "Clique em \"Novo Produto\" para começar",
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
                            onCopyClick = { copyCode(product.code, product.name) },
                            onEditClick = { viewModel.openEditDialog(product) },
                            onDeleteClick = { viewModel.requestDeleteConfirmation(product) }
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
            onCopy = { copyCode(product.code, product.name) }
        )
    }

    // Modal de Cadastro / Edição
    if (isAddEditDialogOpen) {
        ProductFormDialog(
            productToEdit = productToEdit,
            errorMessage = formErrorMessage,
            onDismiss = { viewModel.closeAddEditDialog() },
            onSave = { name, code, imageUri, price, unit, isAvailable ->
                viewModel.saveProduct(name, code, imageUri, price, unit, isAvailable)
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
 * Chip para produto consultado recentemente
 */
@Composable
fun RecentProductChip(
    recent: RecentProduct,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = SurfaceDark,
        border = BorderStroke(1.dp, SurfaceVariantDark)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = recent.code,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.ExtraBold,
                    color = PrimaryYellow
                )
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = recent.name,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = TextLight,
                    fontWeight = FontWeight.Medium
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
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
    onCopyClick: () -> Unit,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit
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
                    // 2. FOTO QUADRADA PROPORCIONAL: 64dp (faixa entre 56dp e 72dp)
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = BackgroundDark,
                        border = BorderStroke(1.dp, SurfaceVariantDark),
                        modifier = Modifier.size(64.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Image,
                                contentDescription = "Foto do produto",
                                tint = PrimaryYellow,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }

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

                        // 3. NOME COMPLETO: LEGÍVEL E COM QUEBRA AUTOMÁTICA DE LINHA
                        Text(
                            text = product.name,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextLight,
                                lineHeight = 20.sp
                            ),
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        // 4. STATUS DISPONÍVEL OU ESGOTADO: SEMPRE VISÍVEL
                        Surface(
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

                    Spacer(modifier = Modifier.width(8.dp))

                    // LADO DIREITO: AÇÕES (COPIAR, EDITAR, EXCLUIR)
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        IconButton(
                            onClick = onCopyClick,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "Copiar Código",
                                tint = CodeHighlight,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        IconButton(
                            onClick = onEditClick,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "Editar",
                                tint = TextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        IconButton(
                            onClick = onDeleteClick,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Excluir",
                                tint = DangerRed.copy(alpha = 0.85f),
                                modifier = Modifier.size(18.dp)
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
                    // Imagem de Referência Visual ANTES da palavra / nome
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = BackgroundDark,
                        border = BorderStroke(1.dp, SurfaceVariantDark),
                        modifier = Modifier.size(50.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Image,
                                contentDescription = "Foto do produto",
                                tint = PrimaryYellow,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Nome do Produto, Status e Preço
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = product.name,
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

                            // Badge de Disponibilidade
                            Surface(
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

                        // Ações Rápidas (Copiar, Editar, Excluir)
                        Column {
                            IconButton(
                                onClick = onCopyClick,
                                modifier = Modifier.size(34.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ContentCopy,
                                    contentDescription = "Copiar Código",
                                    tint = CodeHighlight,
                                    modifier = Modifier.size(20.dp)
                                )
                            }

                            Row {
                                IconButton(
                                    onClick = onEditClick,
                                    modifier = Modifier.size(30.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Editar",
                                        tint = TextMuted,
                                        modifier = Modifier.size(17.dp)
                                    )
                                }
                                IconButton(
                                    onClick = onDeleteClick,
                                    modifier = Modifier.size(30.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Excluir",
                                        tint = DangerRed.copy(alpha = 0.8f),
                                        modifier = Modifier.size(17.dp)
                                    )
                                }
                            }
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
    onCopy: () -> Unit
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
                    text = product.name,
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = TextLight,
                        textAlign = TextAlign.Center
                    )
                )
                Spacer(modifier = Modifier.height(20.dp))

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
    var name by remember { mutableStateOf(productToEdit?.name ?: "") }
    var code by remember { mutableStateOf(productToEdit?.code ?: "") }
    var price by remember { mutableStateOf(productToEdit?.price ?: "") }
    var unit by remember { mutableStateOf(productToEdit?.unit ?: "kg") }
    var isAvailable by remember { mutableStateOf(productToEdit?.isAvailable ?: true) }
    var imageUri by remember { mutableStateOf(productToEdit?.imageUri) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { imageUri = it.toString() }
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

                // Seletor de Disponibilidade: Disponível ou Esgotado
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { isAvailable = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isAvailable) AccentGreen else SurfaceVariantDark,
                            contentColor = if (isAvailable) Color.White else TextMuted
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Disponível", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }

                    Button(
                        onClick = { isAvailable = false },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (!isAvailable) DangerRed else SurfaceVariantDark,
                            contentColor = if (!isAvailable) Color.White else TextMuted
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Esgotado", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
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
                        text = if (imageUri != null) "Trocar Foto da Galeria" else "Adicionar Foto da Galeria",
                        color = TextLight
                    )
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
