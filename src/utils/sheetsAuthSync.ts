import { OperatorSession, SheetsProductItem, Product } from '../types';
import { getLocalAvailabilityMap } from './storage';

const SESSION_STORAGE_KEY = 'balanca_operator_session';
const API_URL_STORAGE_KEY = 'balanca_sheets_api_url';
export const DEFAULT_SHEETS_API_URL =
  'https://script.google.com/macros/s/AKfycbyfaojZh81dEvfsWQcmqBM28yxPq3X3tk92IDPhCINHb7E0iayjNZxNagWwyzs4ttry/exec';

export function getStoredApiUrl(): string {
  return localStorage.getItem(API_URL_STORAGE_KEY) || DEFAULT_SHEETS_API_URL;
}

export function saveStoredApiUrl(url: string) {
  localStorage.setItem(API_URL_STORAGE_KEY, url.trim());
}

export function getStoredSession(): OperatorSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: OperatorSession = JSON.parse(raw);
    // Verifica validade local
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: OperatorSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Higieniza a URL do endpoint para garantir que credenciais ou tokens
 * nunca trafeguem na URL (query string).
 */
export function sanitizeApiUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim() || DEFAULT_SHEETS_API_URL;
  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.delete('token');
    parsed.searchParams.delete('senha');
    parsed.searchParams.delete('matricula');
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Envia uma requisição HTTP POST para o endpoint do Google Apps Script
 * com dados exclusivamente no corpo da requisição (nunca na URL/query string).
 *
 * Utiliza Content-Type 'text/plain;charset=utf-8' com corpo serializado em JSON:
 * 1. CORS Safelisted / Simple Request: evita requisição preflight OPTIONS no navegador,
 *    a qual não possui cabeçalhos CORS nos endpoints /exec do Google Apps Script.
 * 2. Previne falso-positivo de query string no Apps Script: o Apps Script preenche
 *    'e.parameter' automaticamente quando o Content-Type é application/x-www-form-urlencoded,
 *    mas mantém 'e.parameter' limpo quando o corpo é enviado como texto puro (JSON).
 * 3. Suporta com total fidelidade caracteres complexos em senhas e tokens contendo '=', '&' ou '+'.
 */
async function postToAppsScript(cleanUrl: string, payload: Record<string, any>): Promise<any> {
  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  const textoResposta = await response.text();
  try {
    return JSON.parse(textoResposta);
  } catch {
    throw new Error('Resposta inesperada do servidor ao tentar comunicar com a planilha. Verifique a URL do Google Apps Script.');
  }
}

export interface SafeDiagnostics {
  planilhaEncontrada?: boolean;
  abaOperadoresEncontrada?: boolean;
  camposIdentificados?: {
    matricula: boolean;
    nome: boolean;
    hash: boolean;
    salt: boolean;
    status: boolean;
  };
  operadorLocalizado?: boolean;
  statusAtivo?: boolean;
  saltCompativel?: boolean;
  hashCompativel?: boolean;
  etapaFalha?: string | null;
}

export interface LoginResult {
  sucesso: boolean;
  mensagem?: string;
  sessao?: OperatorSession;
  diagnostico?: SafeDiagnostics;
}

/**
 * Autentica o operador com matrícula e senha individual
 */
