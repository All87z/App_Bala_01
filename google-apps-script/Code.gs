/**
 * =========================================================================
 * ASSISTENTE DE BALANÇA — API DE AUTENTICAÇÃO E SINCRONIZAÇÃO NUVEM
 * Google Sheets + Google Drive (Padrão RFC 2898 / PBKDF2-HMAC-SHA-256)
 * =========================================================================
 *
 * ARQUITETURA DE SEGURANÇA E PROTEÇÕES IMPLEMENTADAS:
 * 1. Salt Criptográfico: Geração de 256 bits (32 bytes) de entropia aleatória
 *    representados em 64 caracteres hexadecimais, convertidos em bytes reais no KDF.
 * 2. Senha sem Trim: A senha fornecida nunca sofre trim() ou alteração silenciosa.
 *    Exige-se no mínimo 12 caracteres tanto no cadastro quanto no login.
 * 3. Pasta de Imagens Obrigatória: Se PASTA_IMAGENS_ID não estiver definida nas
 *    ScriptProperties, a entrega de imagens é estritamente bloqueada.
 *    Valida-se também se o arquivo pertence à pasta autorizada e possui MIME type de imagem.
 * 4. Proteção contra Força Bruta por Operador: Bloqueio temporário (15 minutos)
 *    após 5 tentativas consecutivas incorretas para a mesma matrícula via CacheService,
 *    evitando que tentativas em um usuário bloqueiem os demais.
 * 5. Padrão RFC 2898 (PBKDF2-HMAC-SHA-256): 10.000 iterações de HMAC-SHA-256,
 *    bloco 1 big-endian [0,0,0,1], produzindo chave derivada de 256 bits (64 hex).
 * 6. Métodos HTTP Estritos: Rejeição absoluta de credenciais/tokens na URL (query string).
 *    Todas as operações exigem HTTP POST com dados exclusivamente no corpo.
 * 7. Proteção contra Sobrescrita Acidental: cadastrarNovoOperador() bloqueia se a
 *    matrícula já existir. Alterações de senha exigem a função explícita redefinirSenhaOperador().
 * 8. ScriptProperties: PLANILHA_ID e PASTA_IMAGENS_ID mantidos em propriedades privadas.
 *    Abas e dados existentes nunca são apagados ou sobrescritos na inicialização.
 */

// =========================================================================
// CONFIGURAÇÕES GERAIS DO SISTEMA
// =========================================================================
var CONFIG = {
  // Nomes das abas da planilha
  ABA_PRODUTOS: 'Produtos',
  ABA_OPERADORES: 'Operadores',
  ABA_SESSOES: 'Sessoes',

  // Parâmetros de segurança e criptografia
  DURACAO_SESSAO_DIAS: 30,         // Validade do token de sessão (dias)
  ITERACOES_PBKDF2: 10000,         // Rodadas padrão PBKDF2-HMAC-SHA-256 (RFC 2898)
  TAMANHO_MINIMO_SENHA: 12,        // Tamanho mínimo obrigatório de senha (sem trim)
  MAX_TENTATIVAS_FALHAS_LOGIN: 5,  // Máximo de erros antes do bloqueio por matrícula
  TEMPO_BLOQUEIO_SEGUNDOS: 900,    // 15 minutos de bloqueio temporário
};

/**
 * Ponto de entrada HTTP POST (Único método aceito para operações do sistema)
 */
function doPost(e) {
  return processarRequisicao(e, 'POST');
}

/**
 * Ponto de entrada HTTP GET (Bloqueado para operações com dados)
 */
function doGet(e) {
  return processarRequisicao(e, 'GET');
}

/**
 * Processador central de requisições com validações rígidas de método e corpo
 */
function processarRequisicao(e, metodoHttp) {
  try {
    // 1. REJEIÇÃO IMEDIATA: Tokens ou credenciais na URL (query string)
    if (e && e.parameter) {
      var qParams = e.parameter;
      if (qParams.token || qParams.senha || qParams.matricula) {
        return responderJSON({
          sucesso: false,
          erro: 'Violação de segurança: credenciais e tokens não podem trafegar na URL (query string). Envie-os exclusivamente no corpo da requisição POST.'
        });
      }
    }

    // 2. REJEIÇÃO DE MÉTODOS DIFERENTES DE POST
    if (metodoHttp !== 'POST') {
      return responderJSON({
        sucesso: false,
        erro: 'Método não permitido: todas as operações protegidas (login, logout, sincronizar, imagem) exigem requisição HTTP POST.'
      });
    }

    // 3. EXTRAÇÃO EXCLUSIVA DO CORPO DA REQUISIÇÃO POST (NUNCA DA QUERY STRING)
    var bodyParams = extrairParametrosCorpoPost(e);
    var action = (bodyParams.action || '').trim().toLowerCase();

    if (!action) {
      return responderJSON({
        sucesso: false,
        erro: 'Ação não informada no corpo da requisição POST.'
      });
    }

    // Rota 1: Login de Operador (Matrícula + Senha)
    if (action === 'login') {
      return rotaLogin(bodyParams.matricula, bodyParams.senha);
    }

    // Rota 2: Logout / Encerramento de Sessão
    if (action === 'logout') {
      return rotaLogout(bodyParams.token);
    }

    // Rota 3: Sincronização do Catálogo de Produtos
    if (action === 'sincronizar' || action === 'produtos') {
      return rotaSincronizar(bodyParams.token);
    }

    // Rota 4: Download de Imagem Privada do Drive
    if (action === 'imagem') {
      return rotaImagem(bodyParams.token, bodyParams.id);
    }

    return responderJSON({
      sucesso: false,
      erro: 'Ação não reconhecida: ' + action
    });

  } catch (error) {
    return responderJSON({
      sucesso: false,
      erro: 'Erro interno no servidor: ' + error.message
    });
  }
}

