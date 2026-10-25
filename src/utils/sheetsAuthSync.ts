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
 * Autentica o operador com matrícula e senha individual
 */
export async function loginOperator(
  apiUrl: string,
  matricula: string,
  senha: string
): Promise<{ sucesso: boolean; mensagem?: string; sessao?: OperatorSession }> {
  try {
    const cleanUrl = apiUrl.trim() || DEFAULT_SHEETS_API_URL;
    const body = new URLSearchParams({
      action: 'login',
      matricula: matricula.trim(),
      senha: senha,
    });

    const response = await fetch(cleanUrl, {
  method: 'POST',
  body,
  redirect: 'follow',
});

console.log('API status HTTP:', response.status);
console.log('API URL utilizada:', cleanUrl);

const textoResposta = await response.text();
console.log('Resposta bruta da API:', textoResposta);

const data = JSON.parse(textoResposta);

    
    if (data.sucesso && data.token) {
      const sessao: OperatorSession = {
        token: data.token,
        matricula: data.operador?.matricula || matricula.trim(),
        nome: data.operador?.nome || 'Operador',
        expiresAt: data.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      saveStoredSession(sessao);
      return { sucesso: true, sessao };
    }

    return {
      sucesso: false,
      mensagem: data.erro || 'Matrícula ou senha incorretos ou operador inativo.',
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
 * Encerra a sessão no servidor e remove localmente
 */
export async function logoutOperator(apiUrl: string, token: string): Promise<void> {
  try {
    const cleanUrl = apiUrl.trim() || DEFAULT_SHEETS_API_URL;
    const body = new URLSearchParams({
      action: 'logout',
      token,
    });
    await fetch(cleanUrl, { method: 'POST', body });
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
    const cleanUrl = apiUrl.trim() || DEFAULT_SHEETS_API_URL;
    const body = new URLSearchParams({
      action: 'sincronizar',
      token,
    });

    const response = await fetch(cleanUrl, {
      method: 'POST',
      body,
    });

    const data = await response.json();

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

      if (existing) {
        // Atualiza campos da planilha preservando identificadores locais
        existing.name = item.nome;
        existing.code = cleanCode;
        if (item.preco !== undefined) existing.price = String(item.preco);
        if (item.unidade !== undefined) existing.unit = item.unidade;
        if (item.categoria !== undefined) existing.category = item.categoria;
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
    const body = new URLSearchParams({
      action: 'imagem',
      token,
      id: imageId,
    });
    const res = await fetch(apiUrl, { method: 'POST', body });
    const data = await res.json();
    if (data.sucesso && data.base64) {
      const mime = data.mimeType || 'image/jpeg';
      return `data:${mime};base64,${data.base64}`;
    }
    return null;
  } catch {
    return null;
  }
}
