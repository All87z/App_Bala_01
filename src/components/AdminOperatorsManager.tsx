import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  KeyRound,
  UserPlus,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Edit2,
  Lock,
  Eye,
  EyeOff,
  Power,
  X,
  Plus,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { AdminSession, OperatorRecord } from '../types';
import {
  loginAdmin,
  logoutAdmin,
  listOperatorsAdmin,
  registerOperatorAdmin,
  updateOperatorAdmin,
  toggleOperatorStatusAdmin,
  changeAdminPassword,
  getStoredAdminSession,
} from '../utils/sheetsAuthSync';

interface AdminOperatorsManagerProps {
  apiUrl: string;
}

export const AdminOperatorsManager: React.FC<AdminOperatorsManagerProps> = ({ apiUrl }) => {
  // Estado da Sessão do Administrador
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() =>
    getStoredAdminSession()
  );

  // Estados do Formulário de Login Admin
  const [matriculaInput, setMatriculaInput] = useState('ADMIN');
  const [senhaInput, setSenhaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Estados da Lista de Operadores
  const [operators, setOperators] = useState<OperatorRecord[]>([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [maxLimit, setMaxLimit] = useState(10);

  // Estados do Modal "Cadastrar Novo Operador"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMatricula, setNewMatricula] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estados do Modal "Editar Operador"
  const [editingOperator, setEditingOperator] = useState<OperatorRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editStatus, setEditStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Estados do Modal "Alterar Senha do Admin"
  const [isAdminPassModalOpen, setIsAdminPassModalOpen] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [isSavingAdminPass, setIsSavingAdminPass] = useState(false);
  const [adminPassError, setAdminPassError] = useState<string | null>(null);
  const [adminPassSuccess, setAdminPassSuccess] = useState<string | null>(null);

  // Notificação toast temporária interna
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Carrega operadores da aba Operadores via token administrativo
  const loadOperators = useCallback(async (token: string) => {
    setIsLoadingOperators(true);
    setListError(null);
    try {
      const res = await listOperatorsAdmin(apiUrl, token);
      if (res.sucesso && res.operadores) {
        setOperators(res.operadores);
        if (res.limite) setMaxLimit(res.limite);
      } else {
        if (res.sessaoExpirada) {
          setAdminSession(null);
        }
        setListError(res.mensagem || 'Falha ao carregar operadores da planilha.');
      }
    } catch (err: any) {
      setListError(`Erro ao consultar operadores: ${err?.message || err}`);
    } finally {
      setIsLoadingOperators(false);
    }
  }, [apiUrl]);

  // Carrega operadores ao detectar sessão administrativa ativa
  useEffect(() => {
    if (adminSession?.token) {
      loadOperators(adminSession.token);
    }
  }, [adminSession, loadOperators]);

  // Login de Administrador
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!matriculaInput.trim()) {
      setLoginError('Informe a matrícula do administrador.');
      return;
    }
    if (!senhaInput) {
      setLoginError('Informe a senha do administrador.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(apiUrl, matriculaInput.trim(), senhaInput);
      if (res.sucesso && res.sessao) {
        setAdminSession(res.sessao);
        setSenhaInput('');
        showToast('Autenticado com sucesso no Painel do Administrador!');
      } else {
        setLoginError(res.mensagem || 'Credenciais administrativas inválidas.');
      }
    } catch (err: any) {
      setLoginError(`Falha ao conectar: ${err?.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout de Administrador
  const handleAdminLogout = async () => {
    if (adminSession?.token) {
      await logoutAdmin(apiUrl, adminSession.token);
    }
    setAdminSession(null);
    setOperators([]);
    showToast('Sessão administrativa encerrada.');
  };

  // Abertura do Modal de Cadastro com sugestão de matrícula
  const handleOpenCreateModal = () => {
    setCreateError(null);
    setNewName('');
    setNewPassword('');

    // Sugere próximo número de matrícula disponível (ex: OP001, OP002...)
    const existingCodes = new Set(operators.map((op) => op.matricula.toUpperCase()));
    let suggestedCode = 'OP001';
    for (let i = 1; i <= 10; i++) {
      const code = `OP${String(i).padStart(3, '0')}`;
      if (!existingCodes.has(code)) {
        suggestedCode = code;
        break;
      }
    }
    setNewMatricula(suggestedCode);
    setIsCreateModalOpen(true);
  };

  // Salvar Novo Operador
  const handleSaveNewOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSession?.token) return;

    const cleanMat = newMatricula.trim().toUpperCase();
    const cleanName = newName.trim();

    if (!cleanMat) {
      setCreateError('A matrícula é obrigatória.');
      return;
    }
    if (!cleanName) {
      setCreateError('O nome do operador é obrigatório.');
      return;
    }
    if (!newPassword || newPassword.length < 12) {
      setCreateError('A senha deve conter no mínimo 12 caracteres (sem espaços omitidos).');
      return;
    }

    // Validação local de duplicidade
    if (operators.some((op) => op.matricula.toUpperCase() === cleanMat)) {
      setCreateError(`A matrícula ${cleanMat} já está cadastrada.`);
      return;
    }

    setIsSavingNew(true);
    setCreateError(null);
    try {
      const res = await registerOperatorAdmin(apiUrl, adminSession.token, {
        matricula: cleanMat,
        nome: cleanName,
        senha: newPassword,
      });

      if (res.sucesso) {
        setIsCreateModalOpen(false);
        showToast(`Operador ${cleanMat} cadastrado na aba Operadores com PBKDF2!`);
        await loadOperators(adminSession.token);
      } else {
        if (res.sessaoExpirada) setAdminSession(null);
        setCreateError(res.mensagem || 'Falha ao cadastrar operador na planilha.');
      }
    } catch (err: any) {
      setCreateError(`Erro na requisição: ${err?.message || err}`);
    } finally {
      setIsSavingNew(false);
    }
  };

  // Abrir Modal de Edição
  const handleOpenEditModal = (operator: OperatorRecord) => {
    setEditingOperator(operator);
    setEditName(operator.nome);
    setEditPassword('');
    setEditStatus(operator.status);
    setEditError(null);
  };

  // Salvar Edição do Operador
  const handleSaveEditOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSession?.token || !editingOperator) return;

    const cleanName = editName.trim();
    if (!cleanName) {
      setEditError('O nome é obrigatório.');
      return;
    }

    if (editPassword && editPassword.length < 12) {
      setEditError('A nova senha deve conter no mínimo 12 caracteres (ou deixe o campo vazio para manter a atual).');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await updateOperatorAdmin(apiUrl, adminSession.token, {
        matricula: editingOperator.matricula,
        nome: cleanName,
        novaSenha: editPassword || undefined,
        status: editStatus,
      });

      if (res.sucesso) {
        setEditingOperator(null);
        showToast(`Operador ${editingOperator.matricula} atualizado com sucesso!`);
        await loadOperators(adminSession.token);
      } else {
        if (res.sessaoExpirada) setAdminSession(null);
        setEditError(res.mensagem || 'Falha ao atualizar operador.');
      }
    } catch (err: any) {
      setEditError(`Erro na requisição: ${err?.message || err}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Alternar Status Rápido (Ativar / Desativar)
  const handleToggleStatus = async (operator: OperatorRecord) => {
    if (!adminSession?.token) return;
    const newStatus: 'ATIVO' | 'INATIVO' = operator.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';

    try {
      const res = await toggleOperatorStatusAdmin(
        apiUrl,
        adminSession.token,
        operator.matricula,
        newStatus
      );

      if (res.sucesso) {
        showToast(
          `Operador ${operator.matricula} marcado como ${newStatus}${
            newStatus === 'INATIVO' ? ' (sessões revogadas)' : ''
          }.`
        );
        await loadOperators(adminSession.token);
      } else {
        if (res.sessaoExpirada) setAdminSession(null);
        showToast(`Erro: ${res.mensagem}`);
      }
    } catch (err: any) {
      showToast(`Erro ao alterar status: ${err?.message || err}`);
    }
  };

  // Salvar Nova Senha do Admin
  const handleSaveAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSession?.token) return;

    if (!newAdminPass || newAdminPass.length < 12) {
      setAdminPassError('A nova senha deve conter no mínimo 12 caracteres.');
      return;
    }
    if (newAdminPass !== confirmAdminPass) {
      setAdminPassError('A confirmação de senha não confere.');
      return;
    }

    setIsSavingAdminPass(true);
    setAdminPassError(null);
    setAdminPassSuccess(null);
    try {
      const res = await changeAdminPassword(apiUrl, adminSession.token, newAdminPass);
      if (res.sucesso) {
        setAdminPassSuccess('Senha administrativa atualizada com sucesso no Google Apps Script!');
        setNewAdminPass('');
        setConfirmAdminPass('');
        setTimeout(() => {
          setIsAdminPassModalOpen(false);
          setAdminPassSuccess(null);
        }, 2000);
      } else {
        if (res.sessaoExpirada) setAdminSession(null);
        setAdminPassError(res.mensagem || 'Falha ao atualizar senha.');
      }
    } catch (err: any) {
      setAdminPassError(`Erro: ${err?.message || err}`);
    } finally {
      setIsSavingAdminPass(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Informativo */}
      {toastMessage && (
        <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center gap-2 shadow-lg animate-in slide-in-from-top-1">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {!adminSession ? (
        /* ==================================================== */
        /* TELA 1: LOGIN EXCLUSIVO DO ADMINISTRADOR            */
        /* ==================================================== */
        <div className="p-4 sm:p-5 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Área Restrita do Administrador</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono uppercase">
                  Gestão
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Acesso exclusivo para pré-cadastro de até 10 operadores antes da distribuição.
              </p>
            </div>
          </div>

          {/* Card explicativo */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed space-y-1">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Preparação Prévia dos Usuários:</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Cadastre previamente as matrículas e senhas individuais de cada operador da balança.
              Todas as senhas são gravadas com <strong>PBKDF2-HMAC-SHA-256 (10.000 rodadas)</strong> e
              <strong> Salt de 256 bits</strong> na aba <em>Operadores</em>.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Matrícula de Administrador
              </label>
              <input
                type="text"
                value={matriculaInput}
                onChange={(e) => setMatriculaInput(e.target.value)}
                placeholder="ADMIN"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-400 font-mono uppercase"
                disabled={isLoggingIn}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Senha Administrativa Exclusiva
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senhaInput}
                  onChange={(e) => setSenhaInput(e.target.value)}
                  placeholder="Digite a senha administrativa"
                  className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-400 font-mono"
                  disabled={isLoggingIn}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando credenciais de administrador...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Acessar Painel do Administrador</span>
                </>
              )}
            </button>
          </form>

          {/* Dica sobre credencial inicial no Apps Script */}
          <div className="p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">
              Dica de Configuração Inicial:
            </span>
            <p>
              A credencial padrão inicial é matrícula <code className="text-amber-300 font-mono font-bold">ADMIN</code> e senha provisória definida no Apps Script. Você pode alterá-la tanto pelo menu da planilha (<em>Assistente de Balança &gt; Configurar Senha do Administrador</em>) quanto diretamente dentro deste painel após o login.
            </p>
          </div>
        </div>
      ) : (
        /* ==================================================== */
        /* TELA 2: PAINEL AUTENTICADO DE GESTÃO DE OPERADORES  */
        /* ==================================================== */
        <div className="space-y-4">
          {/* Header do Administrador Conectado */}
          <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span>Administrador do Sistema</span>
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                    {adminSession.matricula}
                  </span>
                </div>
                <p className="text-[11px] text-amber-400/90 font-medium">
                  Sessão administrativa autorizada para gerenciar operadores
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAdminPassError(null);
                  setAdminPassSuccess(null);
                  setNewAdminPass('');
                  setConfirmAdminPass('');
                  setIsAdminPassModalOpen(true);
                }}
                className="py-1.5 px-2.5 rounded-xl border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Alterar senha do administrador"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Senha Admin</span>
              </button>

              <button
                type="button"
                onClick={handleAdminLogout}
                className="py-1.5 px-2.5 rounded-xl border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Encerrar sessão de administrador"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          {/* Barra de Status e Limite de 10 Operadores */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <div className="text-xs font-bold text-slate-200">
                Operadores Cadastrados:{' '}
                <span className="text-emerald-400 font-mono text-sm">
                  {operators.length}
                </span>{' '}
                / <span className="text-slate-400 font-mono">{maxLimit}</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono ${
                  operators.length >= maxLimit
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {operators.length >= maxLimit ? 'Limite Atingido' : 'Disponível'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => loadOperators(adminSession.token)}
                disabled={isLoadingOperators}
                className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1"
                title="Atualizar lista de operadores da planilha"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOperators ? 'animate-spin' : ''}`} />
                <span className="text-xs">Atualizar</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                disabled={operators.length >= maxLimit}
                className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>+ Cadastrar Operador</span>
              </button>
            </div>
          </div>

          {/* Mensagem de Erro de Lista */}
          {listError && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{listError}</span>
            </div>
          )}

          {/* Lista de Operadores (Até 10) */}
          <div className="space-y-2">
            {isLoadingOperators && operators.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Consultando operadores cadastrados na aba Operadores...</span>
              </div>
            ) : operators.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 space-y-3">
                <UserPlus className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">
                  Nenhum operador cadastrado antecipadamente
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Você pode cadastrar até 10 operadores com matrícula e senha individual antes de
                  distribuir o aplicativo aos colaboradores.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Operador</span>
                </button>
              </div>
            ) : (
              operators.map((op, idx) => {
                const isAtivo = op.status === 'ATIVO';
                return (
                  <div
                    key={op.matricula}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isAtivo
                        ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                          isAtivo
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-amber-300">
                            {op.matricula}
                          </span>
                          <span className="text-xs font-semibold text-white">{op.nome}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                              isAtivo
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {op.status}
                          </span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>PBKDF2 Seguro</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                      {/* Botão Ativar / Desativar */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(op)}
                        className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                          isAtivo
                            ? 'bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-800/60 text-slate-300 hover:text-red-300'
                            : 'bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300'
                        }`}
                        title={
                          isAtivo
                            ? 'Desativar operador (revoga sessões ativas)'
                            : 'Reativar operador'
                        }
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{isAtivo ? 'Desativar' : 'Ativar'}</span>
                      </button>

                      {/* Botão Editar / Redefinir Senha */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(op)}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Editar nome, status ou redefinir senha individual"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: CADASTRAR NOVO OPERADOR                    */}
      {/* ==================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Cadastrar Novo Operador</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewOperator} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Matrícula do Operador
                </label>
                <input
                  type="text"
                  value={newMatricula}
                  onChange={(e) => setNewMatricula(e.target.value)}
                  placeholder="Ex: OP001 ou número"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono uppercase focus:outline-none focus:border-emerald-400"
                  disabled={isSavingNew}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Completo do Operador
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                  disabled={isSavingNew}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Senha Individual (Mínimo de 12 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 12 caracteres"
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-400"
                    disabled={isSavingNew}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-1 text-slate-400">
                  <span>Caracteres: {newPassword.length} / 12 mín.</span>
                  {newPassword.length >= 12 && (
                    <span className="text-emerald-400 font-bold">Comprimento Válido</span>
                  )}
                </div>
              </div>

              {/* Informação sobre segurança */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  A senha é processada no servidor com <strong>PBKDF2-HMAC-SHA-256</strong> e <strong>Salt de 256 bits</strong>, sem jamais ser salva em texto puro.
                </span>
              </div>

              {createError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSavingNew}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNew || newPassword.length < 12}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSavingNew ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <span>Cadastrar na Planilha</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: EDITAR OPERADOR / REDEFINIR SENHA          */}
      {/* ==================================================== */}
      {editingOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                <Edit2 className="w-5 h-5 text-sky-400" />
                <span>Editar Operador: {editingOperator.matricula}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingOperator(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOperator} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Matrícula (Fixa)
                </label>
                <input
                  type="text"
                  value={editingOperator.matricula}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs sm:text-sm font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Operador
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do operador"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-sky-400"
                  disabled={isSavingEdit}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Situação / Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'ATIVO' | 'INATIVO')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-sky-400"
                  disabled={isSavingEdit}
                >
                  <option value="ATIVO">ATIVO (Permite login e sincronização)</option>
                  <option value="INATIVO">INATIVO (Acesso bloqueado)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Redefinir Senha (Opcional)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Deixe em branco para manter a senha atual"
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-sky-400"
                    disabled={isSavingEdit}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {editPassword && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Caracteres: {editPassword.length} / 12 mín. (se alterar a senha, as sessões ativas serão desconectadas).
                  </span>
                )}
              </div>

              {editError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOperator(null)}
                  disabled={isSavingEdit}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || (editPassword.length > 0 && editPassword.length < 12)}
                  className="flex-1 py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: ALTERAR SENHA DO ADMINISTRADOR              */}
      {/* ==================================================== */}
      {isAdminPassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Alterar Senha do Administrador</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminPassModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nova Senha Administrativa (Mínimo de 12 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showAdminPass ? 'text' : 'password'}
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-400"
                    disabled={isSavingAdminPass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  value={confirmAdminPass}
                  onChange={(e) => setConfirmAdminPass(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-400"
                  disabled={isSavingAdminPass}
                  required
                />
              </div>

              {adminPassError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{adminPassError}</span>
                </div>
              )}

              {adminPassSuccess && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{adminPassSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminPassModalOpen(false)}
                  disabled={isSavingAdminPass}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdminPass || newAdminPass.length < 12}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSavingAdminPass ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Nova Senha</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