/**
 * Decodifica com segurança os parâmetros presentes exclusivamente no corpo POST
 */
function extrairParametrosCorpoPost(e) {
  var params = {};
  if (!e || !e.postData || !e.postData.contents) {
    return params;
  }

  var contents = e.postData.contents;
  var trimmed = contents.trim();

  // Caso seja JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      params = JSON.parse(trimmed);
      return params;
    } catch (errJson) {
      // Continua para form-urlencoded
    }
  }

  // Caso seja Form-UrlEncoded (application/x-www-form-urlencoded)
  var pairs = contents.split('&');
  for (var p = 0; p < pairs.length; p++) {
    var pair = pairs[p].split('=');
    if (pair.length === 2) {
      var chave = decodeURIComponent(pair[0].replace(/\+/g, ' '));
      var valor = decodeURIComponent(pair[1].replace(/\+/g, ' '));
      params[chave] = valor;
    }
  }

  return params;
}

// =========================================================================
// ACESSO SEGURO A PROPRIEDADES, PLANILHA E PASTA DE IMAGENS
// =========================================================================

/**
 * Lê propriedade do ScriptProperties de forma segura, sem expor IDs no código
 */
function obterPropriedadeConfig(nomeChave) {
  try {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty(nomeChave);
    if (val && val.trim() !== '') {
      return val.trim();
    }
  } catch (eProps) {}
  return '';
}

/**
 * Obtém a planilha do sistema usando PLANILHA_ID configurado em ScriptProperties
 * ou o container ativo vinculado.
 */
function obterPlanilha() {
  var planilhaId = obterPropriedadeConfig('PLANILHA_ID');
  if (planilhaId) {
    try {
      return SpreadsheetApp.openById(planilhaId);
    } catch (e) {
      throw new Error('Falha ao abrir planilha com PLANILHA_ID configurado: ' + e.message);
    }
  }

  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) {
    return ativa;
  }

  throw new Error('PLANILHA_ID não foi encontrada em ScriptProperties e não há planilha ativa vinculada.');
}

/**
 * Obtém o ID da pasta privada de imagens configurada em ScriptProperties
 */
function obterPastaImagensId() {
  return obterPropriedadeConfig('PASTA_IMAGENS_ID');
}

// =========================================================================
// CONTROLE DE TENTATIVAS DE LOGIN (RATE LIMITING POR MATRÍCULA)
// =========================================================================

/**
 * Verifica se a matrícula informada está sob bloqueio temporário por falhas repetidas
 */
function verificarBloqueioTentativas(matricula) {
  try {
    var cache = CacheService.getScriptCache();
    var lockKey = 'lock_mat_' + matricula;
    var bloqueadoAte = cache.get(lockKey);
    if (bloqueadoAte) {
      var restanteMin = Math.ceil((parseInt(bloqueadoAte, 10) - new Date().getTime()) / 60000);
      return {
        bloqueado: true,
        minutos: restanteMin > 0 ? restanteMin : 1
      };
    }
  } catch (eCache) {}
  return { bloqueado: false };
}

/**
 * Registra uma tentativa de login falha e aciona o bloqueio temporário se atingir o limite
 */
function registrarTentativaFalha(matricula) {
  try {
    var cache = CacheService.getScriptCache();
    var failKey = 'fail_mat_' + matricula;
    var lockKey = 'lock_mat_' + matricula;
    var falhas = parseInt(cache.get(failKey) || '0', 10) + 1;

    if (falhas >= CONFIG.MAX_TENTATIVAS_FALHAS_LOGIN) {
      var expiraTimestamp = new Date().getTime() + (CONFIG.TEMPO_BLOQUEIO_SEGUNDOS * 1000);
      cache.put(lockKey, String(expiraTimestamp), CONFIG.TEMPO_BLOQUEIO_SEGUNDOS);
      cache.remove(failKey);
    } else {
      cache.put(failKey, String(falhas), CONFIG.TEMPO_BLOQUEIO_SEGUNDOS);
    }
  } catch (eCache) {}
}

/**
 * Reseta o contador de falhas após um login bem-sucedido
 */
function limparTentativasFalhas(matricula) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('fail_mat_' + matricula);
    cache.remove('lock_mat_' + matricula);
  } catch (eCache) {}
}

