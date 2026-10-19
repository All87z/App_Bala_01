import React, { useEffect, useState } from 'react';
import { Copy, Check, X, Scale } from 'lucide-react';
import { Product } from '../types';

interface SpotlightModalProps {
  product: Product | null;
  onClose: () => void;
  onCopy: (code: string, productName: string) => void;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  product,
  onClose,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const handleCopyClick = () => {
    onCopy(product.code, product.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Fechar no Canto */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center justify-center gap-2 mb-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
          <Scale className="w-4 h-4" />
          <span>Código de Balança</span>
        </div>

        {/* Imagem de Referência Visual (se houver) */}
        {product.imageUrl && (
          <div className="mx-auto mb-3 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-lg shadow-amber-500/10 bg-slate-950 flex items-center justify-center">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 px-4 leading-tight">
          {product.name}
        </h3>

        {/* Status de Disponibilidade e Preço */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              product.isAvailable !== false
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                product.isAvailable !== false ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            {product.isAvailable !== false ? 'Disponível' : 'Esgotado'}
          </span>

          {product.price && (
            <span className="font-mono text-emerald-400 font-extrabold text-lg tracking-tight bg-slate-950 px-3 py-0.5 rounded-full border border-slate-800">
              <span className="text-xs text-emerald-500 mr-0.5">R$</span>
              {product.price}
              <span className="text-xs text-slate-400 font-normal ml-0.5">
                /{product.unit || 'kg'}
              </span>
            </span>
          )}
        </div>

        {/* NÚMERO COLOSSAL E EXTREMAMENTE LEGÍVEL */}
        <div
          onClick={handleCopyClick}
          className="cursor-pointer group relative bg-slate-950 border-3 border-amber-400/90 rounded-2xl py-8 px-4 my-2 shadow-inner hover:border-amber-300 transition-all hover:scale-[1.02]"
        >
          <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">
            Digite na Balança:
          </div>
          <div className="font-mono text-6xl sm:text-7xl md:text-8xl font-black text-amber-400 tracking-wider select-all">
            {product.code}
          </div>
          <div className="mt-2 text-xs text-amber-400/70 font-medium group-hover:text-amber-300 flex items-center justify-center gap-1">
            <Copy className="w-3.5 h-3.5" />
            <span>Clique para copiar</span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/3 py-3.5 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold text-base hover:bg-slate-800 transition-colors"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={handleCopyClick}
            className={`w-full sm:w-2/3 py-3.5 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${
              copied
                ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-6 h-6 stroke-[3]" />
                <span>Código Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-6 h-6 stroke-[2.5]" />
                <span>Copiar Código ({product.code})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