export async function loginOperator(
  apiUrl: string,
  matricula: string,
  senha: string
): Promise<LoginResult> {
  try {
    const cleanUrl = sanitizeApiUrl(apiUrl);
    const data = await postToAppsScript(cleanUrl, {
      action: 'login',
      matricula: matricula.trim(),
      senha: senha,
    });

    if (data.sucesso && data.token) {
      const sessao: OperatorSession = {
        token: data.token,
        matricula: data.operador?.matricula || matricula.trim(),
        nome: data.operador?.nome || 'Operador',
        expiresAt: data.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      saveStoredSession(sessao);
      return { sucesso: true, sessao, diagnostico: data.diagnostico };
    }

    return {
      sucesso: false,
      mensagem: data.erro || 'Credenciais inválidas.',
      diagnostico: data.diagnostico,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sucesso: false,
      mensagem: `Falha de rede ao conectar com a API: ${message}. Verifique a internet.`,
    };
  }
}

/**
 * Executa diagnóstico estrutural seguro da aba Operadores no Apps Script
 */
export async function runSafeDiagnostic(apiUrl: string): Promise<{
  sucesso: boolean;
  diagnostico?: any;
  mensagem?: string;
}> {
  try {
    const cleanUrl = sanitizeApiUrl(apiUrl);
    const data = await postToAppsScript(cleanUrl, { action: 'diagnostico' });
    return {
      sucesso: data.sucesso,
      diagnostico: data.diagnostico,
      mensagem: data.erro,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sucesso: false,
      mensagem: `Erro ao obter diagnóstico: ${message}`,
    };
  }
}

/**
 * Encerra a sessão no servidor e remove localmente
 */
export async function logoutOperator(apiUrl: string, token: string): Promise<void> {
  try {
    const cleanUrl = sanitizeApiUrl(apiUrl);
    await postToAppsScript(cleanUrl, {
      action: 'logout',
      token,
    });
  } catch {
    // Ignora erros de rede no logout
  } finally {
    clearStoredSession();
  }
}

/**
 * Sincroniza o catálogo de produtos usando o token de sessão autenticado
 */
export async function syncSheetsCatalog(
  apiUrl: string,
  token: string,
  currentProducts: Product[],
  onProgress?: (msg: string) => void
): Promise<{
  sucesso: boolean;
  mensagem: string;
  produtos?: Product[];
  totalNovos?: number;
  totalAtualizados?: number;
}> {
  try {
    onProgress?.('Conectando à planilha protegida...');
    const cleanUrl = sanitizeApiUrl(apiUrl);
    const data = await postToAppsScript(cleanUrl, {
      action: 'sincronizar',
      token,
    });

    if (!data.sucesso) {
      if (data.sessaoExpirada) {
        clearStoredSession();
      }
      return {
        sucesso: false,
        mensagem: data.erro || 'Falha ao sincronizar: sessão inválida ou sem permissão.',
      };
    }

    const remoteItems: SheetsProductItem[] = data.produtos || [];
    onProgress?.(`Baixando catálogo (${remoteItems.length} produtos)...`);

    // Mapa dos produtos existentes por código
    const productMap = new Map(currentProducts.map((p) => [p.code.toLowerCase(), { ...p }]));
    let totalNovos = 0;
    let totalAtualizados = 0;

    for (let i = 0; i < remoteItems.length; i++) {
      const item = remoteItems[i];
      const cleanCode = String(item.codigo).trim();
      const existing = productMap.get(cleanCode.toLowerCase());

      onProgress?.(`Processando ${i + 1}/${remoteItems.length}: ${item.nome}...`);

      let imageUrl = existing?.imageUrl;

      // Se possui imagem_id do Drive e ainda não temos imagem ou ela mudou
      if (item.imagem_id && (!imageUrl || existing?.driveImageId !== item.imagem_id)) {
        try {
          const imgBase64 = await fetchDriveImageBase64(cleanUrl, token, item.imagem_id);
          if (imgBase64) {
            imageUrl = imgBase64;
          }
        } catch {
          // Mantém foto existente se houver erro ao baixar
        }
      }

      const localAvailability = getLocalAvailabilityMap();
      const codeKey = cleanCode.toLowerCase();

      // Extração robusta do campo descrição com múltiplos fallbacks (descricao, description, desc, etc.)
      const rawDesc =
        item.descricao !== undefined
          ? item.descricao
          : item.description !== undefined
          ? item.description
          : (item as any).desc !== undefined
          ? (item as any).desc
          : (item as any)['descrição'] !== undefined
          ? (item as any)['descrição']
          : undefined;

      const hasDescField = rawDesc !== undefined;
      const cleanDesc =
        hasDescField && rawDesc !== null && String(rawDesc).trim() !== ''
          ? String(rawDesc).trim()
          : undefined;

      if (existing) {
        // Atualiza campos da planilha preservando identificadores locais
        existing.name = item.nome;
        existing.code = cleanCode;
        if (item.preco !== undefined) existing.price = String(item.preco);
        if (item.unidade !== undefined) existing.unit = item.unidade;
        if (item.categoria !== undefined) existing.category = item.categoria;
        if (hasDescField) existing.description = cleanDesc;
        existing.remoteId = item.id;
        existing.driveImageId = item.imagem_id;
        existing.imageUrl = imageUrl;
        existing.updatedAt = Date.now();

        // REGRA INDISPENSÁVEL: Preserva rigorosamente a situação local do aparelho, inclusive se estiver Esgotado
        if (localAvailability[codeKey] !== undefined) {
          existing.isAvailable = localAvailability[codeKey];
        } else if (existing.isAvailable !== undefined) {
          existing.isAvailable = existing.isAvailable;
        } else {
          existing.isAvailable = true;
        }

        totalAtualizados++;
      } else {
        // REGRA INDISPENSÁVEL: Novo produto que chega pela sincronização inicia com situação Disponível (true)
        const initialStatus = localAvailability[codeKey] !== undefined ? localAvailability[codeKey] : true;

        const fresh: Product = {
          id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: item.nome,
          code: cleanCode,
          price: item.preco !== undefined ? String(item.preco) : '',
          unit: item.unidade || 'kg',
          isAvailable: initialStatus,
          category: item.categoria,
          description: cleanDesc,
          remoteId: item.id,
          driveImageId: item.imagem_id,
          imageUrl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        productMap.set(codeKey, fresh);
        totalNovos++;
      }
    }

    const mergedList = Array.from(productMap.values());
    return {
      sucesso: true,
      mensagem: `Catálogo sincronizado: ${totalNovos} novos produtos, ${totalAtualizados} atualizados.`,
      produtos: mergedList,
      totalNovos,
      totalAtualizados,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sucesso: false,
      mensagem: `Erro na sincronização: ${message}. Os dados locais foram preservados.`,
    };
  }
}

/**
 * Busca uma imagem privada do Google Drive pelo endpoint autenticado do Apps Script
 */
async function fetchDriveImageBase64(
  apiUrl: string,
  token: string,
  imageId: string
): Promise<string | null> {
  try {
    const cleanUrl = sanitizeApiUrl(apiUrl);
    const data = await postToAppsScript(cleanUrl, {
      action: 'imagem',
      token,
      id: imageId,
    });
    if (data.sucesso && data.base64) {
      const mime = data.mimeType || 'image/jpeg';
      return `data:${mime};base64,${data.base64}`;
    }
    return null;
  } catch {
    return null;
  }
}