// =========================================================================
// ROTA 1: LOGIN DO OPERADOR
// =========================================================================
function rotaLogin(matricula, senha) {
  if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') {
    return responderJSON({
      sucesso: false,
      erro: 'A matrícula é obrigatória.'
    });
  }

  // IMPORTANTE: A validação de tamanho da senha é feita SEM trim() para não alterar o valor original
  if (typeof senha !== 'string' || senha.length < CONFIG.TAMANHO_MINIMO_SENHA) {
    return responderJSON({
      sucesso: false,
      erro: 'A senha informada não atende aos requisitos mínimos de segurança (' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres).'
    });
  }

  var matLimpa = String(matricula).trim().toUpperCase();

  // Verifica proteção contra ataques de força bruta para esta matrícula específica
  var statusBloqueio = verificarBloqueioTentativas(matLimpa);
  if (statusBloqueio.bloqueado) {
    return responderJSON({
      sucesso: false,
      erro: 'Matrícula bloqueada temporariamente por excesso de tentativas incorretas. Tente novamente em ' + statusBloqueio.minutos + ' minuto(s).'
    });
  }

  var ss = obterPlanilha();
  var abaOperadores = ss.getSheetByName(CONFIG.ABA_OPERADORES);

  if (!abaOperadores) {
    return responderJSON({
      sucesso: false,
      erro: 'Aba "' + CONFIG.ABA_OPERADORES + '" não encontrada. Execute inicializarSistema() na planilha.'
    });
  }

  var dados = abaOperadores.getDataRange().getValues();
  if (dados.length <= 1) {
    return responderJSON({
      sucesso: false,
      erro: 'Nenhum operador cadastrado no sistema.'
    });
  }

  var operadorEncontrado = null;

  for (var i = 1; i < dados.length; i++) {
    var rowMat = String(dados[i][0]).trim().toUpperCase();
    if (rowMat === matLimpa) {
      operadorEncontrado = {
        linha: i + 1,
        matricula: String(dados[i][0]).trim(),
        nome: String(dados[i][1]).trim(),
        hashEsperado: String(dados[i][2]).trim(),
        salt: String(dados[i][3]).trim(),
        status: String(dados[i][4]).trim().toUpperCase()
      };
      break;
    }
  }

  if (!operadorEncontrado) {
    // Registra falha para a matrícula tentada
    registrarTentativaFalha(matLimpa);
    return responderJSON({
      sucesso: false,
      erro: 'Credenciais inválidas.'
    });
  }

  if (operadorEncontrado.status !== 'ATIVO') {
    return responderJSON({
      sucesso: false,
      erro: 'Operador desativado pela supervisão.'
    });
  }

  // Derivação com PBKDF2-HMAC-SHA-256 usando a senha pura SEM trim() e o salt em formato hex
  var hashCalculado = pbkdf2HmacSha256(senha, operadorEncontrado.salt, CONFIG.ITERACOES_PBKDF2);

  // Comparação em tempo constante contra ataques de temporização (Timing Attacks)
  if (!compararTempoConstante(hashCalculado, operadorEncontrado.hashEsperado)) {
    registrarTentativaFalha(matLimpa);
    return responderJSON({
      sucesso: false,
      erro: 'Credenciais inválidas.'
    });
  }

  // Login bem-sucedido: limpa o contador de falhas
  limparTentativasFalhas(matLimpa);

  // Gera token de sessão criptográfico (dois UUIDs combinados)
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var agora = new Date();
  var expiresAt = new Date(agora.getTime() + (CONFIG.DURACAO_SESSAO_DIAS * 24 * 60 * 60 * 1000));

  salvarSessao(token, operadorEncontrado.matricula, operadorEncontrado.nome, expiresAt);

  return responderJSON({
    sucesso: true,
    token: token,
    expiresAt: expiresAt.getTime(),
    operador: {
      matricula: operadorEncontrado.matricula,
      nome: operadorEncontrado.nome
    }
  });
}

// =========================================================================
// ROTA 2: LOGOUT / REVOGAÇÃO DE SESSÃO
// =========================================================================
function rotaLogout(token) {
  if (!token) {
    return responderJSON({ sucesso: true });
  }

  var ss = obterPlanilha();
  var abaSessoes = ss.getSheetByName(CONFIG.ABA_SESSOES);
  if (abaSessoes) {
    var dados = abaSessoes.getDataRange().getValues();
    var cleanToken = String(token).trim();
    for (var i = dados.length - 1; i >= 1; i--) {
      if (String(dados[i][0]).trim() === cleanToken) {
        abaSessoes.deleteRow(i + 1);
      }
    }
  }

  return responderJSON({
    sucesso: true,
    mensagem: 'Sessão encerrada com sucesso.'
  });
}

