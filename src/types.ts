export interface Product {
  id: string;
  name: string;
  code: string; // Tratado como texto para preservar zeros à esquerda (ex: "005", "0102")
  imageUrl?: string; // Imagem local em Base64 / disco ou ilustração de referência visual
  price?: string; // Preço na balança (ex: "6,99")
  unit?: string; // Unidade da balança (ex: "kg", "un")
  isAvailable?: boolean; // true = Disponível, false = Esgotado (padrão true)
  category?: string; // Categoria do produto (ex: "Hortifrúti", "Açougue")
  description?: string; // Descrição curta de venda (ex: "Vendido por peso", "Vendido por bandeja")
  remoteId?: string; // ID na planilha Google Sheets (ex: "PROD001")
  driveImageId?: string; // ID real do arquivo JPG no Google Drive
  createdAt: number;
  updatedAt: number;
}

export interface RecentProduct {
  code: string;
  name: string;
  accessedAt: number;
}

export interface OperatorSession {
  token: string;
  matricula: string;
  nome: string;
  expiresAt: number;
}

export interface SheetsProductItem {
  id: string;
  nome: string;
  codigo: string;
  preco?: string;
  categoria?: string;
  descricao?: string;
  description?: string;
  imagem_id?: string;
  atualizado_em?: string;
  unidade?: string;
  disponibilidade?: boolean;
}


