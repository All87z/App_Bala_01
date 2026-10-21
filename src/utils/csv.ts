import JSZip from 'jszip';
import { Product } from '../types';

export interface CsvParseError {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

export interface CsvParsedProduct {
  name: string;
  code: string;
  price: string;
  unit: string;
  isAvailable: boolean;
}

export interface CsvParseResult {
  validProducts: CsvParsedProduct[];
  invalidLines: CsvParseError[];
  totalDataLines: number;
  detectedDelimiter: string;
}

/**
 * Normaliza as 6 unidades aceitas pela balança comercial:
 * UN (unidade), PCT (pacote), KG (quilo), 100G, G (grama), BDJ (bandeja)
 */
export function normalizeUnitString(unit?: string): string {
  if (!unit) return 'kg';
  const clean = unit.toLowerCase().trim();
  if (clean === 'un' || clean === 'unidade' || clean === 'und') return 'un';
  if (clean === 'pct' || clean === 'pacote' || clean === 'pcte') return 'pct';
  if (clean === 'kg' || clean === 'quilo' || clean === 'kilo') return 'kg';
  if (clean === '100g' || clean === '100 g') return '100g';
  if (clean === 'g' || clean === 'grama' || clean === 'gr') return 'g';
  if (clean === 'bdj' || clean === 'bandeja' || clean === 'band') return 'bdj';
  return 'kg';
}

/**
 * Exporta a lista de produtos para formato CSV compatível com Excel e balanças
 * Utiliza delimitador ';' padrão brasileiro e adiciona BOM UTF-8 (\uFEFF)
 */
export function exportToCsv(products: Product[]): string {
  const header = 'codigo;nome;preco;unidade;disponibilidade\r\n';
  const rows = products.map((p) => {
    // Preserva o código intacto como texto (com aspas para preservar zeros à esquerda como "005")
    const cleanCode = (p.code || '').trim();
    const safeCode = `"${cleanCode.replace(/"/g, '""')}"`;
    const safeName = `"${(p.name || '').replace(/"/g, '""')}"`;
    const safePrice = `"${(p.price || '').replace(/"/g, '""')}"`;
    const safeUnit = `"${normalizeUnitString(p.unit).toUpperCase()}"`;
    const safeStatus = `"${p.isAvailable !== false ? 'Disponivel' : 'Esgotado'}"`;

    return `${safeCode};${safeName};${safePrice};${safeUnit};${safeStatus}`;
  });

  return header + rows.join('\r\n');
}

/**
 * Dispara o download automático do arquivo CSV com UTF-8 BOM
 */
export function downloadCsvFile(products: Product[], filename?: string): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const actualFilename = filename || `produtos_balanca_${dateStr}.csv`;
  const csvContent = exportToCsv(products);

  // Adiciona BOM UTF-8 (\uFEFF) para garantir que Excel brasileiro e Android reconheçam acentos e cedilhas
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Analisador robusto de CSV em conformidade com RFC 4180
 * Suporta aspas com vírgulas/pontos e vírgulas internas, quebras de linha e zeros à esquerda
 */
export function parseCsvContent(csvText: string): CsvParseResult {
  // Remove BOM UTF-8 se presente
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return {
      validProducts: [],
      invalidLines: [],
      totalDataLines: 0,
      detectedDelimiter: ';',
    };
  }

  // Detecta delimitador predominante na primeira linha (; ou , ou \t)
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ';';
  if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semicolonCount) delimiter = ',';

  // Divide linhas respeitando aspas
  const rawLines = splitCsvRows(cleanText);
  const validProducts: CsvParsedProduct[] = [];
  const invalidLines: CsvParseError[] = [];
  let totalDataLines = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) continue;

    const fields = parseCsvRow(rawLine, delimiter);
    if (fields.length === 0) continue;

    const rawCode = (fields[0] || '').trim();
    const rawName = (fields[1] || '').trim();

    // Detecta cabeçalho na primeira linha
    if (i === 0 && isHeaderRow(rawCode, rawName)) {
      continue;
    }

    totalDataLines++;

    // Validação de campos obrigatórios
    if (!rawCode && !rawName) {
      invalidLines.push({
        lineNumber: i + 1,
        rawLine,
        reason: 'Linha sem código e sem nome de produto',
      });
      continue;
    }

    if (!rawCode) {
      invalidLines.push({
        lineNumber: i + 1,
        rawLine,
        reason: `Código ausente para o produto "${rawName}"`,
      });
      continue;
    }

    if (!rawName) {
      invalidLines.push({
        lineNumber: i + 1,
        rawLine,
        reason: `Nome ausente para o código "${rawCode}"`,
      });
      continue;
    }

    const rawPrice = fields[2] ? fields[2].trim() : '';
    const rawUnit = fields[3] ? fields[3].trim() : 'kg';
    const rawStatus = fields[4] ? fields[4].trim().toLowerCase() : '';

    let isAvailable = true;
    if (rawStatus) {
      if (
        rawStatus.includes('esgotado') ||
        rawStatus === 'não' ||
        rawStatus === 'nao' ||
        rawStatus === 'false' ||
        rawStatus === '0'
      ) {
        isAvailable = false;
      }
    }

    validProducts.push({
      code: rawCode,
      name: rawName,
      price: rawPrice,
      unit: normalizeUnitString(rawUnit),
      isAvailable,
    });
  }

  return {
    validProducts,
    invalidLines,
    totalDataLines,
    detectedDelimiter: delimiter,
  };
}