// =========================================================================
// ROTA 3: CONSULTA E SINCRONIZAÇÃO DO CATÁLOGO DE PRODUTOS
// =========================================================================
function rotaSincronizar(token) {
  var sessaoValida = validarSessao(token);
  if (!sessaoValida.valido) {
    return responderJSON({
      sucesso: false,
      sessaoExpirada: true,
      erro: sessaoValida.motivo || 'Acesso negado: sessão inválida ou expirada.'
    });
  }

  var ss = obterPlanilha();
  var abaProdutos = ss.getSheetByName(CONFIG.ABA_PRODUTOS);

  if (!abaProdutos) {
    return responderJSON({
      sucesso: false,
      erro: 'Aba de produtos "' + CONFIG.ABA_PRODUTOS + '" não encontrada na planilha.'
    });
  }

  var dados = abaProdutos.getDataRange().getValues();
  if (dados.length <= 1) {
    return responderJSON({
      sucesso: true,
      total: 0,
      produtos: []
    });
  }

  var cabecalhos = dados[0].map(function(c) {
    var s = String(c).trim().toLowerCase();
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (eNorm) {}
    return s;
  });

  var idxId = cabecalhos.indexOf('id');
  var idxNome = cabecalhos.indexOf('nome');
  if (idxNome === -1) idxNome = cabecalhos.indexOf('produto');
  if (idxNome === -1) idxNome = cabecalhos.indexOf('descricao');

  var idxCodigo = cabecalhos.indexOf('codigo');
  if (idxCodigo === -1) idxCodigo = cabecalhos.indexOf('cod');

  var idxPreco = cabecalhos.indexOf('preco');
  if (idxPreco === -1) idxPreco = cabecalhos.indexOf('valor');

  var idxCategoria = cabecalhos.indexOf('categoria');

  var idxImagemId = cabecalhos.indexOf('imagem_id');
  if (idxImagemId === -1) idxImagemId = cabecalhos.indexOf('imagem');
  if (idxImagemId === -1) idxImagemId = cabecalhos.indexOf('foto');
  if (idxImagemId === -1) idxImagemId = cabecalhos.indexOf('arquivo');

  var idxAtualizadoEm = cabecalhos.indexOf('atualizado_em');
  var idxUnidade = cabecalhos.indexOf('unidade');
  var idxDisponibilidade = cabecalhos.indexOf('disponibilidade');
  if (idxDisponibilidade === -1) idxDisponibilidade = cabecalhos.indexOf('disponivel');

  var listaProdutos = [];

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var codigoStr = idxCodigo !== -1 ? String(linha[idxCodigo]).trim() : '';

    if (!codigoStr) continue;

    var nomeStr = idxNome !== -1 ? String(linha[idxNome]).trim() : 'Produto sem nome';
    var idStr = idxId !== -1 && linha[idxId] ? String(linha[idxId]).trim() : 'PROD_' + codigoStr;
    var precoStr = idxPreco !== -1 && linha[idxPreco] !== '' ? String(linha[idxPreco]).trim() : '';
    var categoriaStr = idxCategoria !== -1 ? String(linha[idxCategoria]).trim() : '';
    var imagemIdStr = idxImagemId !== -1 ? String(linha[idxImagemId]).trim() : '';

    // Se a coluna de imagem estiver vazia, associa automaticamente ao código do produto (ex: PROD001.jpg)
    if (!imagemIdStr && codigoStr) {
      imagemIdStr = codigoStr + '.jpg';
    }

    var unidadeStr = idxUnidade !== -1 && linha[idxUnidade] ? String(linha[idxUnidade]).trim().toLowerCase() : 'kg';
    var atualizadoEmStr = idxAtualizadoEm !== -1 ? String(linha[idxAtualizadoEm]) : '';

    var disponivel = true;
    if (idxDisponibilidade !== -1) {
      var valDisp = String(linha[idxDisponibilidade]).trim().toLowerCase();
      if (valDisp === 'false' || valDisp === 'não' || valDisp === 'nao' || valDisp === 'esgotado' || valDisp === '0') {
        disponivel = false;
      }
    }

    listaProdutos.push({
      id: idStr,
      nome: nomeStr,
      codigo: codigoStr, // PRESERVADO RIGOROSAMENTE COMO STRING (ZEROS À ESQUERDA PRESERVADOS)
      preco: precoStr,
      categoria: categoriaStr,
      imagem_id: imagemIdStr,
      atualizado_em: atualizadoEmStr,
      unidade: unidadeStr,
      disponibilidade: disponivel
    });
  }

  return responderJSON({
    sucesso: true,
    total: listaProdutos.length,
    operador: sessaoValida.operador,
    produtos: listaProdutos
  });
}

// =========================================================================
// ROTA 4: DOWNLOAD DE IMAGEM PRIVADA COM RESTRIÇÃO À PASTA_IMAGENS_ID
// =========================================================================
function rotaImagem(token, imageId) {
  var sessaoValida = validarSessao(token);
  if (!sessaoValida.valido) {
    return responderJSON({
      sucesso: false,
      sessaoExpirada: true,
      erro: 'Acesso negado à imagem: sessão inválida ou não autorizada.'
    });
  }

  // RESTRIÇÃO OBRIGATÓRIA: Se PASTA_IMAGENS_ID não estiver definida, a rota NEGA imediatamente
  var pastaIdEsperada = obterPastaImagensId();
  if (!pastaIdEsperada || pastaIdEsperada.trim() === '') {
    return responderJSON({
      sucesso: false,
      erro: 'Acesso negado: PASTA_IMAGENS_ID não configurada nas ScriptProperties. A entrega de imagens está bloqueada por segurança.'
    });
  }

  if (!imageId || String(imageId).trim() === '') {
    return responderJSON({
      sucesso: false,
      erro: 'ID ou nome da imagem não informado.'
    });
  }

  var cleanId = String(imageId).trim();
  var pastaIdLimpa = pastaIdEsperada.trim();

  try {
    var file = null;

    // 1. Tenta buscar primeiro por ID direto do Drive caso pareça um ID de arquivo (sem extensão e comprimento típico)
    if (cleanId.indexOf('.') === -1 && cleanId.length >= 25) {
      try {
        file = DriveApp.getFileById(cleanId);
      } catch (eId) {
        file = null;
      }
    }

    // 2. Se não for ID ou não encontrou por ID, busca diretamente pelo nome do arquivo na PASTA_IMAGENS_ID
    if (!file) {
      var pasta = DriveApp.getFolderById(pastaIdLimpa);
      var arquivosPorNome = pasta.getFilesByName(cleanId);
      if (arquivosPorNome.hasNext()) {
        file = arquivosPorNome.next();
      } else {
        // Tenta também com extensões de imagem comuns caso o identificador venha sem extensão
        var extensoes = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG'];
        for (var ex = 0; ex < extensoes.length; ex++) {
          var arqsExt = pasta.getFilesByName(cleanId + extensoes[ex]);
          if (arqsExt.hasNext()) {
            file = arqsExt.next();
            break;
          }
        }
      }
    }

    if (!file) {
      return responderJSON({
        sucesso: false,
        erro: 'Arquivo de imagem "' + cleanId + '" não encontrado na pasta autorizada.'
      });
    }

    // Validação de parentesco estrita: o arquivo precisa pertencer à pasta autorizada
    var pais = file.getParents();
    var pertenceAPasta = false;

    while (pais.hasNext()) {
      var pai = pais.next();
      if (pai.getId() === pastaIdLimpa) {
        pertenceAPasta = true;
        break;
      }
    }

    if (!pertenceAPasta) {
      return responderJSON({
        sucesso: false,
        erro: 'Acesso negado: o arquivo solicitado não pertence à pasta autorizada de imagens.'
      });
    }

    // Validação estrita de tipo MIME: apenas formatos de imagem reais são entregues
    var blob = file.getBlob();
    var mimeType = blob.getContentType() || 'image/jpeg';
    if (!mimeType.toLowerCase().startsWith('image/')) {
      return responderJSON({
        sucesso: false,
        erro: 'Acesso negado: o arquivo solicitado não é uma imagem válida.'
      });
    }

    var base64Data = Utilities.base64Encode(blob.getBytes());

    return responderJSON({
      sucesso: true,
      id: cleanId,
      mimeType: mimeType,
      base64: base64Data
    });
  } catch (errDrive) {
    return responderJSON({
      sucesso: false,
      erro: 'Falha ao acessar o arquivo de imagem no Drive: ' + errDrive.message
    });
  }
}

