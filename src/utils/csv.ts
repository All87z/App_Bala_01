import { Product } from '../types';

/**
 * Exporta a lista de produtos para formato CSV com delimitador ';'
 * Formato padrão compatível com Excel, LibreOffice e sistemas de balança:
 * codigo;nome;preco;unidade;status
 */
export function exportToCsv(products: Product[]): string {
  const header = 'codigo;nome;preco;unidade;status\r\n';
  const rows = products.map((p) => {
    const cleanCode = p.code.trim();
    const safeName = p.name.replace(/"/g, '""');
    const safePrice = (p.price || '').replace(/"/g, '""');
    const safeUnit = p.unit || 'kg';
    const safeStatus = p.isAvailable !== false ? 'disponivel' : 'esgotado';
    return `${cleanCode};"${safeName}";"${safePrice}";"${safeUnit}";"${safeStatus}"`;
  });
  return header + rows.join('\r\n');
}

/**
 * Dispara o download automático do arquivo CSV no navegador
 */
export function downloadCsvFile(products: Product[], filename = 'produtos_balanca.csv'): void {
  const csvContent = exportToCsv(products);
  // Adiciona BOM UTF-8 (\uFEFF) para garantir acentuação correta no Excel brasileiro
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Processa um texto CSV importado e extrai produtos
 * Suporta separadores ';' ou ',' e preserva zeros à esquerda no código
 */
export function parseCsvContent(csvText: string): Array<{
  name: string;
  code: string;
  price?: string;
  unit?: string;
  isAvailable?: boolean;
}> {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: Array<{
    name: string;
    code: string;
    price?: string;
    unit?: string;
    isAvailable?: boolean;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter);

    if (parts.length >= 2) {
      const rawCode = parts[0].trim().replace(/^"|"$/g, '');
      const rawName = parts[1].trim().replace(/^"|"$/g, '');
      const rawPrice = parts[2] ? parts[2].trim().replace(/^"|"$/g, '') : undefined;
      const rawUnit = parts[3] ? parts[3].trim().replace(/^"|"$/g, '') : undefined;
      const rawStatus = parts[4] ? parts[4].trim().replace(/^"|"$/g, '').toLowerCase() : undefined;

      // Pula linha de cabeçalho
      if (
        i === 0 &&
        (rawCode.toLowerCase() === 'codigo' || rawCode.toLowerCase() === 'code')
      ) {
        continue;
      }

      if (rawCode && rawName) {
        results.push({
          code: rawCode,
          name: rawName,
          price: rawPrice || undefined,
          unit: rawUnit || 'kg',
          isAvailable: rawStatus ? rawStatus !== 'esgotado' : true,
        });
      }
    }
  }

  return results;
}
