import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, ImagePlus, Trash2, Camera, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { processGalleryImage } from '../utils/imageHelper';

interface ProductFormModalProps {
  isOpen: boolean;
  productToEdit: Product | null;
  existingProducts: Product[];
  onClose: () => void;
  onSave: (
    name: string,
    code: string,
    idToEdit?: string,
    imageUrl?: string,
    price?: string,
    unit?: string,
    isAvailable?: boolean
  ) => void;
}

export const AVAILABLE_UNITS = [
  { id: 'un', label: 'UN', name: 'unidade' },
  { id: 'pct', label: 'PCT', name: 'pacote' },
  { id: 'kg', label: 'KG', name: 'quilo' },
  { id: '100g', label: '100G', name: '100g' },
  { id: 'g', label: 'G', name: 'grama' },
  { id: 'bdj', label: 'BDJ', name: 'bandeja' },
];

export function normalizeUnit(unit?: string): string {
  if (!unit) return 'kg';
  const clean = unit.toLowerCase().trim();
  if (clean === 'pacote' || clean === 'pct') return 'pct';
  if (clean === 'unidade' || clean === 'un') return 'un';
  if (clean === 'quilo' || clean === 'kg') return 'kg';
  if (clean === 'grama' || clean === 'g') return 'g';
  if (clean === 'bandeja' || clean === 'bdj') return 'bdj';
  if (clean === '100g') return '100g';
  return clean;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  productToEdit,
  existingProducts,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCode(productToEdit.code);
      setPrice(productToEdit.price || '');
      setUnit(normalizeUnit(productToEdit.unit));
      setIsAvailable(productToEdit.isAvailable ?? true);
      setImageUrl(productToEdit.imageUrl);
    } else {
      setName('');
      setCode('');
      setPrice('');
      setUnit('kg');
      setIsAvailable(true);
      setImageUrl(undefined);
    }
    setError(null);
    setIsProcessingImage(false);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      setError(null);
      const optimizedDataUrl = await processGalleryImage(file);
      setImageUrl(optimizedDataUrl);
    } catch (err: any) {
      console.error('Falha ao processar imagem:', err);
      setError('Não foi possível carregar a imagem da galeria. Tente outro arquivo.');
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingImage) {
      setError('Aguarde o processamento da imagem antes de salvar.');
      return;
    }

    const cleanName = name.trim();
    const cleanCode = code.trim();

    if (!cleanName) {
      setError('Por favor, informe o nome do produto.');
      return;
    }
    if (!cleanCode) {
      setError('Por favor, informe o código da balança.');
      return;
    }

    // Verifica duplicidade de código
    const duplicate = existingProducts.find(
      (p) => p.code.toLowerCase() === cleanCode.toLowerCase() && p.id !== productToEdit?.id
    );

    if (duplicate) {
      setError(`Atenção: O código "${cleanCode}" já está cadastrado para o produto "${duplicate.name}". Escolha outro código.`);
      return;
    }

    onSave(
      cleanName,
      cleanCode,
      productToEdit?.id,
      imageUrl,
      price.trim(),
      unit,
      isAvailable
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
          {productToEdit ? 'Editar Produto' : 'Cadastrar Novo Produto'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 mb-4 sm:mb-5">
          Toda a edição do produto (dados, preço, unidade, disponibilidade e foto) é feita aqui.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SELETOR DE STATUS: DISPONÍVEL OU ESGOTADO */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Status do Produto na Balança
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setIsAvailable(true)}
                className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
                  isAvailable
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Disponível</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAvailable(false)}
                className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
                  !isAvailable
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Esgotado</span>
              </button>
            </div>
          </div>

          {/* FOTO DA GALERIA */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Foto de Referência Visual
            </label>
            <div className="flex items-center gap-3 sm:gap-4 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border-2 border-amber-400/40 flex items-center justify-center shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Referência do produto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-7 h-7 text-slate-600" />
                )}
                {isProcessingImage && (
                  <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-amber-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <ImagePlus className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {imageUrl ? 'Trocar Imagem' : 'Escolher da Galeria'}
                  </span>
                </button>

                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    disabled={isProcessingImage}
                    className="flex items-center justify-center gap-1 text-[11px] text-red-400 hover:text-red-300 py-0.5 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remover foto</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* NOME DO PRODUTO */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Nome do Produto <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: Maçã Gala, Carne Moída de 1ª..."
              className="w-full px-4 py-2.5 sm:py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-medium text-sm sm:text-base"
            />
          </div>

          {/* CÓDIGO DA BALANÇA */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Código da Balança <span className="text-amber-400">*</span>
              <span className="text-xs text-slate-500 font-normal ml-2">
                (preserva zeros à esquerda)
              </span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: 102 ou 005"
              className="w-full px-4 py-2.5 sm:py-3 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono font-bold text-xl tracking-wider"
            />
          </div>

          {/* PREÇO DE VENDA */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Preço de Venda
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-emerald-400 font-bold text-sm select-none">
                R$
              </span>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-3 py-2.5 sm:py-3 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 placeholder-slate-600 font-mono font-bold text-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* SELEÇÃO DA UNIDADE DE VENDA — TOTALMENTE VISÍVEL E ACESSÍVEL NO SMARTPHONE */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
              Unidade de Venda da Balança
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
              {AVAILABLE_UNITS.map((u) => {
                const isSelected = unit === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnit(u.id)}
                    className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/25 ring-1 ring-amber-300'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900 font-semibold'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-extrabold leading-tight">
                      {u.label}
                    </span>
                    <span
                      className={`text-[9px] leading-tight mt-0.5 ${
                        isSelected ? 'text-slate-950 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      {u.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 sm:pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 sm:py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition-colors text-sm sm:text-base"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessingImage}
              className={`w-1/2 py-2.5 sm:py-3 px-4 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm sm:text-base flex items-center justify-center gap-2 ${
                isProcessingImage
                  ? 'bg-amber-400/50 text-slate-900 cursor-wait'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {isProcessingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando foto...</span>
                </>
              ) : (
                <span>{productToEdit ? 'Atualizar' : 'Salvar Produto'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