// =========================================================================
// VALIDAÇÃO E EXPIRAÇÃO DE SESSÕES
// =========================================================================
function validarSessao(token) {
  if (!token || String(token).trim() === '') {
    return { valido: false, motivo: 'Token de autenticação não fornecido.' };
  }

  var cleanToken = String(token).trim();
  var ss = obterPlanilha();
  var abaSessoes = ss.getSheetByName(CONFIG.ABA_SESSOES);
  if (!abaSessoes) {
    return { valido: false, motivo: 'Tabela de sessões não inicializada.' };
  }

  var dadosSessoes = abaSessoes.getDataRange().getValues();
  var sessaoEncontrada = null;
  var linhaSessao = -1;
  var agora = new Date().getTime();

  for (var i = 1; i < dadosSessoes.length; i++) {
    if (String(dadosSessoes[i][0]).trim() === cleanToken) {
      var exp = new Date(dadosSessoes[i][3]).getTime();
      if (agora > exp) {
        abaSessoes.deleteRow(i + 1);
        return { valido: false, motivo: 'Sessão expirada. Faça login novamente.' };
      }
      sessaoEncontrada = {
        token: cleanToken,
        matricula: String(dadosSessoes[i][1]).trim(),
        nome: String(dadosSessoes[i][2]).trim(),
        expiresAt: exp
      };
      linhaSessao = i + 1;
      break;
    }
  }

  if (!sessaoEncontrada) {
    return { valido: false, motivo: 'Sessão não encontrada ou revogada.' };
  }

  // Verifica se o operador continua ATIVO na aba Operadores
  var abaOperadores = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (abaOperadores) {
    var dadosOp = abaOperadores.getDataRange().getValues();
    var operadorAtivo = false;
    for (var j = 1; j < dadosOp.length; j++) {
      if (String(dadosOp[j][0]).trim().toUpperCase() === sessaoEncontrada.matricula.toUpperCase()) {
        if (String(dadosOp[j][4]).trim().toUpperCase() === 'ATIVO') {
          operadorAtivo = true;
        }
        break;
      }
    }

    if (!operadorAtivo) {
      if (linhaSessao > 0) {
        abaSessoes.deleteRow(linhaSessao);
      }
      return { valido: false, motivo: 'Operador foi desativado pela supervisão.' };
    }
  }

  return {
    valido: true,
    operador: {
      matricula: sessaoEncontrada.matricula,
      nome: sessaoEncontrada.nome
    }
  };
}

/**
 * Salva a nova sessão na aba Sessoes e limpa sessões expiradas antigas
 */
function salvarSessao(token, matricula, nome, expiresAt) {
  var ss = obterPlanilha();
  var abaSessoes = ss.getSheetByName(CONFIG.ABA_SESSOES);
  if (!abaSessoes) {
    abaSessoes = ss.insertSheet(CONFIG.ABA_SESSOES);
    abaSessoes.appendRow(['Token', 'Matricula', 'Nome', 'ExpiraEm', 'CriadoEm']);
  }

  try {
    var dados = abaSessoes.getDataRange().getValues();
    var agora = new Date().getTime();
    for (var i = dados.length - 1; i >= 1; i--) {
      var exp = new Date(dados[i][3]).getTime();
      if (agora > exp) {
        abaSessoes.deleteRow(i + 1);
      }
    }
  } catch (eLimpeza) {}

  abaSessoes.appendRow([token, matricula, nome, expiresAt, new Date()]);
}

// =========================================================================
// CRIPTOGRAFIA: SALT DE 256 BITS E PADRÃO RFC 2898 (PBKDF2-HMAC-SHA-256)
// =========================================================================

