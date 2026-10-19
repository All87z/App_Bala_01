/**
 * Processa e compacta imagens selecionadas da galeria para referência visual offline no app
 */
export async function processGalleryImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 360; // Tamanho ideal para miniatura e destaque nítidos
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Gera JPEG otimizado
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Falha ao processar arquivo de imagem.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo da galeria.'));
    reader.readAsDataURL(file);
  });
}

// Ilustrações SVG elegantes para os produtos iniciais
export const DEFAULT_ILLUSTRATIONS = {
  banana: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23422006"/><path d="M22 68C30 80 54 82 72 65C82 55 86 38 85 24C81 25 76 29 74 34C70 48 64 62 48 64C38 65 28 58 22 68Z" fill="%23FACC15"/><path d="M78 28C74 20 84 15 85 24Z" fill="%2365A30D"/><path d="M25 67C34 76 54 77 69 63" stroke="%23CA8A04" stroke-width="3" stroke-linecap="round"/></svg>`,
  batata: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23382513"/><ellipse cx="50" cy="50" rx="34" ry="26" fill="%23D97706"/><circle cx="38" cy="44" r="2.5" fill="%2392400E"/><circle cx="60" cy="42" r="3" fill="%2392400E"/><circle cx="50" cy="58" r="2.5" fill="%2392400E"/><circle cx="68" cy="54" r="2" fill="%2392400E"/></svg>`,
  queijo: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%231E293B"/><path d="M18 64L48 24L82 64H18Z" fill="%23F59E0B"/><path d="M18 64L30 76H72L82 64" fill="%23D97706"/><circle cx="44" cy="48" r="4.5" fill="%23B45309"/><circle cx="62" cy="54" r="6" fill="%23B45309"/><circle cx="34" cy="56" r="3" fill="%23B45309"/></svg>`,
};
