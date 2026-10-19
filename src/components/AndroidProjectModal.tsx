import React, { useState } from 'react';
import {
  X,
  Download,
  Smartphone,
  CheckCircle,
  FileCode,
  Copy,
  Check,
  FolderArchive,
  Layers,
  Terminal,
} from 'lucide-react';
import { ANDROID_FILES, downloadAndroidProjectZip } from '../utils/zipGenerator';

interface AndroidProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidProjectModal: React.FC<AndroidProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    'app/src/main/java/com/balanca/assistente/ui/ScaleAssistantApp.kt'
  );
  const [copiedFile, setCopiedFile] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const currentFile =
    ANDROID_FILES.find((f) => f.path === selectedFilePath) || ANDROID_FILES[0];

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      await downloadAndroidProjectZip();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCode = () => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.content);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Projeto Nativo Android (Kotlin + Jetpack Compose)</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                  100% Offline
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Código nativo completo, banco Room local e guia para iniciantes gerarem o APK instalável
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Gerando .ZIP...' : 'Baixar Projeto Completo (.ZIP)'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Guia Rápido para Iniciantes (GitHub Actions & Android Studio) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 p-3.5 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-[11px]">
              1
            </div>
            <div>
              <p className="font-bold text-white mb-0.5">Sincronizar no GitHub</p>
              <p className="text-slate-400 text-[11px]">
                Envie o repositório para o seu GitHub (já com o workflow pronto).
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-[11px]">
              2
            </div>
            <div>
              <p className="font-bold text-white mb-0.5">Aba Actions no GitHub</p>
              <p className="text-slate-400 text-[11px]">
                Clique no workflow <strong>Compilação Android (APK)</strong>.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-[11px]">
              3
            </div>
            <div>
              <p className="font-bold text-white mb-0.5">Botão "Run workflow"</p>
              <p className="text-slate-400 text-[11px]">
                Clique em <strong>Run workflow</strong> para compilar o APK na nuvem.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-[11px]">
              4
            </div>
            <div>
              <p className="font-bold text-white mb-0.5">Baixar o APK (Artifact)</p>
              <p className="text-slate-400 text-[11px]">
                Ao concluir, baixe o APK pronto na seção <em>Artifacts</em>.
              </p>
            </div>
          </div>
        </div>

        {/* Área Principal: Explorador de Arquivos & Visualizador de Código */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navegador de Arquivos à Esquerda */}
          <div className="w-full md:w-80 border-r border-slate-800 bg-slate-950/30 overflow-y-auto p-3">
            <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 font-bold uppercase text-[11px] tracking-wider mb-2">
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Arquivos do Projeto ({ANDROID_FILES.length})</span>
            </div>
            <div className="space-y-1">
              {ANDROID_FILES.map((file) => {
                const isSelected = file.path === selectedFilePath;
                const fileName = file.path.split('/').pop() || file.path;
                const folderPath = file.path.split('/').slice(0, -1).join('/');

                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-start gap-2 ${
                      isSelected
                        ? 'bg-amber-400/15 text-amber-300 font-semibold border border-amber-400/40'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <FileCode className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                    <div className="truncate">
                      <div className="truncate font-mono">{fileName}</div>
                      {folderPath && (
                        <div className="text-[10px] text-slate-500 truncate">{folderPath}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Código do Arquivo Selecionado à Direita */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
              <span className="font-mono text-xs text-amber-300 font-medium">
                {currentFile?.path}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                {copiedFile ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar código</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200 select-all">
              <pre className="whitespace-pre">
                <code>{currentFile?.content}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Rodapé com Dicas de Emulador e Celular Real */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Configurado com <strong>Room Database</strong>, permissão de áudio para voz e persistência permanente offline.
            </span>
          </div>
          <button
            onClick={handleDownloadZip}
            className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar tudo (.ZIP)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