/**
 * Converte string hexadecimal para array de bytes numéricos inteiros
 */
function hexParaBytes(hexStr) {
  var bytes = [];
  for (var i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * Gera Salt criptográfico de 256 bits (32 bytes de entropia real),
 * garantindo aleatoriedade através da combinação de múltiplos UUIDs e digest criptográfico.
 * Retorna string hexadecimal de 64 caracteres.
 */
function gerarSaltHex256Bits() {
  var seed = Utilities.getUuid() + '::' + Utilities.getUuid() + '::' + new Date().getTime() + '::' + Math.random();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i] < 0 ? digest[i] + 256 : digest[i];
    var h = b.toString(16);
    hex += (h.length === 1 ? '0' + h : h);
  }
  return hex;
}

/**
 * Implementação exata do padrão RFC 2898 / PKCS #5 v2.0 (PBKDF2 com PRF HMAC-SHA-256)
 * Chave derivada: dkLen = 32 bytes (256 bits).
 *
 * @param {string} password - Senha pura sem trim()
 * @param {string} saltHex - Salt em hexadecimal (64 caracteres = 32 bytes)
 * @param {number} iterations - Número de rodadas (ex: 10000)
 * @returns {string} Hash hexadecimal minúsculo de 64 caracteres
 */
function pbkdf2HmacSha256(password, saltHex, iterations) {
  var rounds = iterations || CONFIG.ITERACOES_PBKDF2 || 10000;

  // Converte a representação hexadecimal do salt em bytes reais
  var saltBytes = hexParaBytes(saltHex);

  // Bloco 1 com representação big-endian de 4 bytes [0x00, 0x00, 0x00, 0x01] (RFC 2898)
  var uInitialBytes = new Array(saltBytes.length + 4);
  for (var s = 0; s < saltBytes.length; s++) {
    uInitialBytes[s] = saltBytes[s];
  }
  uInitialBytes[saltBytes.length] = 0;
  uInitialBytes[saltBytes.length + 1] = 0;
  uInitialBytes[saltBytes.length + 2] = 0;
  uInitialBytes[saltBytes.length + 3] = 1;

  // U_1 = PRF(Password, Salt || INT_32_BE(1))
  var u = Utilities.computeHmacSha256Signature(uInitialBytes, password, Utilities.Charset.UTF_8);
  var f = u.slice(0); // Acumulador F_1 = U_1

  // U_2 ... U_c gerados iterativamente: U_j = PRF(Password, U_{j-1})
  for (var round = 2; round <= rounds; round++) {
    u = Utilities.computeHmacSha256Signature(u, password, Utilities.Charset.UTF_8);
    for (var b = 0; b < 32; b++) {
      f[b] ^= u[b];
    }
  }

  // Converte os 32 bytes (256 bits) resultantes em string hexadecimal minúscula
  var hex = f.map(function(b) {
    var bytePositivo = b < 0 ? b + 256 : b;
    var h = bytePositivo.toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');

  return hex;
}

/**
 * Comparação em tempo constante para mitigar ataques de temporização (Timing Attacks)
 */
function compararTempoConstante(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  var diferenca = 0;
  for (var i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

/**
 * Resposta formatada em JSON com cabeçalho seguro
 */
function responderJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// FUNÇÕES DE ADMINISTRAÇÃO E CONFIGURAÇÃO (EXECUTADAS NO EDITOR OU PLANILHA)
// =========================================================================

/**
 * Define de forma segura PLANILHA_ID e PASTA_IMAGENS_ID no ScriptProperties
 * sem expor os IDs no código versionado.
 */
function configurarPropriedades(planilhaId, pastaImagensId) {
  var props = PropertiesService.getScriptProperties();
  var novasProps = {};
  if (planilhaId && String(planilhaId).trim() !== '') {
    novasProps['PLANILHA_ID'] = String(planilhaId).trim();
  }
  if (pastaImagensId && String(pastaImagensId).trim() !== '') {
    novasProps['PASTA_IMAGENS_ID'] = String(pastaImagensId).trim();
  }
  props.setProperties(novasProps);
  Logger.log('Propriedades gravadas em ScriptProperties com sucesso: ' + JSON.stringify(novasProps));
}

/**
 * Exibe as propriedades atualmente gravadas em ScriptProperties
 */
function exibirPropriedadesAtuais() {
  var props = PropertiesService.getScriptProperties().getProperties();
  Logger.log('Propriedades em ScriptProperties: ' + JSON.stringify(props));
  return props;
}

/**
 * Executar uma vez no editor ou no menu para criar as abas com a estrutura correta.
 * Não apaga nem sobrescreve dados de abas que já existam.
 */
function inicializarSistema() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PLANILHA_ID')) {
    var ativa = SpreadsheetApp.getActiveSpreadsheet();
    if (ativa) {
      props.setProperty('PLANILHA_ID', ativa.getId());
      Logger.log('PLANILHA_ID detectada automaticamente e salva em ScriptProperties: ' + ativa.getId());
    }
  }

  var ss = obterPlanilha();

  // 1. Cria ou valida aba Operadores (preserva dados existentes sem sobrescrever)
  var abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (!abaOp) {
    abaOp = ss.insertSheet(CONFIG.ABA_OPERADORES);
    abaOp.appendRow(['Matricula', 'Nome', 'Hash_PBKDF2', 'Salt_Seguranca', 'Status', 'CriadoEm']);
    abaOp.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    Logger.log('Aba "Operadores" criada.');
  }

  // 2. Cria ou valida aba Sessoes (preserva dados existentes sem sobrescrever)
  var abaSess = ss.getSheetByName(CONFIG.ABA_SESSOES);
  if (!abaSess) {
    abaSess = ss.insertSheet(CONFIG.ABA_SESSOES);
    abaSess.appendRow(['Token', 'Matricula', 'Nome', 'ExpiraEm', 'CriadoEm']);
    abaSess.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0f172a').setFontColor('#38bdf8');
    Logger.log('Aba "Sessoes" criada.');
  }
}

/**
 * Cadastra um NOVO operador com PBKDF2-HMAC-SHA-256 e Salt de 256 bits.
 * PROTEÇÃO ATIVA: Se a matrícula já existir, recusa o cadastro para evitar sobrescrita acidental.
 * Para alterar a senha de alguém existente, use explicitamente redefinirSenhaOperador().
 */
function cadastrarNovoOperador(matricula, nome, senhaPlana) {
  if (typeof senhaPlana !== 'string' || senhaPlana.length < CONFIG.TAMANHO_MINIMO_SENHA) {
    throw new Error('A senha deve conter no mínimo ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres (sem espaços omitidos).');
  }
  if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') {
    throw new Error('A matrícula é obrigatória.');
  }
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new Error('O nome é obrigatório.');
  }

  var ss = obterPlanilha();
  var abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (!abaOp) {
    inicializarSistema();
    abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  }

  var matLimpa = String(matricula).trim().toUpperCase();
  var dados = abaOp.getDataRange().getValues();

  // Verifica se a matrícula já existe
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toUpperCase() === matLimpa) {
      throw new Error('A matrícula ' + matLimpa + ' já está cadastrada. Para trocar a senha ou atualizar dados, use a opção específica "Redefinir Senha de Operador".');
    }
  }

  // Salt de 256 bits (32 bytes) em formato hexadecimal de 64 caracteres
  var saltHex = gerarSaltHex256Bits();
  // Hash PBKDF2 calculado com a senha original SEM trim()
  var hash = pbkdf2HmacSha256(senhaPlana, saltHex, CONFIG.ITERACOES_PBKDF2);

  abaOp.appendRow([matLimpa, String(nome).trim(), hash, saltHex, 'ATIVO', new Date()]);
  Logger.log('Novo operador ' + matLimpa + ' cadastrado com sucesso.');
}

