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
  AlertTriangle,
  Info,
  Sparkles,
  ImagePlus,
} from 'lucide-react';
import { Product, RecentProduct } from './types';
import {
  getSavedProducts,
  saveProducts,
  getRecentProducts,
  addRecentProduct,
  removeRecentByCode,
} from './utils/storage';
import { matchProduct } from './utils/textNormalizer';
import { downloadCsvFile, parseCsvContent } from './utils/csv';
import { processGalleryImage } from './utils/imageHelper';
import { SpotlightModal } from './components/SpotlightModal';
import { ProductFormModal } from './components/ProductFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { VoiceSearchButton } from './components/VoiceSearchButton';
import { AndroidProjectModal } from './components/AndroidProjectModal';

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

  // Notificação / Aviso amigável (ex: voz offline ou sucesso)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega produtos do armazenamento local offline na inicialização
  useEffect(() => {
    const loaded = getSavedProducts();
    setProducts(loaded);
    setRecentProducts(getRecentProducts());
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
    showToast(`Código ${code} copiado (${productName})`);
  };

  // Ao selecionar um produto (abre o destaque colossal e grava em recentes)
  const handleSelectProduct = (product: Product) => {
    setSpotlightProduct(product);
    const updatedRecents = addRecentProduct(product.code, product.name);
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
    if (idToEdit) {
      updated = products.map((p) =>
        p.id === idToEdit
          ? {
              ...p,
              name,
              code,
              imageUrl: imageUrl !== undefined ? imageUrl : p.imageUrl,
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
        imageUrl,
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

  // Exportar CSV
  const handleExportCsv = () => {
    downloadCsvFile(products, 'produtos_balanca.csv');
    showToast('Arquivo CSV baixado com sucesso!');
  };

  // Importar CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCsvContent(text);
        if (parsed.length === 0) {
          showToast('Nenhum produto válido encontrado no arquivo CSV.');
          return;
        }

        const currentMap = new Map(products.map((p) => [p.code.toLowerCase(), p]));
        let importedCount = 0;

        const newItems: Product[] = [];
        for (const item of parsed) {
          const existing = currentMap.get(item.code.toLowerCase());
          if (existing) {
            existing.name = item.name;
            if (item.price !== undefined) existing.price = item.price;
            if (item.unit !== undefined) existing.unit = item.unit;
            if (item.isAvailable !== undefined) existing.isAvailable = item.isAvailable;
            existing.updatedAt = Date.now();
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
            newItems.push(fresh);
          }
          importedCount++;
        }

        const merged = Array.from(currentMap.values());
        setProducts(merged);
        saveProducts(merged);
        showToast(`${importedCount} produtos importados do CSV com sucesso!`);
      } catch (err) {
        showToast('Erro ao processar o arquivo CSV.');
      }
    };
    reader.readAsText(file);
    // Limpa o valor do input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
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

          <div className="flex items-center gap-2">
            {/* Botão Ver Código & Gerar APK Android */}
            <button
              onClick={() => setIsAndroidModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-all shadow-sm"
              title="Ver código nativo e instruções para gerar o APK"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Gerar APK Android</span>
            </button>

            {/* Exportar CSV */}
            <button
              onClick={handleExportCsv}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Exportar produtos para arquivo CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Importar CSV */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Importar produtos de arquivo CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              className="hidden"
            />
            <input
              type="file"
              ref={cardImageInputRef}
              onChange={handleCardImageChange}
              accept="image/*"
              className="hidden"
            />

            {/* Botão Adicionar Produto */}
            <button
              onClick={() => {
                setProductToEdit(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden xs:inline">Novo Produto</span>
              <span className="xs:hidden">Novo</span>
            </button>
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
                    {recent.name}
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
                  ? `Não encontramos resultados para "${searchQuery}". Deseja cadastrar agora?`
                  : 'Comece adicionando seu primeiro produto ou importando um arquivo CSV.'}
              </p>
              <button
                onClick={() => {
                  setProductToEdit(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Produto</span>
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="group cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-400/60 rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 transition-all duration-150 hover:shadow-xl hover:shadow-amber-500/5 active:scale-[0.99]"
              >
                {/* TOPO NO SMARTPHONE VERTICAL / LADO ESQUERDO NO TABLET E HORIZONTAL */}
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  {/* Imagem de Referência da Galeria ANTES da palavra */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setProductForCardImage(product.id);
                      cardImageInputRef.current?.click();
                    }}
                    className="relative shrink-0 group/img cursor-pointer mt-0.5 sm:mt-0"
                    title={
                      product.imageUrl
                        ? 'Toque para trocar a imagem da galeria'
                        : 'Toque para adicionar foto da galeria'
                    }
                  >
                    {product.imageUrl ? (
                      <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-700/80 group-hover:border-amber-400 transition-all shadow-md flex items-center justify-center">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                          <ImagePlus className="w-5 h-5 text-amber-300" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 group-hover:border-amber-400 flex flex-col items-center justify-center text-slate-500 group-hover:text-amber-400 transition-colors shadow-inner">
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[9px] font-bold mt-0.5 tracking-tight text-slate-400">
                          + Foto
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Nome do Produto, Status e Preço (Tablet/Horizontal) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4
                        className={`text-base sm:text-xl font-bold transition-colors break-words sm:truncate ${
                          product.isAvailable !== false
                            ? 'text-white group-hover:text-amber-300'
                            : 'text-slate-300 line-through decoration-rose-500/60'
                        }`}
                      >
                        {product.name}
                      </h4>

                      {/* BADGE DE DISPONIBILIDADE: DISPONÍVEL OU ESGOTADO */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold tracking-wide shrink-0 ${
                          product.isAvailable !== false
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            product.isAvailable !== false
                              ? 'bg-emerald-400'
                              : 'bg-rose-400'
                          }`}
                        />
                        {product.isAvailable !== false ? 'Disponível' : 'Esgotado'}
                      </span>
                    </div>

                    {/* PREÇO DE BALANÇA NO TABLET / HORIZONTAL (ESCONDIDO NO MOBILE VERTICAL POIS VAI PARA A LINHA INFERIOR) */}
                    <div className="hidden sm:flex items-center gap-2.5 flex-wrap">
                      {product.price ? (
                        <div className="inline-flex items-baseline gap-1 font-mono font-extrabold text-emerald-400 text-sm sm:text-base bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 shadow-inner">
                          <span className="text-[10px] text-emerald-500 font-bold">R$</span>
                          <span>{product.price}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            /{product.unit || 'kg'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">
                          Preço sob consulta
                        </span>
                      )}

                      <span className="text-[11px] text-slate-500">
                        • Toque no card para ver código ampliado
                      </span>
                    </div>
                  </div>
                </div>

                {/* LINHA INFERIOR NO MOBILE VERTICAL / LADO DIREITO NO TABLET E HORIZONTAL */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2.5 sm:pt-0 border-t border-slate-800/80 sm:border-0">
                  {/* PREÇO COMPLETO NO MOBILE VERTICAL (ESCONDIDO NO TABLET) */}
                  <div className="sm:hidden flex items-center min-w-0">
                    {product.price ? (
                      <div className="inline-flex items-baseline gap-1 font-mono font-extrabold text-emerald-400 text-sm bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                        <span className="text-[10px] text-emerald-500 font-bold">R$</span>
                        <span className="tracking-tight">{product.price}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          /{product.unit || 'kg'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium italic">
                        Preço a definir
                      </span>
                    )}
                  </div>

                  {/* CÓDIGO E AÇÕES (COPIAR, EDITAR, EXCLUIR) */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* CÓDIGO EM NÚMEROS MUITO GRANDES E FÁCEIS DE LER */}
                    <div className="bg-slate-950 border-2 border-amber-400/80 rounded-xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-center group-hover:border-amber-300 transition-colors shadow-inner">
                      <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold tracking-wider leading-none mb-0.5">
                        Código
                      </div>
                      <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-wider leading-tight">
                        {product.code}
                      </div>
                    </div>

                    {/* Ações Rápidas (Copiar, Editar, Excluir) */}
                    <div
                      className="flex flex-col gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleCopyCode(product.code, product.name)}
                        className={`p-2 rounded-lg transition-colors ${
                          copiedCode === product.code
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Copiar código"
                      >
                        {copiedCode === product.code ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setProductToEdit(product);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar produto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setProductToDelete(product)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Excluir produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
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
      />

      {/* Modal de Cadastro / Edição */}
      <ProductFormModal
        isOpen={isFormOpen}
        productToEdit={productToEdit}
        existingProducts={products}
        onClose={() => {
          setIsFormOpen(false);
          setProductToEdit(null);
        }}
        onSave={handleSaveProduct}
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
    </div>
  );
}
