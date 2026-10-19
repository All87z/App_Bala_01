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