/**
 * Verifica se a primeira linha é um cabeçalho
 */
function isHeaderRow(col1: string, col2: string): boolean {
  const c1 = col1.toLowerCase();
  const c2 = col2.toLowerCase();
  return (
    c1 === 'codigo' ||
    c1 === 'código' ||
    c1 === 'code' ||
    c1 === 'cod' ||
    c1 === 'id' ||
    c2 === 'nome' ||
    c2 === 'name' ||
    c2 === 'descricao' ||
    c2 === 'produto'
  );
}

/**
 * Divide o texto do CSV em linhas respeitando quebras dentro de aspas
 */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let currentRow = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentRow += '""';
        i++;
      } else {
        insideQuotes = !insideQuotes;
        currentRow += '"';
      }
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }

  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Converte uma linha CSV em colunas respeitando aspas e o delimitador
 */
function parseCsvRow(row: string, delimiter: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField);
  return fields;
}

/**
 * Mecanismo de backup completo com produtos, metadados, CSV e fotos em formato ZIP
 */
export interface FullBackupPayload {
  version: string;
  exportedAt: number;
  appName: string;
  totalProducts: number;
  products: Product[];
}

/**
 * Gera e dispara o download do backup completo em arquivo .ZIP contendo:
 * 1. backup_balanca.json (dados estruturados e imagens em base64)
 * 2. produtos.csv (exportação tabular com UTF-8 BOM para planilhas)
 * 3. fotos/ (pasta com as imagens individuais salvas em JPEG/PNG)
 */
export async function downloadFullBackupZip(products: Product[]): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const zip = new JSZip();

  const payload: FullBackupPayload = {
    version: '2.0',
    exportedAt: Date.now(),
    appName: 'Assistente de Balança',
    totalProducts: products.length,
    products,
  };

  // 1. Arquivo JSON estruturado
  zip.file('backup_balanca.json', JSON.stringify(payload, null, 2));

  // 2. Arquivo CSV formatado com BOM UTF-8
  const csvContent = exportToCsv(products);
  zip.file('produtos.csv', '\uFEFF' + csvContent);

  // 3. Pasta de fotos individuais
  const photosFolder = zip.folder('fotos');
  if (photosFolder) {
    products.forEach((p) => {
      if (p.imageUrl && p.imageUrl.startsWith('data:image/')) {
        const matches = p.imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const rawExt = matches[1].toLowerCase();
          const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
          const cleanCode = p.code.replace(/[^a-zA-Z0-9_-]/g, '_');
          photosFolder.file(`${cleanCode}_${p.id}.${ext}`, matches[2], { base64: true });
        }
      }
    });
  }

  // Gera o arquivo ZIP compactado
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `backup_balanca_${dateStr}.zip`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Lê e valida um arquivo de backup que pode ser tanto um .ZIP quanto um .JSON
 */
export async function parseBackupFile(file: File): Promise<Product[]> {
  const fileName = file.name.toLowerCase();

  // Caso 1: Arquivo compactado .ZIP
  if (fileName.endsWith('.zip')) {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    // Procura backup_balanca.json
    const jsonFile =
      loadedZip.file('backup_balanca.json') ||
      loadedZip.file('backup.json') ||
      loadedZip.file(/(.*)\.json$/i)[0];

    if (jsonFile) {
      const jsonText = await jsonFile.async('text');
      return parseFullBackup(jsonText);
    }

    // Se só houver produtos.csv dentro do zip
    const csvFile =
      loadedZip.file('produtos.csv') ||
      loadedZip.file(/(.*)\.csv$/i)[0];

    if (csvFile) {
      const csvText = await csvFile.async('text');
      const parseResult = parseCsvContent(csvText);
      if (parseResult.validProducts.length === 0) {
        throw new Error('O CSV dentro do arquivo ZIP não possui registros válidos.');
      }
      return parseResult.validProducts.map((p) => ({
        id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: p.name,
        code: p.code,
        price: p.price,
        unit: p.unit,
        isAvailable: p.isAvailable,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    }

    throw new Error('O arquivo ZIP não contém arquivos de dados válidos (backup_balanca.json ou produtos.csv).');
  }

  // Caso 2: Arquivo .JSON direto
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsText(file);
  });

  return parseFullBackup(text);
}

export function parseFullBackup(jsonText: string): Product[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('O conteúdo do arquivo não é um JSON válido.');
  }

  if (Array.isArray(parsed)) {
    return validateProductsArray(parsed);
  }
  if (parsed && Array.isArray(parsed.products)) {
    return validateProductsArray(parsed.products);
  }
  throw new Error('Formato de dados de backup incompatível.');
}

function validateProductsArray(items: any[]): Product[] {
  const valid = items
    .filter((item) => item && typeof item.code === 'string' && typeof item.name === 'string')
    .map((item) => ({
      id: item.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: String(item.name).trim(),
      code: String(item.code).trim(),
      imageUrl: item.imageUrl && typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
      price: item.price !== undefined && item.price !== null ? String(item.price).trim() : '',
      unit: normalizeUnitString(item.unit),
      isAvailable: item.isAvailable !== false,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    }))
    .filter((p) => p.name.length > 0 && p.code.length > 0);

  if (valid.length === 0) {
    throw new Error('Nenhum produto válido foi identificado no arquivo.');
  }

  return valid;
}