/**
 * Redefine a senha de um operador existente com confirmação deliberada,
 * sem reativar operadores que estejam marcados como INATIVO sem intenção.
 */
function redefinirSenhaOperador(matricula, novaSenhaPlana, reativarSeInativo) {
  if (typeof novaSenhaPlana !== 'string' || novaSenhaPlana.length < CONFIG.TAMANHO_MINIMO_SENHA) {
    throw new Error('A nova senha deve conter no mínimo ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres.');
  }
  if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') {
    throw new Error('A matrícula é obrigatória.');
  }

  var ss = obterPlanilha();
  var abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (!abaOp) throw new Error('Aba Operadores não encontrada.');

  var matLimpa = String(matricula).trim().toUpperCase();
  var dados = abaOp.getDataRange().getValues();
  var linha = -1;
  var statusAtual = '';

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toUpperCase() === matLimpa) {
      linha = i + 1;
      statusAtual = String(dados[i][4]).trim().toUpperCase();
      break;
    }
  }

  if (linha === -1) {
    throw new Error('Matrícula ' + matLimpa + ' não encontrada na aba Operadores.');
  }

  var novoSalt = gerarSaltHex256Bits();
  var novoHash = pbkdf2HmacSha256(novaSenhaPlana, novoSalt, CONFIG.ITERACOES_PBKDF2);

  abaOp.getRange(linha, 3).setValue(novoHash);
  abaOp.getRange(linha, 4).setValue(novoSalt);

  if (reativarSeInativo && statusAtual === 'INATIVO') {
    abaOp.getRange(linha, 5).setValue('ATIVO');
  }

  // Revoga todas as sessões antigas para forçar novo login com a nova senha
  desativarOperadorSessoes(matLimpa);
  Logger.log('Senha do operador ' + matLimpa + ' redefinida com sucesso.');
}

/**
 * Desativa operador e revoga instantaneamente todas as suas sessões
 */
function desativarOperador(matricula) {
  var ss = obterPlanilha();
  var abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (!abaOp) return;

  var matLimpa = String(matricula).trim().toUpperCase();
  var dados = abaOp.getDataRange().getValues();

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toUpperCase() === matLimpa) {
      abaOp.getRange(i + 1, 5).setValue('INATIVO');
      Logger.log('Operador ' + matLimpa + ' marcado como INATIVO.');
      break;
    }
  }

  desativarOperadorSessoes(matLimpa);
}

/**
 * Revoga todas as sessões ativas de um operador
 */
function desativarOperadorSessoes(matricula) {
  var ss = obterPlanilha();
  var abaSess = ss.getSheetByName(CONFIG.ABA_SESSOES);
  if (!abaSess) return;

  var matLimpa = String(matricula).trim().toUpperCase();
  var sessoes = abaSess.getDataRange().getValues();
  for (var j = sessoes.length - 1; j >= 1; j--) {
    if (String(sessoes[j][1]).trim().toUpperCase() === matLimpa) {
      abaSess.deleteRow(j + 1);
    }
  }
}

