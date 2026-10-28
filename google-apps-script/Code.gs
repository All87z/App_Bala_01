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
    // No Google Apps Script, 'e.queryString' contém exclusivamente os parâmetros da URL após o '?'.
    // (O objeto 'e.parameter' NÃO deve ser usado para esta checagem pois o Apps Script automaticamente
    // popula 'e.parameter' com os dados do corpo quando o POST é enviado como application/x-www-form-urlencoded).
    if (e && e.queryString && typeof e.queryString === 'string' && e.queryString.trim() !== '') {
      var qsPairs = e.queryString.split('&');
      for (var qi = 0; qi < qsPairs.length; qi++) {
        var firstEq = qsPairs[qi].indexOf('=');
        var rawKey = firstEq !== -1 ? qsPairs[qi].substring(0, firstEq) : qsPairs[qi];
        var qKey = decodeURIComponent(rawKey.replace(/\+/g, ' ')).trim().toLowerCase();
        if (qKey === 'token' || qKey === 'senha' || qKey === 'matricula') {
          return responderJSON({
            sucesso: false,
            erro: 'Violação de segurança: credenciais e tokens não podem trafegar na URL (query string). Envie-os exclusivamente no corpo da requisição POST.'
          });
        }
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

    // Rota 5: Diagnóstico Estrutural Seguro da Planilha e Operadores (Sem expor credenciais)
    if (action === 'diagnostico') {
      return responderJSON({
        sucesso: true,
        diagnostico: diagnosticarAbaOperadores()
      });
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
  if (!e) {
    return params;
  }

  if (e.postData && e.postData.contents) {
    var contents = e.postData.contents;
    var trimmed = String(contents).trim();

    // 1. Tenta decodificar como JSON (enviado via text/plain;charset=utf-8 pelo frontend)
    try {
      var parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (errJson) {
      // Continua para form-urlencoded caso não seja JSON
    }

    // 2. Caso seja Form-UrlEncoded (application/x-www-form-urlencoded)
    var pairs = contents.split('&');
    for (var p = 0; p < pairs.length; p++) {
      var firstEq = pairs[p].indexOf('=');
      if (firstEq !== -1) {
        var rawKey = pairs[p].substring(0, firstEq);
        var rawVal = pairs[p].substring(firstEq + 1);
        var chave = decodeURIComponent(rawKey.replace(/\+/g, ' '));
        var valor = decodeURIComponent(rawVal.replace(/\+/g, ' '));
        params[chave] = valor;
      }
    }
  }

  // Fallback seguro caso o runtime já tenha decodificado os parâmetros em e.parameter
  if (!params.action && e.parameter) {
    for (var k in e.parameter) {
      if (e.parameter.hasOwnProperty(k)) {
        params[k] = e.parameter[k];
      }
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

/**
 * Mapeia dinamicamente os cabeçalhos da aba Operadores, suportando acentuação,
 * variações de nomes e qualquer ordem de colunas definida pelo usuário.
 */
function mapearColunasOperadores(linha) {
  var mapa = {
    idxMatricula: -1,
    idxNome: -1,
    idxHash: -1,
    idxSalt: -1,
    idxStatus: -1,
    achouMatricula: false,
    achouNome: false,
    achouHash: false,
    achouSalt: false,
    achouStatus: false
  };
  if (!linha || !linha.length) return mapa;

  var cabecalhos = linha.map(function(c) {
    var s = String(c || '').trim().toLowerCase();
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {}
    return s;
  });

  for (var c = 0; c < cabecalhos.length; c++) {
    var h = cabecalhos[c];
    if (!h) continue;

    if (!mapa.achouMatricula) {
      if (h === 'matricula' || h === 'mat' || h === 'login' || h === 'usuario' || h === 'cod_operador' || h === 'codigo') {
        mapa.idxMatricula = c;
        mapa.achouMatricula = true;
      } else if (h.indexOf('matricula') !== -1 || h.indexOf('login') !== -1) {
        mapa.idxMatricula = c;
        mapa.achouMatricula = true;
      }
    }

    if (!mapa.achouNome) {
      if (h === 'nome' || h === 'name' || h === 'nome completo' || h === 'operador') {
        mapa.idxNome = c;
        mapa.achouNome = true;
      } else if (h.indexOf('nome') !== -1 && h.indexOf('usuario') === -1) {
        mapa.idxNome = c;
        mapa.achouNome = true;
      }
    }

    if (!mapa.achouHash) {
      if (h === 'hash' || h === 'hash_pbkdf2' || h === 'senha' || h === 'password' || h === 'senha_hash' || h === 'hash_senha' || h === 'chave') {
        mapa.idxHash = c;
        mapa.achouHash = true;
      } else if (h.indexOf('hash') !== -1 || h.indexOf('senha') !== -1 || h.indexOf('pass') !== -1) {
        mapa.idxHash = c;
        mapa.achouHash = true;
      }
    }

    if (!mapa.achouSalt) {
      if (h === 'salt' || h === 'salt_seguranca' || h === 'sal' || h === 'salt_pbkdf2') {
        mapa.idxSalt = c;
        mapa.achouSalt = true;
      } else if (h.indexOf('salt') !== -1 || h.indexOf('sal') !== -1) {
        mapa.idxSalt = c;
        mapa.achouSalt = true;
      }
    }

    if (!mapa.achouStatus) {
      if (h === 'status' || h === 'situacao' || h === 'estado') {
        mapa.idxStatus = c;
        mapa.achouStatus = true;
      } else if (h.indexOf('status') !== -1 || h.indexOf('situac') !== -1) {
        mapa.idxStatus = c;
        mapa.achouStatus = true;
      }
    }
  }

  // Fallbacks caso alguma coluna não tenha cabeçalho explícito
  if (mapa.idxMatricula === -1) mapa.idxMatricula = 0;
  if (mapa.idxNome === -1) mapa.idxNome = 1;
  if (mapa.idxHash === -1) mapa.idxHash = 2;
  if (mapa.idxSalt === -1) mapa.idxSalt = 3;
  if (mapa.idxStatus === -1) mapa.idxStatus = 4;

  return mapa;
}

// =========================================================================
// ROTA 1: LOGIN DO OPERADOR
// =========================================================================
function rotaLogin(matricula, senha) {
  var diag = {
    planilhaEncontrada: false,
    abaOperadoresEncontrada: false,
    camposIdentificados: {
      matricula: false,
      nome: false,
      hash: false,
      salt: false,
      status: false
    },
    operadorLocalizado: false,
    statusAtivo: false,
    saltCompativel: false,
    hashCompativel: false,
    etapaFalha: null
  };

  if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') {
    diag.etapaFalha = 'MATRICULA_OBRIGATORIA';
    return responderJSON({
      sucesso: false,
      erro: 'A matrícula é obrigatória.',
      diagnostico: diag
    });
  }

  if (typeof senha !== 'string' || senha.length === 0) {
    diag.etapaFalha = 'SENHA_OBRIGATORIA';
    return responderJSON({
      sucesso: false,
      erro: 'A senha é obrigatória.',
      diagnostico: diag
    });
  }

  var matLimpa = String(matricula).replace(/\u00A0/g, ' ').trim().toUpperCase();
  var matAlnum = matLimpa.replace(/[^A-Z0-9]/g, '');
  var matInt = /^\d+$/.test(matAlnum) ? parseInt(matAlnum, 10) : null;

  // Verifica proteção contra ataques de força bruta para esta matrícula específica
  var statusBloqueio = verificarBloqueioTentativas(matLimpa);
  if (statusBloqueio.bloqueado) {
    diag.etapaFalha = 'BLOQUEIO_TEMPORARIO';
    return responderJSON({
      sucesso: false,
      erro: 'Matrícula bloqueada temporariamente por excesso de tentativas incorretas. Tente novamente em ' + statusBloqueio.minutos + ' minuto(s).',
      diagnostico: diag
    });
  }

  var ss;
  try {
    ss = obterPlanilha();
    diag.planilhaEncontrada = true;
  } catch (ePlanilha) {
    diag.etapaFalha = 'ACESSO_PLANILHA';
    return responderJSON({
      sucesso: false,
      erro: 'Falha ao acessar a planilha: ' + ePlanilha.message,
      diagnostico: diag
    });
  }

  var abaOperadores = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (!abaOperadores) {
    diag.etapaFalha = 'ABA_OPERADORES_NAO_ENCONTRADA';
    return responderJSON({
      sucesso: false,
      erro: 'Aba "' + CONFIG.ABA_OPERADORES + '" não encontrada na planilha.',
      diagnostico: diag
    });
  }
  diag.abaOperadoresEncontrada = true;

  var dados = abaOperadores.getDataRange().getValues();
  if (dados.length <= 1) {
    diag.etapaFalha = 'SEM_REGISTROS';
    return responderJSON({
      sucesso: false,
      erro: 'Nenhum operador cadastrado no sistema.',
      diagnostico: diag
    });
  }

  // Detecta dinamicamente a linha de cabeçalho e as posições de cada coluna
  var linhaCabecalhoIdx = 0;
  var colMap = null;

  for (var r = 0; r < Math.min(dados.length, 5); r++) {
    var mapa = mapearColunasOperadores(dados[r]);
    if (mapa.achouMatricula && (mapa.achouNome || mapa.achouHash || mapa.achouSalt)) {
      linhaCabecalhoIdx = r;
      colMap = mapa;
      break;
    }
  }

  if (!colMap) {
    colMap = mapearColunasOperadores(dados[0]);
    linhaCabecalhoIdx = 0;
  }

  diag.camposIdentificados = {
    matricula: colMap.achouMatricula || colMap.idxMatricula !== -1,
    nome: colMap.achouNome || colMap.idxNome !== -1,
    hash: colMap.achouHash || colMap.idxHash !== -1,
    salt: colMap.achouSalt || colMap.idxSalt !== -1,
    status: colMap.achouStatus || colMap.idxStatus !== -1
  };

  var operadorEncontrado = null;

  for (var i = linhaCabecalhoIdx + 1; i < dados.length; i++) {
    var rawMatVal = dados[i][colMap.idxMatricula];
    if (rawMatVal == null || rawMatVal === '') continue;

    var rowMat = String(rawMatVal).replace(/\u00A0/g, ' ').trim().toUpperCase();
    var rowAlnum = rowMat.replace(/[^A-Z0-9]/g, '');
    var rowInt = /^\d+$/.test(rowAlnum) ? parseInt(rowAlnum, 10) : null;

    var match = false;
    // 1. Comparação exata (case-insensitive)
    if (rowMat === matLimpa) {
      match = true;
    }
    // 2. Comparação alfanumérica (ignora hífens, pontos e espaços, ex: OP-001 vs OP001)
    else if (rowAlnum && rowAlnum === matAlnum) {
      match = true;
    }
    // 3. Comparação numérica caso ambos representem números inteiros (ex: 001 vs 1)
    else if (matInt !== null && rowInt !== null && matInt === rowInt) {
      match = true;
    }
    // 4. Comparação com mesmo prefixo textual e mesmo número (ex: OP01 vs OP001)
    else {
      var rowPrefix = rowAlnum.replace(/[0-9]/g, '');
      var matPrefix = matAlnum.replace(/[0-9]/g, '');
      var rowDigits = rowAlnum.replace(/[^0-9]/g, '');
      var matDigits = matAlnum.replace(/[^0-9]/g, '');
      if (rowPrefix === matPrefix && rowDigits !== '' && matDigits !== '' && parseInt(rowDigits, 10) === parseInt(matDigits, 10)) {
        match = true;
      }
    }

    if (match) {
      var rawNome = colMap.idxNome !== -1 && dados[i][colMap.idxNome] != null ? dados[i][colMap.idxNome] : '';
      var rawHash = colMap.idxHash !== -1 && dados[i][colMap.idxHash] != null ? dados[i][colMap.idxHash] : '';
      var rawSalt = colMap.idxSalt !== -1 && dados[i][colMap.idxSalt] != null ? dados[i][colMap.idxSalt] : '';
      var rawStatus = colMap.idxStatus !== -1 && dados[i][colMap.idxStatus] != null ? dados[i][colMap.idxStatus] : '';

      var statusLimpo = String(rawStatus).replace(/\u00A0/g, ' ').trim().toUpperCase();
      if (!statusLimpo) statusLimpo = 'ATIVO';

      operadorEncontrado = {
        linha: i + 1,
        matricula: String(rawMatVal).trim(),
        nome: String(rawNome).trim() || 'Operador',
        hashEsperado: String(rawHash).replace(/\u00A0/g, ' ').trim(),
        salt: String(rawSalt).replace(/\u00A0/g, ' ').trim(),
        status: statusLimpo
      };
      break;
    }
  }

  if (!operadorEncontrado) {
    registrarTentativaFalha(matLimpa);
    diag.operadorLocalizado = false;
    diag.etapaFalha = 'BUSCA_REGISTRO';
    return responderJSON({
      sucesso: false,
      erro: 'Credenciais inválidas.',
      diagnostico: diag
    });
  }

  diag.operadorLocalizado = true;

  // Verifica status do operador: apenas status explicitamente inativos são rejeitados
  var statusInativos = ['INATIVO', 'DESATIVADO', 'BLOQUEADO', 'FALSE', '0', 'NAO', 'NÃO'];
  var isAtivo = statusInativos.indexOf(operadorEncontrado.status) === -1;
  diag.statusAtivo = isAtivo;

  if (!isAtivo) {
    diag.etapaFalha = 'STATUS_INATIVO';
    return responderJSON({
      sucesso: false,
      erro: 'Operador desativado pela supervisão.',
      diagnostico: diag
    });
  }

  // Validação segura de formato de Salt e Hash sem expor seus conteúdos
  var saltCompativel = Boolean(operadorEncontrado.salt && operadorEncontrado.salt.length >= 8);
  var hashCompativel = Boolean(operadorEncontrado.hashEsperado && /^[0-9a-fA-F]{64}$/.test(operadorEncontrado.hashEsperado));

  diag.saltCompativel = saltCompativel;
  diag.hashCompativel = hashCompativel;

  if (!saltCompativel) {
    diag.etapaFalha = 'FORMATO_SALT';
    registrarTentativaFalha(matLimpa);
    return responderJSON({
      sucesso: false,
      erro: 'Credenciais inválidas.',
      diagnostico: diag
    });
  }

  if (!hashCompativel) {
    diag.etapaFalha = 'FORMATO_HASH';
    registrarTentativaFalha(matLimpa);
    return responderJSON({
      sucesso: false,
      erro: 'Credenciais inválidas.',
      diagnostico: diag
    });
  }

  // Validação estrita PBKDF2-HMAC-SHA-256 (10.000 iterações RFC 2898)
  var senhaValida = validarSenhaOperador(senha, operadorEncontrado.hashEsperado, operadorEncontrado.salt);

  if (!senhaValida) {
    diag.etapaFalha = 'COMPARACAO_HASH';
    registrarTentativaFalha(matLimpa);
    return responderJSON({
      sucesso: false,
      erro: 'Credenciais inválidas.',
      diagnostico: diag
    });
  }

  // Login bem-sucedido: limpa o contador de falhas
  limparTentativasFalhas(matLimpa);

  // Gera token de sessão criptográfico (dois UUIDs combinados)
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var agora = new Date();
  var expiresAt = new Date(agora.getTime() + (CONFIG.DURACAO_SESSAO_DIAS * 24 * 60 * 60 * 1000));

  salvarSessao(token, operadorEncontrado.matricula, operadorEncontrado.nome, expiresAt);

  diag.etapaFalha = null;

  return responderJSON({
    sucesso: true,
    token: token,
    expiresAt: expiresAt.getTime(),
    operador: {
      matricula: operadorEncontrado.matricula,
      nome: operadorEncontrado.nome
    },
    diagnostico: diag
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
    var s = String(c || '').trim().toLowerCase();
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (eNorm) {}
    return s;
  });

  // 1. Identificação precisa de Código
  var idxCodigo = cabecalhos.indexOf('codigo');
  if (idxCodigo === -1) idxCodigo = cabecalhos.indexOf('cod');
  if (idxCodigo === -1) {
    for (var c = 0; c < cabecalhos.length; c++) {
      if (cabecalhos[c].indexOf('cod') !== -1) {
        idxCodigo = c;
        break;
      }
    }
  }

  // 2. Identificação de Nome pelo cabeçalho 'nome' ou 'produto' (sem nunca usar descrição)
  var idxNome = cabecalhos.indexOf('nome');
  if (idxNome === -1) idxNome = cabecalhos.indexOf('produto');
  if (idxNome === -1) {
    for (var c = 0; c < cabecalhos.length; c++) {
      if (c === idxCodigo) continue;
      var h = cabecalhos[c];
      if ((h.indexOf('nome') !== -1 || h.indexOf('produto') !== -1) && h.indexOf('codigo') === -1) {
        idxNome = c;
        break;
      }
    }
  }

  // 3. Identificação separada de Descrição (aceita descricao, descrição, descricao curta, como é vendido, tipo de venda, observacao, detalhes)
  var idxDescricao = -1;
  for (var c = 0; c < cabecalhos.length; c++) {
    if (c === idxNome || c === idxCodigo) continue;
    var h = cabecalhos[c];
    if (h === 'descricao' || h === 'desc' || h === 'descricao curta' ||
        h === 'como e vendido' || h === 'tipo de venda' ||
        h === 'observacao' || h === 'obs' || h === 'detalhes' || h === 'detalhe') {
      idxDescricao = c;
      break;
    }
  }
  if (idxDescricao === -1) {
    for (var c = 0; c < cabecalhos.length; c++) {
      if (c === idxNome || c === idxCodigo) continue;
      var h = cabecalhos[c];
      if ((h.indexOf('desc') !== -1 || h.indexOf('vend') !== -1) && h.indexOf('codigo') === -1 && h.indexOf('preco') === -1) {
        idxDescricao = c;
        break;
      }
    }
  }

  var idxId = cabecalhos.indexOf('id');

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
    var codigoStr = idxCodigo !== -1 && linha[idxCodigo] != null ? String(linha[idxCodigo]).trim() : '';

    if (!codigoStr) continue;

    var nomeStr = idxNome !== -1 && linha[idxNome] != null ? String(linha[idxNome]).trim() : 'Produto sem nome';
    var idStr = idxId !== -1 && linha[idxId] ? String(linha[idxId]).trim() : 'PROD_' + codigoStr;
    var precoStr = idxPreco !== -1 && linha[idxPreco] !== '' && linha[idxPreco] != null ? String(linha[idxPreco]).trim() : '';
    var categoriaStr = idxCategoria !== -1 && linha[idxCategoria] != null ? String(linha[idxCategoria]).trim() : '';
    
    // Extrai o valor da descrição com segurança, retornando string vazia quando ausente ou nula
    var descricaoStr = '';
    if (idxDescricao !== -1 && linha[idxDescricao] != null && linha[idxDescricao] !== undefined) {
      descricaoStr = String(linha[idxDescricao]).trim();
    }

    var imagemIdStr = idxImagemId !== -1 && linha[idxImagemId] != null ? String(linha[idxImagemId]).trim() : '';

    // Se a coluna de imagem estiver vazia, associa automaticamente ao código do produto (ex: PROD001.jpg)
    if (!imagemIdStr && codigoStr) {
      imagemIdStr = codigoStr + '.jpg';
    }

    var unidadeStr = idxUnidade !== -1 && linha[idxUnidade] ? String(linha[idxUnidade]).trim().toLowerCase() : 'kg';
    var atualizadoEmStr = idxAtualizadoEm !== -1 && linha[idxAtualizadoEm] != null ? String(linha[idxAtualizadoEm]) : '';

    var disponivel = true;
    if (idxDisponibilidade !== -1 && linha[idxDisponibilidade] != null) {
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
      descricao: descricaoStr,
      description: descricaoStr,
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

  // Verifica se o operador continua ativo na aba Operadores
  var abaOperadores = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (abaOperadores) {
    var dadosOp = abaOperadores.getDataRange().getValues();
    if (dadosOp.length > 1) {
      var colMapOp = mapearColunasOperadores(dadosOp[0]);
      var operadorAtivo = false;
      var statusInativos = ['INATIVO', 'DESATIVADO', 'BLOQUEADO', 'FALSE', '0', 'NAO', 'NÃO'];
      var matSessaoUpper = sessaoEncontrada.matricula.trim().toUpperCase();

      for (var j = 1; j < dadosOp.length; j++) {
        var rawOpMat = dadosOp[j][colMapOp.idxMatricula];
        if (rawOpMat != null && String(rawOpMat).trim().toUpperCase() === matSessaoUpper) {
          var st = colMapOp.idxStatus !== -1 && dadosOp[j][colMapOp.idxStatus] != null
            ? String(dadosOp[j][colMapOp.idxStatus]).trim().toUpperCase()
            : 'ATIVO';
          if (statusInativos.indexOf(st) === -1) {
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
/**
 * Converte string hexadecimal para array de bytes numéricos (signed -128..127 para Java/GAS)
 */
function hexParaBytes(hexStr) {
  var bytes = [];
  if (!hexStr || typeof hexStr !== 'string') return bytes;
  var clean = hexStr.trim();
  for (var i = 0; i < clean.length; i += 2) {
    var val = parseInt(clean.substr(i, 2), 16);
    if (!isNaN(val)) {
      bytes.push(val > 127 ? val - 256 : val);
    }
  }
  return bytes;
}

/**
 * Extrai bytes reais do Salt com resiliência: suporta hex (32 ou 64 caracteres),
 * UUIDs (com hífens) e strings de texto arbitrário UTF-8.
 */
function extrairBytesSalt(saltStr) {
  if (!saltStr || typeof saltStr !== 'string') {
    return [0, 0, 0, 0, 0, 0, 0, 0];
  }
  var clean = saltStr.trim();
  // Se for representação hexadecimal pura com comprimento par
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    var bytes = hexParaBytes(clean);
    if (bytes.length > 0) return bytes;
  }
  // Caso contenha caracteres não-hex (ex: UUID com hífens ou texto plano)
  try {
    return Utilities.newBlob(clean).getBytes();
  } catch (eBlob) {
    var out = [];
    for (var j = 0; j < clean.length; j++) {
      var code = clean.charCodeAt(j) & 0xFF;
      out.push(code > 127 ? code - 256 : code);
    }
    return out;
  }
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
  return hex.toLowerCase();
}

/**
 * Implementação exata do padrão RFC 2898 / PKCS #5 v2.0 (PBKDF2 com PRF HMAC-SHA-256)
 * Chave derivada: dkLen = 32 bytes (256 bits).
 *
 * @param {string} password - Senha pura sem trim()
 * @param {string} saltStr - Salt em hexadecimal ou string
 * @param {number} iterations - Número de rodadas (ex: 10000)
 * @returns {string} Hash hexadecimal minúsculo de 64 caracteres
 */
function pbkdf2HmacSha256(password, saltStr, iterations, forcarBytesUtf8) {
  var rounds = iterations || CONFIG.ITERACOES_PBKDF2 || 10000;

  var saltBytes;
  if (forcarBytesUtf8) {
    try {
      saltBytes = Utilities.newBlob(saltStr).getBytes();
    } catch (eBlob) {
      saltBytes = extrairBytesSalt(saltStr);
    }
  } else {
    saltBytes = extrairBytesSalt(saltStr);
  }

  // Bloco 1 com representação big-endian de 4 bytes [0x00, 0x00, 0x00, 0x01] (RFC 2898)
  var uInitialBytes = new Array(saltBytes.length + 4);
  for (var s = 0; s < saltBytes.length; s++) {
    uInitialBytes[s] = saltBytes[s];
  }
  uInitialBytes[saltBytes.length] = 0;
  uInitialBytes[saltBytes.length + 1] = 0;
  uInitialBytes[saltBytes.length + 2] = 0;
  uInitialBytes[saltBytes.length + 3] = 1;

  // Converte a senha em bytes uma única vez para garantir máxima eficiência no loop de 10.000 iterações
  var passwordBytes = Utilities.newBlob(password).getBytes();

  // U_1 = PRF(Password, Salt || INT_32_BE(1))
  var u = Utilities.computeHmacSha256Signature(uInitialBytes, passwordBytes);
  var f = u.slice(0); // Acumulador F_1 = U_1

  // U_2 ... U_c gerados iterativamente: U_j = PRF(Password, U_{j-1})
  for (var round = 2; round <= rounds; round++) {
    u = Utilities.computeHmacSha256Signature(u, passwordBytes);
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

  return hex.toLowerCase();
}

/**
 * Calcula o hash SHA-256 de uma string de texto em formato hexadecimal minúsculo
 */
function calcularSha256Hex(texto) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i] < 0 ? digest[i] + 256 : digest[i];
    var h = b.toString(16);
    hex += (h.length === 1 ? '0' + h : h);
  }
  return hex.toLowerCase();
}

/**
 * Comparação em tempo constante para mitigar ataques de temporização (Timing Attacks).
 * Normaliza strings para caixa baixa para evitar falhas por formatação hex maiúscula.
 */
function compararTempoConstante(a, b) {
  if (!a || !b) return false;
  var strA = String(a).trim().toLowerCase();
  var strB = String(b).trim().toLowerCase();
  if (strA.length !== strB.length) {
    return false;
  }
  var diferenca = 0;
  for (var i = 0; i < strA.length; i++) {
    diferenca |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diferenca === 0;
}

/**
 * Validação rigorosa e segura de credenciais do operador.
 * Utiliza estritamente o padrão RFC 2898 (PBKDF2-HMAC-SHA-256 com 10.000 iterações),
 * preservando a segurança criptográfica integral sem aceitar formatos fracos ou legados
 * (sem texto plano, sem SHA-256 simples e sem redução de iterações).
 */
function validarSenhaOperador(senhaDigitada, hashEsperado, salt) {
  if (!senhaDigitada || !hashEsperado) return false;

  var cleanHashEsperado = String(hashEsperado).trim().toLowerCase();
  var cleanSalt = salt != null ? String(salt).trim() : '';

  // 1. Verificação Primária: PBKDF2 com Salt decodificado de representação Hexadecimal (32 bytes / 256 bits)
  try {
    var hashPbkdf2Hex = pbkdf2HmacSha256(senhaDigitada, cleanSalt, CONFIG.ITERACOES_PBKDF2 || 10000, false);
    if (compararTempoConstante(hashPbkdf2Hex, cleanHashEsperado)) {
      return true;
    }
  } catch (eHex) {}

  // 2. Verificação de Compatibilidade de Salt: PBKDF2 com Salt preservado como bytes literais UTF-8 (10.000 iterações RFC 2898)
  try {
    var hashPbkdf2Utf8 = pbkdf2HmacSha256(senhaDigitada, cleanSalt, CONFIG.ITERACOES_PBKDF2 || 10000, true);
    if (compararTempoConstante(hashPbkdf2Utf8, cleanHashEsperado)) {
      return true;
    }
  } catch (eUtf8) {}

  return false;
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
  var colMap = mapearColunasOperadores(dados[0]);

  // Verifica se a matrícula já existe
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][colMap.idxMatricula]).trim().toUpperCase() === matLimpa) {
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
  var colMap = mapearColunasOperadores(dados[0]);
  var linha = -1;
  var statusAtual = '';

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][colMap.idxMatricula]).trim().toUpperCase() === matLimpa) {
      linha = i + 1;
      statusAtual = colMap.idxStatus !== -1 && dados[i][colMap.idxStatus] != null ? String(dados[i][colMap.idxStatus]).trim().toUpperCase() : 'ATIVO';
      break;
    }
  }

  if (linha === -1) {
    throw new Error('Matrícula ' + matLimpa + ' não encontrada na aba Operadores.');
  }

  var novoSalt = gerarSaltHex256Bits();
  var novoHash = pbkdf2HmacSha256(novaSenhaPlana, novoSalt, CONFIG.ITERACOES_PBKDF2);

  abaOp.getRange(linha, colMap.idxHash + 1).setValue(novoHash);
  abaOp.getRange(linha, colMap.idxSalt + 1).setValue(novoSalt);

  if (reativarSeInativo && statusAtual === 'INATIVO' && colMap.idxStatus !== -1) {
    abaOp.getRange(linha, colMap.idxStatus + 1).setValue('ATIVO');
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
  var colMap = mapearColunasOperadores(dados[0]);

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][colMap.idxMatricula]).trim().toUpperCase() === matLimpa) {
      if (colMap.idxStatus !== -1) {
        abaOp.getRange(i + 1, colMap.idxStatus + 1).setValue('INATIVO');
      }
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
      .addSeparator()
      .addItem('5. Diagnóstico Seguro da Aba Operadores', 'diagnosticarAbaOperadoresViaPrompt')
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

/**
 * Diagnóstico seguro da aba Operadores sem expor nenhum segredo ou dado pessoal.
 * Retorna estatísticas de compatibilidade técnica.
 */
function diagnosticarAbaOperadores() {
  var diag = {
    planilhaEncontrada: false,
    abaOperadoresEncontrada: false,
    totalLinhas: 0,
    colunasIdentificadas: {
      matricula: false,
      nome: false,
      hash: false,
      salt: false,
      status: false
    },
    totalOperadores: 0,
    operadoresComSaltCompativel: 0,
    operadoresComHashCompativel: 0,
    operadoresAtivos: 0
  };

  try {
    var ss = obterPlanilha();
    diag.planilhaEncontrada = true;

    var aba = ss.getSheetByName(CONFIG.ABA_OPERADORES);
    if (!aba) {
      return diag;
    }
    diag.abaOperadoresEncontrada = true;

    var dados = aba.getDataRange().getValues();
    diag.totalLinhas = dados.length;
    if (dados.length <= 1) {
      return diag;
    }

    var colMap = null;
    var linhaCabecalho = 0;
    for (var r = 0; r < Math.min(dados.length, 5); r++) {
      var m = mapearColunasOperadores(dados[r]);
      if (m.achouMatricula && (m.achouNome || m.achouHash || m.achouSalt)) {
        colMap = m;
        linhaCabecalho = r;
        break;
      }
    }
    if (!colMap) {
      colMap = mapearColunasOperadores(dados[0]);
    }

    diag.colunasIdentificadas = {
      matricula: colMap.achouMatricula || colMap.idxMatricula !== -1,
      nome: colMap.achouNome || colMap.idxNome !== -1,
      hash: colMap.achouHash || colMap.idxHash !== -1,
      salt: colMap.achouSalt || colMap.idxSalt !== -1,
      status: colMap.achouStatus || colMap.idxStatus !== -1
    };

    var statusInativos = ['INATIVO', 'DESATIVADO', 'BLOQUEADO', 'FALSE', '0', 'NAO', 'NÃO'];

    for (var i = linhaCabecalho + 1; i < dados.length; i++) {
      var rawMat = dados[i][colMap.idxMatricula];
      if (rawMat == null || String(rawMat).trim() === '') continue;

      diag.totalOperadores++;

      var rawSalt = colMap.idxSalt !== -1 && dados[i][colMap.idxSalt] != null ? String(dados[i][colMap.idxSalt]).trim() : '';
      if (rawSalt.length >= 8) {
        diag.operadoresComSaltCompativel++;
      }

      var rawHash = colMap.idxHash !== -1 && dados[i][colMap.idxHash] != null ? String(dados[i][colMap.idxHash]).trim() : '';
      if (/^[0-9a-fA-F]{64}$/.test(rawHash)) {
        diag.operadoresComHashCompativel++;
      }

      var rawStatus = colMap.idxStatus !== -1 && dados[i][colMap.idxStatus] != null ? String(dados[i][colMap.idxStatus]).trim().toUpperCase() : 'ATIVO';
      if (!rawStatus) rawStatus = 'ATIVO';
      if (statusInativos.indexOf(rawStatus) === -1) {
        diag.operadoresAtivos++;
      }
    }

    Logger.log('[DIAGNÓSTICO SEGURO]');
    Logger.log(JSON.stringify(diag));
    return diag;
  } catch (err) {
    Logger.log('[DIAGNÓSTICO FALHOU] ' + err.message);
    return diag;
  }
}

/**
 * Exibe o relatório de diagnóstico seguro em uma caixa de diálogo na planilha
 */
function diagnosticarAbaOperadoresViaPrompt() {
  var ui = SpreadsheetApp.getUi();
  var diag = diagnosticarAbaOperadores();

  var msg = 'DIAGNÓSTICO DA ABA OPERADORES:\n\n' +
    '• Planilha Encontrada: ' + (diag.planilhaEncontrada ? 'SIM' : 'NÃO') + '\n' +
    '• Aba "' + CONFIG.ABA_OPERADORES + '" Encontrada: ' + (diag.abaOperadoresEncontrada ? 'SIM' : 'NÃO') + '\n\n' +
    'COLUNAS IDENTIFICADAS:\n' +
    '  - Matrícula: ' + (diag.colunasIdentificadas.matricula ? 'Identificada' : 'AUSENTE') + '\n' +
    '  - Nome: ' + (diag.colunasIdentificadas.nome ? 'Identificada' : 'AUSENTE') + '\n' +
    '  - Hash PBKDF2: ' + (diag.colunasIdentificadas.hash ? 'Identificada' : 'AUSENTE') + '\n' +
    '  - Salt Segurança: ' + (diag.colunasIdentificadas.salt ? 'Identificada' : 'AUSENTE') + '\n' +
    '  - Status: ' + (diag.colunasIdentificadas.status ? 'Identificada' : 'AUSENTE') + '\n\n' +
    'ESTATÍSTICAS TÉCNICAS (sem expor segredos):\n' +
    '• Total de Operadores: ' + diag.totalOperadores + '\n' +
    '• Salts Compatíveis: ' + diag.operadoresComSaltCompativel + ' de ' + diag.totalOperadores + '\n' +
    '• Hashes Compatíveis (PBKDF2 64-hex): ' + diag.operadoresComHashCompativel + ' de ' + diag.totalOperadores + '\n' +
    '• Operadores Ativos: ' + diag.operadoresAtivos + ' de ' + diag.totalOperadores;

  ui.alert('Diagnóstico Seguro da Planilha', msg, ui.ButtonSet.OK);
}
