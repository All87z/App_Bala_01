import { Product, RecentProduct } from '../types';
import { DEFAULT_ILLUSTRATIONS } from './imageHelper';

const STORAGE_KEY_PRODUCTS = 'assistente_balanca_produtos_v1';
const STORAGE_KEY_RECENTS = 'assistente_balanca_recentes_v1';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-banana-prata',
    name: 'Banana prata',
    code: '102',
    price: '6,99',
    unit: 'kg',
    isAvailable: true,
    imageUrl: DEFAULT_ILLUSTRATIONS.banana,
    createdAt: Date.now() - 3000,
    updatedAt: Date.now() - 3000,
  },
  {
    id: 'prod-batata-inglesa',
    name: 'Batata inglesa',
    code: '215',
    price: '4,50',
    unit: 'kg',
    isAvailable: true,
    imageUrl: DEFAULT_ILLUSTRATIONS.batata,
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000,
  },
  {
    id: 'prod-queijo-mussarela',
    name: 'Queijo mussarela',
    code: '347',
    price: '49,90',
    unit: 'kg',
    isAvailable: true,
    imageUrl: DEFAULT_ILLUSTRATIONS.queijo,
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
  },
];

// IndexedDB Helper para persistência redundante de fotos e dados offline
const IDB_NAME = 'assistente_balanca_offline_db';
const IDB_STORE = 'products_store';
const IDB_KEY = 'all_products';

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistToIndexedDb(products: Product[]): Promise<void> {
  try {
    const db = await openIndexedDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(products, IDB_KEY);
  } catch (err) {
    // Falha silenciosa no IndexedDB, pois localStorage já é o canal primário
    console.debug('Persistência secundária IndexedDB:', err);
  }
}

export async function restoreFromIndexedDb(): Promise<Product[] | null> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function getSavedProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (!raw) {
      saveProducts(INITIAL_PRODUCTS);
      return INITIAL_PRODUCTS;
    }
    const parsed: Product[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveProducts(INITIAL_PRODUCTS);
      return INITIAL_PRODUCTS;
    }

    return parsed.map((p) => {
      if (!p.imageUrl) {
        if (p.name.toLowerCase().includes('banana')) p.imageUrl = DEFAULT_ILLUSTRATIONS.banana;
        else if (p.name.toLowerCase().includes('batata')) p.imageUrl = DEFAULT_ILLUSTRATIONS.batata;
        else if (p.name.toLowerCase().includes('queijo')) p.imageUrl = DEFAULT_ILLUSTRATIONS.queijo;
      }
      if (p.isAvailable === undefined) {
        p.isAvailable = true;
      }
      if (!p.price) {
        if (p.code === '102') p.price = '6,99';
        else if (p.code === '215') p.price = '4,50';
        else if (p.code === '347') p.price = '49,90';
      }
      if (!p.unit) {
        p.unit = 'kg';
      }
      return p;
    });
  } catch (error) {
    console.error('Erro ao ler produtos locais:', error);
    return INITIAL_PRODUCTS;
  }
}

export function saveProducts(products: Product[]): void {
  try {
    // 1. Salva no localStorage para acesso síncrono e imediato
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
  } catch (error) {
    console.warn('Aviso de limite no localStorage, salvando cópia compactada:', error);
    try {
      // Se estourar localStorage, preserva os dados textuais no localStorage
      const lightCopy = products.map((p) => {
        // Se a imagem for muito pesada e estourar a cota, mantém os dados
        if (p.imageUrl && p.imageUrl.length > 30000) {
          return { ...p, imageUrl: undefined };
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(lightCopy));
    } catch (criticalErr) {
      console.error('Falha crítica ao gravar no localStorage:', criticalErr);
    }
  }

  // 2. Salva paralelamente no IndexedDB (onde não há o limite de 5MB do localStorage)
  persistToIndexedDb(products);
}

export function getRecentProducts(): RecentProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENTS);
    if (!raw) return [];
    const parsed: RecentProduct[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Erro ao ler recentes:', error);
    return [];
  }
}

export function addRecentProduct(code: string, name: string): RecentProduct[] {
  try {
    const current = getRecentProducts().filter((item) => item.code !== code);
    const updated: RecentProduct[] = [
      { code, name, accessedAt: Date.now() },
      ...current,
    ].slice(0, 8); // Mantém os 8 mais recentes
    localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Erro ao adicionar recente:', error);
    return [];
  }
}

export function removeRecentByCode(code: string): void {
  try {
    const current = getRecentProducts().filter((item) => item.code !== code);
    localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(current));
  } catch (error) {
    console.error('Erro ao remover recente:', error);
  }
}