/**
 * Menu interativo adicionado na barra superior do Google Sheets ao abrir a planilha
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('Assistente de Balança')
      .addItem('1. Inicializar Abas do Sistema', 'inicializarSistema')
      .addItem('2. Cadastrar Novo Operador (Seguro)', 'cadastrarOperadorViaPrompt')
      .addItem('3. Redefinir Senha de Operador (Seguro)', 'redefinirSenhaOperadorViaPrompt')
      .addItem('4. Desativar Operador', 'desativarOperadorViaPrompt')
      .addToUi();
  } catch (e) {}
}

/**
 * Cadastra operador de forma 100% interativa e segura através de popups na planilha.
 * A senha é digitada diretamente na janela e NUNCA fica gravada no código nem nos logs!
 */
function cadastrarOperadorViaPrompt() {
  var ui = SpreadsheetApp.getUi();

  var respMat = ui.prompt('Cadastro de Operador', 'Digite a Matrícula do novo operador (ex: OP001):', ui.ButtonSet.OK_CANCEL);
  if (respMat.getSelectedButton() !== ui.Button.OK) return;
  var matricula = respMat.getResponseText().trim();
  if (!matricula) {
    ui.alert('Erro', 'A matrícula não pode ser vazia.', ui.ButtonSet.OK);
    return;
  }

  // Verifica se a matrícula já existe para avisar imediatamente
  var ss = obterPlanilha();
  var abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (abaOp) {
    var dados = abaOp.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim().toUpperCase() === matricula.toUpperCase()) {
        ui.alert(
          'Matrícula Já Cadastrada',
          'A matrícula ' + matricula.toUpperCase() + ' já existe na planilha.\n\nPara alterar a senha ou dados deste operador, utilize o menu "3. Redefinir Senha de Operador".',
          ui.ButtonSet.OK
        );
        return;
      }
    }
  }

  var respNome = ui.prompt('Cadastro de Operador', 'Digite o Nome do operador (ex: Maria Silva):', ui.ButtonSet.OK_CANCEL);
  if (respNome.getSelectedButton() !== ui.Button.OK) return;
  var nome = respNome.getResponseText().trim();
  if (!nome) {
    ui.alert('Erro', 'O nome não pode ser vazio.', ui.ButtonSet.OK);
    return;
  }

  var respSenha = ui.prompt(
    'Cadastro de Operador',
    'Digite a Senha individual do operador (mínimo de ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres):',
    ui.ButtonSet.OK_CANCEL
  );
  if (respSenha.getSelectedButton() !== ui.Button.OK) return;
  // A senha é lida SEM trim()
  var senha = respSenha.getResponseText();
  if (!senha || senha.length < CONFIG.TAMANHO_MINIMO_SENHA) {
    ui.alert(
      'Erro de Segurança',
      'A senha deve conter no mínimo ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres.',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    cadastrarNovoOperador(matricula, nome, senha);
    ui.alert('Sucesso', 'Operador ' + matricula.toUpperCase() + ' (' + nome + ') cadastrado com sucesso com PBKDF2!', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Erro no Cadastro', err.message, ui.ButtonSet.OK);
  }
}

/**
 * Redefine a senha de um operador existente com confirmação deliberada
 */
function redefinirSenhaOperadorViaPrompt() {
  var ui = SpreadsheetApp.getUi();

  var respMat = ui.prompt('Redefinir Senha', 'Digite a Matrícula do operador existente:', ui.ButtonSet.OK_CANCEL);
  if (respMat.getSelectedButton() !== ui.Button.OK) return;
  var matricula = respMat.getResponseText().trim();
  if (!matricula) return;

  var respSenha = ui.prompt(
    'Redefinir Senha',
    'Digite a NOVA senha individual (mínimo de ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres):',
    ui.ButtonSet.OK_CANCEL
  );
  if (respSenha.getSelectedButton() !== ui.Button.OK) return;
  var novaSenha = respSenha.getResponseText();
  if (!novaSenha || novaSenha.length < CONFIG.TAMANHO_MINIMO_SENHA) {
    ui.alert('Erro', 'A nova senha deve conter no mínimo ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres.', ui.ButtonSet.OK);
    return;
  }

  var confirm = ui.alert(
    'Confirmar Alteração',
    'Tem certeza de que deseja substituir a senha da matrícula ' + matricula.toUpperCase() + '?\nTodas as sessões ativas serão desconectadas.',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  try {
    redefinirSenhaOperador(matricula, novaSenha, false);
    ui.alert('Sucesso', 'Senha da matrícula ' + matricula.toUpperCase() + ' redefinida com sucesso!', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Erro', err.message, ui.ButtonSet.OK);
  }
}

/**
 * Desativa operador interativamente através de janela modal na planilha
 */
function desativarOperadorViaPrompt() {
  var ui = SpreadsheetApp.getUi();
  var respMat = ui.prompt('Desativar Operador', 'Digite a Matrícula do operador a ser desativado:', ui.ButtonSet.OK_CANCEL);
  if (respMat.getSelectedButton() !== ui.Button.OK) return;
  var matricula = respMat.getResponseText().trim();
  if (!matricula) return;

  desativarOperador(matricula);
  ui.alert('Aviso', 'Operador ' + matricula.toUpperCase() + ' marcado como INATIVO e suas sessões foram revogadas.', ui.ButtonSet.OK);
}
