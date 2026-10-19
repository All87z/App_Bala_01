export interface Product {
  id: string;
  name: string;
  code: string; // Tratado como texto para preservar zeros à esquerda (ex: "005", "0102")
  imageUrl?: string; // Imagem da galeria ou ilustração de referência visual
  price?: string; // Preço na balança (ex: "6,99")
  unit?: string; // Unidade da balança (ex: "kg", "un")
  isAvailable?: boolean; // true = Disponível, false = Esgotado (padrão true)
  createdAt: number;
  updatedAt: number;
}

export interface RecentProduct {
  code: string;
  name: string;
  accessedAt: number;
}
