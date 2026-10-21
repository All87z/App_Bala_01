/**
 * Processa e compacta imagens selecionadas da galeria para referência visual offline no app
 * Otimiza tamanho (~10KB-18KB) para caber com folga no armazenamento local sem perda visual
 */
export async function processGalleryImage(file: File): Promise<string> {
  if (!file) {
    throw new Error('Nenhum arquivo de imagem fornecido.');
  }

  // Lê como DataURL via FileReader (método mais estável e seguro para WebViews e offline)
  const rawDataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const MAX_SIZE = 240; // Ideal para 30x30px no card e preview detalhado no modal
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          // Se não conseguir ler dimensões, retorna o dataUrl bruto diretamente
          resolve(rawDataUrl);
          return;
        }

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

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        // Fundo escuro padrão do app para imagens PNG com transparência
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Exporta como JPEG otimizado
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('Fallback para imagem original por erro no canvas:', err);
        resolve(rawDataUrl);
      }
    };

    img.onerror = () => {
      // Se a tag img falhar ao decodificar, tenta retornar o dataUrl bruto
      resolve(rawDataUrl);
    };

    img.src = rawDataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) resolve(res);
      else reject(new Error('Falha ao ler dados da imagem.'));
    };
    reader.onerror = () => reject(new Error('Erro de leitura do arquivo.'));
    reader.readAsDataURL(file);
  });
}

// Ilustrações SVG elegantes para os produtos iniciais
export const DEFAULT_ILLUSTRATIONS = {
  banana: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23422006"/><path d="M22 68C30 80 54 82 72 65C82 55 86 38 85 24C81 25 76 29 74 34C70 48 64 62 48 64C38 65 28 58 22 68Z" fill="%23FACC15"/><path d="M78 28C74 20 84 15 85 24Z" fill="%2365A30D"/><path d="M25 67C34 76 54 77 69 63" stroke="%23CA8A04" stroke-width="3" stroke-linecap="round"/></svg>`,
  batata: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23382513"/><ellipse cx="50" cy="50" rx="34" ry="26" fill="%23D97706"/><circle cx="38" cy="44" r="2.5" fill="%2392400E"/><circle cx="60" cy="42" r="3" fill="%2392400E"/><circle cx="50" cy="58" r="2.5" fill="%2392400E"/><circle cx="68" cy="54" r="2" fill="%2392400E"/></svg>`,
  queijo: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%231E293B"/><path d="M18 64L48 24L82 64H18Z" fill="%23F59E0B"/><path d="M18 64L30 76H72L82 64" fill="%23D97706"/><circle cx="44" cy="48" r="4.5" fill="%23B45309"/><circle cx="62" cy="54" r="6" fill="%23B45309"/><circle cx="34" cy="56" r="3" fill="%23B45309"/></svg>`,
};
