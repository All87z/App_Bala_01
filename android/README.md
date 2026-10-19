# Assistente de Balança — Aplicativo Android Nativo (Kotlin + Jetpack Compose + Room)

Aplicativo nativo desenvolvido em **Kotlin**, **Jetpack Compose** e **Room (SQLite local)**, projetado especialmente para operadores de caixa, feirantes, quitandas, açougues e supermercados consultarem códigos de balança de forma instantânea e 100% offline.

---

## 🚀 Como testar no Computador e Instalar no Celular (Passo a Passo para Iniciantes)

### 1. Baixar o Android Studio
1. Se ainda não tiver, baixe e instale o [Android Studio](https://developer.android.com/studio) (versão gratuita oficial do Google).
2. Na instalação, aceite os componentes padrões (Android SDK e Android Virtual Device).

### 2. Abrir o Projeto no Android Studio
1. Abra o **Android Studio**.
2. Na tela inicial, clique em **Open** (ou no menu superior `File > Open...`).
3. Selecione a pasta `android/` deste projeto.
4. O Android Studio fará o carregamento automático das dependências (**Gradle Sync**). Aguarde terminar (uma barra de progresso azul aparece no rodapé).

### 3. Testar no Emulador (No Computador)
1. No menu superior do Android Studio, clique no ícone do celular (**Device Manager** no canto superior direito).
2. Se não tiver um emulador criado, clique em **Create Device**, escolha um modelo (ex: **Pixel 7**) e clique em **Finish**.
3. Selecione o emulador na lista superior de dispositivos.
4. Clique no botão verde de **Play (Run 'app')** ou aperte `Shift + F10`.
5. O emulador abrirá com o "Assistente de Balança" já pronto para uso!

### 4. Instalar Direto no Celular Físico via Cabo USB (Sem complicação)
1. No seu celular Android:
   - Abra **Configurações > Sobre o telefone**.
   - Toque 7 vezes seguidas em **Número da versão** até aparecer "Você agora é um desenvolvedor!".
   - Volte em **Configurações > Sistema > Opções do desenvolvedor** e ative **Depuração USB**.
2. Conecte o celular ao computador pelo cabo USB.
3. No celular, confirme a mensagem "Permitir depuração USB?".
4. No Android Studio, o nome do seu celular aparecerá na lista de dispositivos no topo.
5. Clique no botão verde **Play (Run)**. O aplicativo será instalado diretamente no seu celular em segundos!

### 5. Como Gerar o Arquivo APK Instalável para Compartilhar
1. No menu superior do Android Studio, clique em:
   `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
2. Aguarde alguns segundos.
3. Quando terminar, aparecerá uma notificação no canto inferior direito:
   `APK(s) generated successfully for 1 module`.
4. Clique na palavra azul **locate** dentro dessa notificação.
5. O arquivo `app-debug.apk` estará lá! Você pode enviar esse arquivo pelo WhatsApp, e-mail ou pendrive para qualquer celular Android e tocar nele para instalar.

---

## 🛠️ Tecnologias e Arquitetura

- **Linguagem**: Kotlin 2.0.21.
- **Interface**: Jetpack Compose com Material 3, tema de alto contraste e tipografia ampla com fontes mono-espaçadas para leitura rápida a metros de distância.
- **Banco de Dados Local**: Room 2.6.1 sobre SQLite nativo.
  - O banco chama-se `balanca_database.db`.
  - Persiste 100% no aparelho, sem depender de internet.
  - Não apaga ao atualizar o aplicativo.
  - Códigos salvos como texto (`String`) para não perder zeros à esquerda (ex: `005`).
- **Busca Instantânea Inteligente**:
  - `TextNormalizer`: remove acentos (ex: *mussarela* acha *Queijo mussarela*, *maca* acha *Maçã*).
  - Filtro em tempo real sem precisar de botão Enter.
  - Busca tanto pelo nome quanto pelo código.
- **Reconhecimento de Voz**:
  - Utiliza o motor de fala nativo do Android (`SpeechRecognizer`) configurado para `pt-BR`.
  - Solicita permissão `RECORD_AUDIO` apenas no primeiro uso.
  - **Aviso sobre voz offline**: Se o aparelho não tiver o pacote de idioma português baixado para reconhecimento offline nas configurações do sistema (`Configurações > Google > Voz > Reconhecimento de fala offline`), o app avisa amigavelmente e mantém a busca por texto 100% disponível.
- **Backup e Restauração**:
  - Importação e exportação em formato padrão CSV (separado por ponto e vírgula ou vírgula).
