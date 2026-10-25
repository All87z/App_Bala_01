import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Scale,
  Copy,
  Check,
  Edit2,
  Trash2,
  History,
  Download,
  Upload,
  Smartphone,
  X,
  Info,
  ImagePlus,
  FileSpreadsheet,
} from 'lucide-react';
import { Product, RecentProduct } from './types';
import {
  getSavedProducts,
  saveProducts,
  getRecentProducts,
  addRecentProduct,
  removeRecentByCode,
  restoreFromIndexedDbIfEmpty,
  saveLocalAvailability,
} from './utils/storage';
import { matchProduct, getDisplayProductName } from './utils/textNormalizer';
import { downloadCsvFile } from './utils/csv';
import { processGalleryImage } from './utils/imageHelper';
import { SpotlightModal } from './components/SpotlightModal';
import { ProductFormModal } from './components/ProductFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { VoiceSearchButton } from './components/VoiceSearchButton';
import { AndroidProjectModal } from './components/AndroidProjectModal';
import { DataBackupModal } from './components/DataBackupModal';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modais
  const [spotlightProduct, setSpotlightProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isDataBackupModalOpen, setIsDataBackupModalOpen] = useState(false);

  // Notificação / Aviso amigável (ex: voz offline ou sucesso)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carrega produtos do armazenamento local offline na inicialização
  useEffect(() => {
    const loaded = getSavedProducts();
    setProducts(loaded);
    setRecentProducts(getRecentProducts());

    // Se o localStorage estava limpo/vazio, recupera do IndexedDB de contingência
    restoreFromIndexedDbIfEmpty().then((idbProducts) => {
      if (idbProducts && idbProducts.length > 0) {
        setProducts(idbProducts);
      }
    });
  }, []);

  // Mostra aviso temporário
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 5000);
  };

  // Copia código para a área de transferência
  const handleCopyCode = (code: string, productName: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    showToast(`Código ${code} copiado (${getDisplayProductName(productName)})`);
  };

  // Alterna situação Disponível/Esgotado exclusivamente neste aparelho (sem alterar planilha)
  const handleToggleAvailability = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = !(product.isAvailable !== false);
    saveLocalAvailability(product.code, newStatus);
    const updated = products.map((p) =>
      p.code.toLowerCase() === product.code.toLowerCase()
        ? { ...p, isAvailable: newStatus, updatedAt: Date.now() }
        : p
    );
    setProducts(updated);
    saveProducts(updated);
    if (spotlightProduct && spotlightProduct.code.toLowerCase() === product.code.toLowerCase()) {
      setSpotlightProduct({ ...spotlightProduct, isAvailable: newStatus });
    }
    showToast(
      `"${getDisplayProductName(product)}" marcado como ${newStatus ? 'Disponível' : 'Esgotado'} neste aparelho.`
    );
  };

  // Ao selecionar um produto (abre o destaque colossal e grava em recentes)
  const handleSelectProduct = (product: Product) => {
    setSpotlightProduct(product);
    const updatedRecents = addRecentProduct(product.code, getDisplayProductName(product));
    setRecentProducts(updatedRecents);
  };

  // Ref para seleção direta de imagem da galeria a partir do card
  const cardImageInputRef = useRef<HTMLInputElement>(null);
  const [productForCardImage, setProductForCardImage] = useState<string | null>(null);

  const handleCardImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !productForCardImage) return;
    try {
      const compressed = await processGalleryImage(file);
      const updated = products.map((p) =>
        p.id === productForCardImage ? { ...p, imageUrl: compressed, updatedAt: Date.now() } : p
      );
      setProducts(updated);
      saveProducts(updated);
      showToast('Imagem da galeria adicionada com sucesso!');
    } catch {
      showToast('Erro ao carregar foto da galeria.');
    } finally {
      setProductForCardImage(null);
      e.target.value = '';
    }
  };

  // Salvar novo produto ou atualizar existente (toda edição é centralizada aqui)
  const handleSaveProduct = (
    name: string,
    code: string,
    idToEdit?: string,
    imageUrl?: string,
    price?: string,
    unit?: string,
    isAvailable?: boolean
  ) => {
    let updated: Product[];
    // Se imageUrl for string vazia '', significa que a foto foi explicitamente removida
    const finalImageUrl = imageUrl === '' ? undefined : imageUrl;

    if (idToEdit) {
      updated = products.map((p) =>
        p.id === idToEdit
          ? {
              ...p,
              name,
              code,
              imageUrl: imageUrl !== undefined ? finalImageUrl : p.imageUrl,
              price: price !== undefined ? price : p.price,
              unit: unit !== undefined ? unit : p.unit,
              isAvailable: isAvailable !== undefined ? isAvailable : (p.isAvailable ?? true),
              updatedAt: Date.now(),
            }
          : p
      );
      showToast(`Produto "${name}" atualizado com sucesso!`);
    } else {
      const newProd: Product = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        code,
        imageUrl: finalImageUrl,
        price: price || '',
        unit: unit || 'kg',
        isAvailable: isAvailable ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updated = [newProd, ...products];
      showToast(`Produto "${name}" cadastrado com sucesso!`);
    }
    setProducts(updated);
    saveProducts(updated);
    // Limpa a busca para que o produto recém-cadastrado apareça imediatamente na lista
    setSearchQuery('');
  };

  // Confirmar exclusão de produto
  const handleConfirmDelete = (product: Product) => {
    const updated = products.filter((p) => p.id !== product.id);
    setProducts(updated);
    saveProducts(updated);
    removeRecentByCode(product.code);
    setRecentProducts(getRecentProducts());
    showToast(`Produto "${product.name}" removido.`);
  };

  // Exportar CSV direto
  const handleExportCsv = () => {
    downloadCsvFile(products, 'produtos_balanca.csv');
    showToast('Arquivo CSV baixado com sucesso!');
  };

  // Importar CSV vindo do modal de Importar/Exportar dados
  const handleImportProductsFromCsv = (
    importedList: Array<{
      name: string;
      code: string;
      price?: string;
      unit?: string;
      isAvailable?: boolean;
    }>,
    mode: 'merge' | 'skipDuplicates' | 'replace'
  ) => {
    let result: Product[] = [];

    if (mode === 'replace') {
      result = importedList.map((item) => ({
        id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        code: item.code,
        price: item.price || '',
        unit: item.unit || 'kg',
        isAvailable: item.isAvailable ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      showToast(`${result.length} produtos importados (catálogo substituído).`);
    } else if (mode === 'skipDuplicates') {
      const existingCodes = new Set(products.map((p) => p.code.toLowerCase()));
      const newOnly = importedList.filter((item) => !existingCodes.has(item.code.toLowerCase()));
      const newItems: Product[] = newOnly.map((item) => ({
        id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        code: item.code,
        price: item.price || '',
        unit: item.unit || 'kg',
        isAvailable: item.isAvailable ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      result = [...newItems, ...products];
      showToast(`${newItems.length} novos produtos adicionados (duplicados mantidos).`);
    } else {
      // merge (Recomendado): atualiza dados existentes preservando as fotos, e adiciona novos
      const currentMap = new Map(products.map((p) => [p.code.toLowerCase(), { ...p }]));
      let updatedCount = 0;
      let newCount = 0;

      for (const item of importedList) {
        const existing = currentMap.get(item.code.toLowerCase());
        if (existing) {
          existing.name = item.name;
          if (item.price !== undefined) existing.price = item.price;
          if (item.unit !== undefined) existing.unit = item.unit;
          if (item.isAvailable !== undefined) existing.isAvailable = item.isAvailable;
          existing.updatedAt = Date.now();
          // Preserva foto existente do produto!
          updatedCount++;
        } else {
          const fresh: Product = {
            id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: item.name,
            code: item.code,
            price: item.price || '',
            unit: item.unit || 'kg',
            isAvailable: item.isAvailable ?? true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          currentMap.set(item.code.toLowerCase(), fresh);
          newCount++;
        }
      }
      result = Array.from(currentMap.values());
      showToast(`CSV importado: ${newCount} novos, ${updatedCount} atualizados.`);
    }

    setProducts(result);
    saveProducts(result);
  };

  // Restaurar Backup Completo com Fotos
  const handleRestoreFullBackup = (restored: Product[]) => {
    setProducts(restored);
    saveProducts(restored);
    showToast(`Backup completo restaurado com sucesso! (${restored.length} produtos)`);
  };

  // Filtro em tempo real: ignora acentos, maiúsculas e busca por nome ou código
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    return products.filter((p) => matchProduct(p.name, p.code, searchQuery));
  }, [products, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Barra Superior / Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Scale className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none flex items-center gap-2">
                Assistente de Balança
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {products.length} produtos cadastrados • 100% Offline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Botão Ver Código & Gerar APK Android */}
            <button
              onClick={() => setIsAndroidModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-all shadow-sm"
              title="Ver código nativo e instruções para gerar o APK"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Gerar APK Android</span>
            </button>

            {/* Área Simples: Importar/Exportar Dados (CSV e Fotos) */}
            <button
              onClick={() => setIsDataBackupModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700 text-xs font-bold transition-all shadow-sm"
              title="Área de Importar/Exportar dados e backup de fotos"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="hidden md:inline">Importar/Exportar dados</span>
              <span className="md:hidden">Backup</span>
            </button>

            {/* Atalho Exportar CSV Rápido */}
            <button
              onClick={handleExportCsv}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Baixar arquivo CSV direto"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Atalho Importar CSV (Abre área de prévia segura) */}
            <button
              onClick={() => setIsDataBackupModalOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Importar produtos de arquivo CSV"
            >
              <Upload className="w-4 h-4" />
            </button>

            <input
              type="file"
              ref={cardImageInputRef}
              onChange={handleCardImageChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col pb-24">
        {/* Banner para celulares sobre o APK nativo */}
        <div className="sm:hidden mb-3">
          <button
            onClick={() => setIsAndroidModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 flex items-center justify-between text-xs font-semibold"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Ver projeto nativo Kotlin e gerar APK</span>
            </span>
            <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-300">
              Ver
            </span>
          </button>
        </div>

        {/* CAMPO DE PESQUISA GRANDE NO TOPO */}
        <div className="relative mb-4">
          <div className="relative flex items-center bg-slate-900 border-2 border-slate-700 focus-within:border-amber-400 rounded-2xl shadow-xl transition-all">
            <div className="pl-4 pr-2 text-amber-400">
              <Search className="w-7 h-7" />
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar produto ou código..."
              className="w-full py-4 pr-3 bg-transparent text-white placeholder-slate-500 text-lg sm:text-xl font-medium focus:outline-none"
              autoComplete="off"
              autoFocus
            />

            {/* Limpar busca se houver texto */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Limpar pesquisa"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Botão de Microfone para Pesquisa por Voz em pt-BR com Verificação Offline */}
            <div className="pr-2 pl-1">
              <VoiceSearchButton
                onTranscript={(transcript) => {
                  setSearchQuery(transcript);
                  showToast(`Pesquisando por: "${transcript}"`);
                }}
                onNotice={(notice) => showToast(notice)}
              />
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÕES CLARAS: EXPORTAR CSV E IMPORTAR CSV (sempre visível em smartphones e desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800/90 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95"
            title="Exportar todos os produtos para CSV (compatível com Excel e UTF-8)"
          >
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsDataBackupModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-400/50 hover:bg-slate-800/90 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95"
            title="Importar catálogo de produtos de arquivo CSV com prévia e validação"
          >
            <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Importar CSV</span>
          </button>

          <button
            onClick={() => setIsDataBackupModalOpen(true)}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-400/50 hover:bg-slate-800/90 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95"
            title="Backup completo com fotos em ZIP e restauração segura"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Backup com Fotos</span>
          </button>
        </div>

        {/* Notificação Toast Flutuante */}
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-slate-900 border border-amber-500/50 rounded-2xl text-amber-200 text-sm flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <Info className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SEÇÃO DE PRODUTOS RECENTES (ÚLTIMOS CONSULTADOS) */}
        {recentProducts.length > 0 && !searchQuery && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">
              <History className="w-4 h-4" />
              <span>Consultados Recentemente</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {recentProducts.map((recent) => (
                <button
                  key={recent.code}
                  onClick={() => setSearchQuery(recent.code)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 rounded-xl shrink-0 transition-colors"
                >
                  <span className="font-mono font-black text-amber-400 text-base">
                    {recent.code}
                  </span>
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[140px]">
                    {getDisplayProductName(recent.name)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LISTA DE RESULTADOS */}
        <div className="space-y-2.5">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 border border-slate-800/80 rounded-3xl">
              <Scale className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300 mb-1">
                Nenhum produto encontrado
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                {searchQuery
                  ? `Não encontramos resultados para "${searchQuery}".`
                  : 'Sincronize com a planilha Google Sheets ou importe os produtos via CSV.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setIsDataBackupModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold text-sm shadow-md transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                  <span>Sincronizar / Importar dados</span>
                </button>
              </div>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="group cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-400/60 rounded-2xl p-3.5 sm:p-5 flex items-start justify-between gap-3 sm:gap-4 transition-all duration-150 hover:shadow-xl hover:shadow-amber-500/5 active:scale-[0.99]"
              >
                {/* 2. FOTO QUADRADA PROPORCIONAL: 64px no mobile, 72px no tablet (faixa 56px a 72px) */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setProductForCardImage(product.id);
                    cardImageInputRef.current?.click();
                  }}
                  className="relative shrink-0 group/img cursor-pointer mt-0.5"
                  title={
                    product.imageUrl
                      ? 'Toque para trocar a imagem da galeria'
                      : 'Toque para adicionar foto da galeria'
                  }
                >
                  {product.imageUrl ? (
                    <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 border border-slate-700/80 group-hover:border-amber-400 transition-all shadow-md flex items-center justify-center shrink-0">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-xl sm:rounded-2xl">
                        <ImagePlus className="w-5 h-5 text-amber-300" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl sm:rounded-2xl bg-slate-950 border border-dashed border-slate-700 group-hover:border-amber-400 flex flex-col items-center justify-center text-slate-500 group-hover:text-amber-400 transition-colors shadow-inner shrink-0">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[9px] font-bold mt-0.5 tracking-tight text-slate-400">
                        + Foto
                      </span>
                    </div>
                  )}
                </div>

                {/* COLUNA PRINCIPAL: HIERARQUIA VISUAL DA IMAGEM DE REFERÊNCIA */}
                <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                  {/* 1. CÓDIGO DO PRODUTO: MAIOR DESTAQUE VISUAL */}
                  <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-wider leading-none">
                    {product.code}
                  </div>

                  {/* 3. NOME REAL DO PRODUTO: SEM PREFIXO DE CATEGORIA */}
                  <h4
                    className={`text-base sm:text-lg font-bold leading-snug transition-colors break-words w-full ${
                      product.isAvailable !== false
                        ? 'text-white group-hover:text-amber-300'
                        : 'text-slate-300 line-through decoration-rose-500/60'
                    }`}
                  >
                    {getDisplayProductName(product)}
                  </h4>

                  {/* 4. STATUS DISPONÍVEL OU ESGOTADO: INTERATIVO E ARMAZENADO LOCALMENTE */}
                  <div className="my-0.5">
                    <button
                      type="button"
                      onClick={(e) => handleToggleAvailability(product, e)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold tracking-wide shrink-0 transition-all active:scale-95 cursor-pointer shadow-sm ${
                        product.isAvailable !== false
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400'
                          : 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400'
                      }`}
                      title="Toque para alternar entre Disponível e Esgotado neste aparelho"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          product.isAvailable !== false ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span>{product.isAvailable !== false ? 'Disponível' : 'Esgotado'}</span>
                    </button>
                  </div>

                  {/* 5. PREÇO E UNIDADE JUNTOS NA MESMA LINHA: EX: R$ 8,99 / kg */}
                  <div className="flex items-center">
                    {product.price ? (
                      <div className="inline-flex items-baseline gap-1 font-mono font-extrabold text-emerald-400 text-sm sm:text-base bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 shadow-inner">
                        <span className="text-xs text-emerald-500 font-bold">R$</span>
                        <span className="tracking-tight">{product.price}</span>
                        <span className="text-xs text-slate-400 font-normal">
                          / {product.unit || 'kg'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium italic">
                        Preço a definir
                      </span>
                    )}
                  </div>
                </div>

                {/* LADO DIREITO: BOTÃO DE AÇÃO RÁPIDA (COPIAR CÓDIGO) */}
                <div
                  className="shrink-0 flex items-center pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleCopyCode(product.code, product.name)}
                    className={`p-2 sm:p-2.5 rounded-xl transition-colors ${
                      copiedCode === product.code
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                    }`}
                    title="Copiar código com 1 toque"
                  >
                    {copiedCode === product.code ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal de Destaque com Dígitos Gigantes */}
      <SpotlightModal
        product={spotlightProduct}
        onClose={() => setSpotlightProduct(null)}
        onCopy={handleCopyCode}
        onToggleAvailability={handleToggleAvailability}
      />


      {/* Modal de Confirmação de Exclusão */}
      <DeleteConfirmModal
        product={productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal com Guia do APK e Código Nativo Android */}
      <AndroidProjectModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />

      {/* Modal da Área: Importar/Exportar Dados (CSV com prévia segura, Backup com Fotos e Sincronização Sheets) */}
      <DataBackupModal
        isOpen={isDataBackupModalOpen}
        products={products}
        onClose={() => setIsDataBackupModalOpen(false)}
        onImportProducts={handleImportProductsFromCsv}
        onRestoreFullBackup={handleRestoreFullBackup}
        onUpdateProducts={(updated) => {
          setProducts(updated);
          saveProducts(updated);
          showToast(`Catálogo sincronizado com a nuvem (${updated.length} produtos)!`);
        }}
      />
    </div>
  );
}
