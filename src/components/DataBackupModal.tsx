import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Info,
  Archive,
  ArrowRight,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Product } from '../types';
import {
  downloadCsvFile,
  parseCsvContent,
  CsvParseResult,
  downloadFullBackupZip,
  parseBackupFile,
} from '../utils/csv';

interface DataBackupModalProps {
  isOpen: boolean;
  products: Product[];
  onClose: () => void;
  onImportProducts: (
    importedProducts: Array<{
      name: string;
      code: string;
      price?: string;
      unit?: string;
      isAvailable?: boolean;
    }>,
    mode: 'merge' | 'skipDuplicates' | 'replace'
  ) => void;
  onRestoreFullBackup: (restored: Product[]) => void;
}

type TabType = 'exportCsv' | 'importCsv' | 'fullBackup';
type DuplicateMode = 'merge' | 'skipDuplicates' | 'replace';

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  products,
  onClose,
  onImportProducts,
  onRestoreFullBackup,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('importCsv');

  // Estados da Importação de CSV
  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('merge');
  const [showInvalidDetails, setShowInvalidDetails] = useState(false);
  const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Estados do Backup com Fotos
  const [backupRestoreError, setBackupRestoreError] = useState<string | null>(null);
  const [backupRestorePreview, setBackupRestorePreview] = useState<{
    total: number;
    withPhotos: number;
    items: Product[];
  } | null>(null);

  const fileCsvInputRef = useRef<HTMLInputElement>(null);
  const fileBackupInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Lógica de leitura do CSV
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCsvContent(text);

        if (result.validProducts.length === 0 && result.invalidLines.length === 0) {
          setCsvError('O arquivo CSV selecionado está vazio.');
          setCsvResult(null);
          return;
        }

        setCsvResult(result);
      } catch (err: any) {
        setCsvError('Erro ao ler arquivo CSV. Verifique se o arquivo está corrompido.');
        setCsvResult(null);
      }
    };
    reader.onerror = () => {
      setCsvError('Erro ao abrir o arquivo no dispositivo.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Calcula duplicados com base nos produtos atuais
  const duplicateCodes = new Set(
    (csvResult?.validProducts || [])
      .map((p) => p.code.toLowerCase())
      .filter((code) => products.some((existing) => existing.code.toLowerCase() === code))
  );

  const newCount = (csvResult?.validProducts.length || 0) - duplicateCodes.size;
  const duplicateCount = duplicateCodes.size;

  const handleConfirmCsvImport = () => {
    if (!csvResult || csvResult.validProducts.length === 0) return;

    if (duplicateMode === 'replace' && !confirmReplaceChecked) {
      setCsvError('Marque a confirmação para autorizar a substituição total.');
      return;
    }

    onImportProducts(csvResult.validProducts, duplicateMode);
    onClose();
  };

  // Lógica de Backup Completo com Fotos (.ZIP ou .JSON)
  const [isProcessingBackupFile, setIsProcessingBackupFile] = useState(false);

  const handleFullBackupSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupRestoreError(null);
    setIsProcessingBackupFile(true);

    try {
      const parsedProducts = await parseBackupFile(file);
      if (parsedProducts.length === 0) {
        setBackupRestoreError('Nenhum produto válido encontrado no arquivo de backup.');
        setBackupRestorePreview(null);
        return;
      }

      const withPhotos = parsedProducts.filter((p) => !!p.imageUrl).length;
      setBackupRestorePreview({
        total: parsedProducts.length,
        withPhotos,
        items: parsedProducts,
      });
    } catch (err: any) {
      setBackupRestoreError(
        err?.message || 'Arquivo de backup inválido. Escolha um arquivo .zip ou .json válido do Assistente de Balança.'
      );
      setBackupRestorePreview(null);
    } finally {
      setIsProcessingBackupFile(false);
      e.target.value = '';
    }
  };

  const handleConfirmRestoreFullBackup = () => {
    if (!backupRestorePreview) return;
    onRestoreFullBackup(backupRestorePreview.items);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                Importar / Exportar Dados
              </h3>
              <p className="text-xs text-slate-400">
                Planilhas CSV e backups completos offline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas Superiores */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-2xl my-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('importCsv')}
            className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'importCsv'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Importar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exportCsv')}
            className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'exportCsv'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fullBackup')}
            className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'fullBackup'
                ? 'bg-sky-400 text-slate-950 shadow-md shadow-sky-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Backup c/ Fotos</span>
          </button>
        </div>

        {/* Conteúdo com rolagem interna */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-slate-200">
          {/* ==================================================== */}
          {/* ABA 1: IMPORTAR CSV COM PRÉVIA E TRATAMENTO SEGURO */}
          {/* ==================================================== */}
          {activeTab === 'importCsv' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-400 leading-relaxed">
                <span className="text-slate-200 font-semibold block mb-0.5">
                  Formato aceito:
                </span>
                Linhas contendo <code className="text-amber-300 font-mono">codigo;nome;preco;unidade;status</code>.
                Suporta zeros à esquerda (ex: <code className="text-amber-300 font-mono">005</code>),
                acentuação UTF-8 e unidades como <span className="text-slate-300">UN, PCT, KG, 100G, G, BDJ</span>.
              </div>

              {/* Botão de Selecionar Arquivo CSV */}
              <input
                type="file"
                ref={fileCsvInputRef}
                onChange={handleCsvFileSelected}
                accept=".csv,text/csv,text/plain"
                className="hidden"
              />

              <div
                onClick={() => fileCsvInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl p-4 sm:p-5 text-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 text-amber-400 group-hover:scale-110 flex items-center justify-center mx-auto mb-2 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-white group-hover:text-amber-300">
                  {selectedFileName ? selectedFileName : 'Selecionar Arquivo CSV'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Toque para escolher do smartphone ou computador
                </div>
              </div>

              {csvError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-2xl text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* PRÉVIA DOS DADOS CSV ENCONTRADOS */}
              {csvResult && (
                <div className="space-y-3 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    <span>Prévia da Importação</span>
                  </div>

                  {/* Resumo de Contagem */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 flex flex-col">
                      <span className="text-slate-400">Produtos válidos:</span>
                      <span className="text-lg font-black text-emerald-400">
                        {csvResult.validProducts.length}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({newCount} novos, {duplicateCount} existentes)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
                      <span className="text-slate-400">Total de linhas lidas:</span>
                      <span className="text-lg font-black text-white">
                        {csvResult.totalDataLines}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Delimitador: "{csvResult.detectedDelimiter}"
                      </span>
                    </div>
                  </div>

                  {/* Alerta de Linhas Inválidas */}
                  {csvResult.invalidLines.length > 0 && (
                    <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-300">
                      <div
                        className="flex items-center justify-between cursor-pointer font-bold"
                        onClick={() => setShowInvalidDetails(!showInvalidDetails)}
                      >
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>
                            {csvResult.invalidLines.length} linha(s) ignoradas por dados incompletos
                          </span>
                        </span>
                        {showInvalidDetails ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>

                      {showInvalidDetails && (
                        <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto text-[11px] font-mono border-t border-amber-500/20 pt-2">
                          {csvResult.invalidLines.map((inv, idx) => (
                            <div key={idx} className="p-1 rounded bg-slate-950/80">
                              <span className="text-amber-400 font-bold">Linha {inv.lineNumber}:</span>{' '}
                              <span className="text-slate-400">{inv.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ESCOLHA DE TRATAMENTO DE DUPLICADOS */}
                  {duplicateCount > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-bold text-slate-300">
                        Como tratar os {duplicateCount} produtos já cadastrados?
                      </label>

                      <div className="space-y-2">
                        {/* Opção 1: Atualizar dados mantendo fotos */}
                        <label
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            duplicateMode === 'merge'
                              ? 'bg-amber-400/10 border-amber-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="duplicateMode"
                            checked={duplicateMode === 'merge'}
                            onChange={() => setDuplicateMode('merge')}
                            className="mt-0.5 text-amber-400 focus:ring-0"
                          />
                          <div className="text-xs">
                            <span className="font-bold block text-amber-300">
                              Atualizar dados existentes (Recomendado)
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Atualiza preços, nomes e unidades. Preserva fotos já cadastradas.
                            </span>
                          </div>
                        </label>

                        {/* Opção 2: Manter existentes e só adicionar novos */}
                        <label
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            duplicateMode === 'skipDuplicates'
                              ? 'bg-amber-400/10 border-amber-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="duplicateMode"
                            checked={duplicateMode === 'skipDuplicates'}
                            onChange={() => setDuplicateMode('skipDuplicates')}
                            className="mt-0.5 text-amber-400 focus:ring-0"
                          />
                          <div className="text-xs">
                            <span className="font-bold block text-slate-200">
                              Manter atuais e adicionar apenas os {newCount} novos
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Ignora produtos cujo código já existe.
                            </span>
                          </div>
                        </label>

                        {/* Opção 3: Substituir todos com confirmação explícita */}
                        <label
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            duplicateMode === 'replace'
                              ? 'bg-rose-500/10 border-rose-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="duplicateMode"
                            checked={duplicateMode === 'replace'}
                            onChange={() => setDuplicateMode('replace')}
                            className="mt-0.5 text-rose-400 focus:ring-0"
                          />
                          <div className="text-xs">
                            <span className="font-bold block text-rose-300">
                              Substituir toda a lista de produtos
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Substitui o catálogo completo pelos itens deste CSV.
                            </span>
                          </div>
                        </label>
                      </div>

                      {duplicateMode === 'replace' && (
                        <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id="confirmReplace"
                            checked={confirmReplaceChecked}
                            onChange={(e) => setConfirmReplaceChecked(e.target.checked)}
                            className="rounded text-rose-500 focus:ring-0"
                          />
                          <label htmlFor="confirmReplace" className="font-semibold cursor-pointer">
                            Confirmo que desejo apagar os produtos atuais e gravar o CSV
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botão de Ação para Concluir Importação */}
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCsvResult(null)}
                      className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Trocar arquivo
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCsvImport}
                      className="w-2/3 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Gravar {csvResult.validProducts.length} Produtos na Balança
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* ABA 2: EXPORTAR CSV COM UTF-8 E DADOS COMPLETOS     */}
          {/* ==================================================== */}
          {activeTab === 'exportCsv' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Exportação para Balanças e Planilhas
                    </h4>
                    <p className="text-xs text-slate-400">
                      Gera arquivo .csv pronto para Excel, LibreOffice e software de balança
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-400">
                      {products.length}
                    </span>
                    <span className="text-[10px] text-slate-500 block">produtos</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-1.5 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Campos exportados: Código, Nome, Preço, Unidade, Disponibilidade</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Zeros à esquerda preservados (ex: "005", "0102")</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Codificação UTF-8 com BOM para correta acentuação (ç, ã, é)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => downloadCsvFile(products)}
                  className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Baixar Arquivo CSV ({products.length} produtos)</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* ABA 3: BACKUP COMPLETO EM ARQUIVO ZIP (COM FOTOS)    */}
          {/* ==================================================== */}
          {activeTab === 'fullBackup' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-2xl text-xs text-sky-200 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  O backup em <strong>arquivo ZIP</strong> é o formato mais completo: ele empacota a lista de produtos, uma planilha CSV e <strong>todas as fotos da galeria</strong> em uma pasta organizada para transferência segura entre celulares e restauração offline.
                </span>
              </div>

              {/* Botão de Exportar Backup Completo ZIP */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-sky-400" />
                    <span>Exportar Backup Completo (ZIP)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Gera pacote ZIP com dados, CSV e pasta de fotos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadFullBackupZip(products)}
                  className="py-2.5 px-3.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Baixar ZIP ({products.length})</span>
                </button>
              </div>

              {/* Botão de Restaurar Backup Completo */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Restaurar Backup Completo
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Aceita pacotes <strong>.ZIP</strong> ou arquivos <strong>.JSON</strong> salvos anteriormente
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileBackupInputRef.current?.click()}
                    disabled={isProcessingBackupFile}
                    className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shrink-0 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessingBackupFile ? 'Lendo...' : 'Escolher Arquivo'}</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileBackupInputRef}
                  onChange={handleFullBackupSelected}
                  accept=".zip,.json,application/zip,application/json"
                  className="hidden"
                />

                {backupRestoreError && (
                  <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs">
                    {backupRestoreError}
                  </div>
                )}

                {backupRestorePreview && (
                  <div className="p-3 bg-slate-900 border border-sky-500/40 rounded-xl space-y-2 text-xs animate-in fade-in">
                    <div className="font-bold text-sky-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Pacote de backup verificado com sucesso</span>
                    </div>
                    <div className="text-slate-300">
                      Total: <strong>{backupRestorePreview.total} produtos</strong> ({backupRestorePreview.withPhotos} com fotos da galeria).
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmRestoreFullBackup}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
                    >
                      Confirmar e Restaurar Todos os Produtos e Fotos
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="pt-3 mt-2 border-t border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
