/**
 * Normaliza textos removendo diacríticos (acentos, cedilha) e convertendo para minúsculas.
 * Permite buscar "mussarela" e encontrar "Queijo mussarela", ou "maca" e achar "Maçã".
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica se um produto corresponde à pesquisa por nome ou código
 */
export function matchProduct(name: string, code: string, query: string): boolean {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return true;

  // Busca direta por código (preserva zeros e verifica correspondência exata ou parcial)
  const cleanCode = code.trim();
  if (cleanCode.toLowerCase().includes(cleanQuery)) {
    return true;
  }

  // Busca por nome sem acentos
  const cleanName = normalizeText(name);
  return cleanName.includes(cleanQuery);
}

/**
 * Retorna somente o nome real do produto para exibição visual,
 * removendo qualquer prefixo de categoria ou título composto (ex: "HORTIFRUTI - Maçã" -> "Maçã").
 * Preserva o modelo de dados e a sincronização intactos.
 */
export function getDisplayProductName(
  nameOrProduct: { name: string; category?: string } | string,
  categoryArg?: string
): string {
  let rawName = '';
  let category = '';

  if (typeof nameOrProduct === 'string') {
    rawName = nameOrProduct;
    category = categoryArg || '';
  } else if (nameOrProduct && typeof nameOrProduct === 'object') {
    rawName = nameOrProduct.name || '';
    category = nameOrProduct.category || categoryArg || '';
  }

  if (!rawName) return '';
  const cleanName = rawName.trim();

  // 1. Se a categoria estiver definida e o nome começar com ela
  if (category && category.trim()) {
    const cleanCat = category.trim();
    const escapedCat = cleanCat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexCat = new RegExp(`^${escapedCat}[\\s\\-–—:/|\\]]*`, 'i');
    if (regexCat.test(cleanName)) {
      const stripped = cleanName.replace(regexCat, '').trim();
      if (stripped.length > 0) {
        return stripped;
      }
    }
  }

  // 2. Título composto entre colchetes: "[HORTIFRUTI] Maçã" -> "Maçã"
  const bracketMatch = cleanName.match(/^\[[^\]]+\]\s*(.+)$/);
  if (bracketMatch && bracketMatch[1] && bracketMatch[1].trim()) {
    return bracketMatch[1].trim();
  }

  // 3. Título composto com separador: "HORTIFRUTI - Maçã", "HORTIFRUTI / Maçã", "HORTIFRUTI : Maçã"
  const separatorMatch = cleanName.match(/^([A-Za-zÀ-ÖØ-öø-ÿ0-9\s]{2,30})\s*[-–—:/|]\s*(.+)$/);
  if (separatorMatch && separatorMatch[2] && separatorMatch[2].trim()) {
    return separatorMatch[2].trim();
  }

  return cleanName;
}

