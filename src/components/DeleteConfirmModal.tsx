import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Product } from '../types';

interface DeleteConfirmModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (product: Product) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  product,
  onClose,
  onConfirm,
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          Confirmar Exclusão?
        </h3>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          Tem certeza de que deseja remover o produto{' '}
          <strong className="text-white font-semibold">"{product.name}"</strong> com
          código{' '}
          <span className="font-mono font-bold text-amber-400">
            {product.code}
          </span>
          ? Esta ação não pode ser desfeita.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(product);
              onClose();
            }}
            className="w-1/2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
