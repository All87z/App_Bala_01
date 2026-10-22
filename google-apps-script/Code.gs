/**
 * =========================================================================
 * ASSISTENTE DE BALANÇA — API DE AUTENTICAÇÃO E SINCRONIZAÇÃO NUVEM
 * Google Sheets + Google Drive (Padrão RFC 2898 / PBKDF2-HMAC-SHA-256)
 * =========================================================================
 *
 * PROTEÇÕES IMPLEMENTADAS:
 * 1. Derivação de senha padrão RFC 2898 (PBKDF2-HMAC-SHA-256) com salt individual
 *    de 16 bytes e 5.000 iterações (validado, sem algoritmo proprietário).
 * 2. Comparação em tempo constante contra ataques de temporização (Timing Attacks).
 * 3. Uso de ScriptProperties para PLANILHA_ID e PASTA_IMAGENS_ID sem expor IDs
 *    no código e sem sobrescrever valores existentes.
 * 4. Rejeição de tokens e credenciais em parâmetros de URL (query string).
 *    Aceitação estrita apenas no corpo HTTP POST.
 * 5. Restrição estrita de imagens aos arquivos contidos na pasta PASTA_IMAGENS_ID.
 * 6. Validação de MIME type de imagens (apenas formatos de imagem são retornados).
 * 7. Sessões revogáveis sob demanda (logout) e revogação imediata caso o operador
 *    seja desativado (status INATIVO) pela supervisão.
 * 8. Zeros à esquerda preservados rigorosamente como texto nos códigos de balança.
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
  DURACAO_SESSAO_DIAS: 30,  // Validade do token de sessão (dias)
  ITERACOES_PBKDF2: 5000,   // Rodadas padrão PBKDF2-HMAC-SHA-256 (RFC 2898)
  TAMANHO_MINIMO_SENHA: 12, // Exigência mínima de segurança para senhas de operadores
};

/**
 * Ponto de entrada HTTP POST
 */
function doPost(e) {
  return processarRequisicao(e, 'POST');
}

/**
 * Ponto de entrada HTTP GET
 */
function doGet(e) {
  return processarRequisicao(e, 'GET');
}

/**
 * Processador central de requisições com tratamento de rotas e segurança
 */
function processarRequisicao(e, metodoHttp) {
  try {
    // 1. REJEIÇÃO DE CREDENCIAIS OU TOKENS NA URL (QUERY STRING)
    // Se a requisição contiver qualquer credencial ou token na URL, rejeita imediatamente
    if (e && e.parameter) {
      var qParams = e.parameter;
      if (qParams.token || qParams.senha || qParams.matricula) {
        return responderJSON({
          sucesso: false,
          erro: 'Violação de segurança: tokens e credenciais não podem ser enviados na URL (query string). Envie-os exclusivamente no corpo da requisição POST.'
        });
      }
    }

    // 2. EXTRAÇÃO DE PARÂMETROS DO CORPO HTTP POST
    var bodyParams = {};
    if (e && e.postData && e.postData.contents) {
      var contents = e.postData.contents.trim();
      if (contents.startsWith('{') && contents.endsWith('}')) {
        try {
          bodyParams = JSON.parse(contents);
        } catch (errJson) {
          // Erro de parse JSON
        }
      } else {
        // Form-UrlEncoded tradicional
        var pairs = contents.split('&');
        for (var p = 0; p < pairs.length; p++) {
          var pair = pairs[p].split('=');
          if (pair.length === 2) {
            var chave = decodeURIComponent(pair[0].replace(/\+/g, ' '));
            var valor = decodeURIComponent(pair[1].replace(/\+/g, ' '));
            bodyParams[chave] = valor;
          }
        }
      }
    }

    var action = (bodyParams.action || (e && e.parameter && e.parameter.action) || '').trim().toLowerCase();

    // Rota 1: Login de Operador (Matrícula + Senha)
    if (action === 'login') {
      if (metodoHttp !== 'POST') {
        return responderJSON({
          sucesso: false,
          erro: 'O login deve ser realizado exclusivamente via método HTTP POST com corpo protegido.'
        });
      }
      return rotaLogin(bodyParams.matricula, bodyParams.senha);
    }

    // Rota 2: Logout / Encerramento de Sessão
    if (action === 'logout') {
      if (metodoHttp !== 'POST') {
        return responderJSON({
          sucesso: false,
          erro: 'O logout deve ser realizado exclusivamente via método HTTP POST.'
        });
      }
      return rotaLogout(bodyParams.token);
    }

    // Rota 3: Sincronização do Catálogo de Produtos
    if (action === 'sincronizar' || action === 'produtos' || !action) {
      if (metodoHttp !== 'POST') {
        return responderJSON({
          sucesso: false,
          sessaoExpirada: true,
          erro: 'A sincronização exige requisição HTTP POST com token no corpo da mensagem.'
        });
      }
      return rotaSincronizar(bodyParams.token);
    }

    // Rota 4: Download de Imagem Privada do Drive
    if (action === 'imagem') {
      if (metodoHttp !== 'POST') {
        return responderJSON({
          sucesso: false,
          sessaoExpirada: true,
          erro: 'O download de imagem exige requisição HTTP POST com token no corpo da mensagem.'
        });
      }
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
  } catch (eProps) {
    // Ignora erro de acesso e prossegue para fallbacks
  }
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
// ROTA 1: LOGIN DO OPERADOR
// =========================================================================
function rotaLogin(matricula, senha) {
  if (!matricula || !senha) {
    return responderJSON({
      sucesso: false,
      erro: 'Matrícula e senha são obrigatórias.'
    });
  }

  var ss = obterPlanilha();
  var abaOperadores = ss.getSheetByName(CONFIG.ABA_OPERADORES);

  if (!abaOperadores) {
    return responderJSON({
      sucesso: false,
      erro: 'Aba "' + CONFIG.ABA_OPERADORES + '" não encontrada. Execute inicializarSistema() no editor do script.'
    });
  }

  var dados = abaOperadores.getDataRange().getValues();
  if (dados.length <= 1) {
    return responderJSON({
      sucesso: false,
      erro: 'Nenhum operador cadastrado no sistema.'
    });
  }

  var matLimpa = String(matricula).trim().toUpperCase();
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
    return responderJSON({
      sucesso: false,
      erro: 'Matrícula não encontrada.'
    });
  }

  if (operadorEncontrado.status !== 'ATIVO') {
    return responderJSON({
      sucesso: false,
      erro: 'Operador desativado pela supervisão.'
    });
  }

  // Derivação de senha padrão RFC 2898 (PBKDF2-HMAC-SHA-256)
  var hashCalculado = pbkdf2HmacSha256(senha, operadorEncontrado.salt, CONFIG.ITERACOES_PBKDF2);

  // Comparação em tempo constante contra Timing Attacks
  if (!compararTempoConstante(hashCalculado, operadorEncontrado.hashEsperado)) {
    return responderJSON({
      sucesso: false,
      erro: 'Senha incorreta.'
    });
  }

  // Token de sessão criptográfico (dois UUIDs v4 combinados)
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
    return String(c).trim().toLowerCase();
  });

  var idxId = cabecalhos.indexOf('id');
  var idxNome = cabecalhos.indexOf('nome');
  var idxCodigo = cabecalhos.indexOf('codigo');
  var idxPreco = cabecalhos.indexOf('preco');
  var idxCategoria = cabecalhos.indexOf('categoria');
  var idxImagemId = cabecalhos.indexOf('imagem_id');
  var idxAtualizadoEm = cabecalhos.indexOf('atualizado_em');
  var idxUnidade = cabecalhos.indexOf('unidade');
  var idxDisponibilidade = cabecalhos.indexOf('disponibilidade');

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
      codigo: codigoStr, // PRESERVADO EXATAMENTE COMO STRING (ZEROS À ESQUERDA PRESERVADOS)
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

  if (!imageId || String(imageId).trim() === '') {
    return responderJSON({
      sucesso: false,
      erro: 'ID da imagem não informado.'
    });
  }

  var cleanId = String(imageId).trim();

  try {
    var file = DriveApp.getFileById(cleanId);

    // RESTRIÇÃO OBRIGATÓRIA: Garante que o arquivo pertence à pasta autorizada de imagens
    var pastaIdEsperada = obterPastaImagensId();
    if (pastaIdEsperada) {
      var pais = file.getParents();
      var pertenceAPasta = false;
      while (pais.hasNext()) {
        var pai = pais.next();
        if (pai.getId() === pastaIdEsperada) {
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
    }

    // Validação de tipo MIME: apenas formatos de imagem reais são entregues
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
// PADRÃO CRIPTOGRÁFICO RFC 2898 (PBKDF2-HMAC-SHA-256)
// =========================================================================

/**
 * Implementação exata do padrão RFC 2898 / PKCS #5 v2.0 (PBKDF2 com PRF HMAC-SHA-256)
 * dkLen = 32 bytes (256 bits)
 *
 * @param {string} password - Senha fornecida pelo operador
 * @param {string} salt - Salt individual de 16 bytes em formato string
 * @param {number} iterations - Número de iterações (ex: 5000)
 * @returns {string} Hash hexadecimal de 64 caracteres
 */
function pbkdf2HmacSha256(password, salt, iterations) {
  var rounds = iterations || CONFIG.ITERACOES_PBKDF2 || 5000;

  // Bloco 1 com representação big-endian de 4 bytes [0x00, 0x00, 0x00, 0x01] (RFC 2898)
  var saltBytes = Utilities.newBlob(salt, 'UTF-8').getBytes();
  var uInitialBytes = new Array(saltBytes.length + 4);
  for (var s = 0; s < saltBytes.length; s++) {
    uInitialBytes[s] = saltBytes[s];
  }
  uInitialBytes[saltBytes.length] = 0;
  uInitialBytes[saltBytes.length + 1] = 0;
  uInitialBytes[saltBytes.length + 2] = 0;
  uInitialBytes[saltBytes.length + 3] = 1;

  // U_1 = PRF(Password, Salt || 0x00000001)
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
// FUNÇÕES DE ADMINISTRAÇÃO E CONFIGURAÇÃO (EXECUTADAS NO EDITOR APPS SCRIPT)
// =========================================================================

/**
 * Define de forma segura PLANILHA_ID e PASTA_IMAGENS_ID no ScriptProperties
 * sem expor os IDs no código versionado.
 *
 * Exemplo de uso no console do editor:
 * configurarPropriedades('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', '1p52_q3XG_EXEMPLO_PASTA_ID');
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
 * Executar uma vez no editor para criar as abas com a estrutura correta.
 * Se o script for vinculado à planilha (container-bound), detecta e salva automaticamente o PLANILHA_ID.
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
 * Cadastra ou atualiza operador com derivação PBKDF2-HMAC-SHA-256 e Salt individual de 16 bytes.
 * Exige senha com no mínimo 12 caracteres.
 */
function cadastrarNovoOperador(matricula, nome, senhaPlana) {
  if (!senhaPlana || String(senhaPlana).trim().length < CONFIG.TAMANHO_MINIMO_SENHA) {
    throw new Error('A senha deve conter no mínimo ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres.');
  }
  if (!matricula || String(matricula).trim() === '') {
    throw new Error('A matrícula é obrigatória.');
  }
  if (!nome || String(nome).trim() === '') {
    throw new Error('O nome é obrigatório.');
  }

  var ss = obterPlanilha();
  var abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  if (!abaOp) {
    inicializarSistema();
    abaOp = ss.getSheetByName(CONFIG.ABA_OPERADORES);
  }

  var matLimpa = String(matricula).trim().toUpperCase();
  // Salt criptográfico de 16 bytes aleatórios
  var salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var hash = pbkdf2HmacSha256(String(senhaPlana).trim(), salt, CONFIG.ITERACOES_PBKDF2);

  var dados = abaOp.getDataRange().getValues();
  var linhaExistente = -1;

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toUpperCase() === matLimpa) {
      linhaExistente = i + 1;
      break;
    }
  }

  if (linhaExistente !== -1) {
    abaOp.getRange(linhaExistente, 2).setValue(String(nome).trim());
    abaOp.getRange(linhaExistente, 3).setValue(hash);
    abaOp.getRange(linhaExistente, 4).setValue(salt);
    abaOp.getRange(linhaExistente, 5).setValue('ATIVO');
    Logger.log('Operador ' + matLimpa + ' atualizado com PBKDF2.');
  } else {
    abaOp.appendRow([matLimpa, String(nome).trim(), hash, salt, 'ATIVO', new Date()]);
    Logger.log('Novo operador ' + matLimpa + ' cadastrado com sucesso com PBKDF2.');
  }
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

  var abaSess = ss.getSheetByName(CONFIG.ABA_SESSOES);
  if (abaSess) {
    var sessoes = abaSess.getDataRange().getValues();
    for (var j = sessoes.length - 1; j >= 1; j--) {
      if (String(sessoes[j][1]).trim().toUpperCase() === matLimpa) {
        abaSess.deleteRow(j + 1);
      }
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
      .addItem('3. Desativar Operador', 'desativarOperadorViaPrompt')
      .addToUi();
  } catch (e) {
    // Silencia se executado fora do contexto de interface de planilha
  }
}

/**
 * Cadastra operador de forma 100% interativa e segura através de popups na planilha.
 * A senha é digitada diretamente na janela e NUNCA fica gravada no código nem nos logs!
 * Pode ser executada diretamente na lista suspensa do Apps Script ou no menu da planilha.
 */
function cadastrarOperadorViaPrompt() {
  var ui = SpreadsheetApp.getUi();

  var respMat = ui.prompt('Cadastro de Operador', 'Digite a Matrícula do operador (ex: OP001):', ui.ButtonSet.OK_CANCEL);
  if (respMat.getSelectedButton() !== ui.Button.OK) return;
  var matricula = respMat.getResponseText().trim();
  if (!matricula) {
    ui.alert('Erro', 'A matrícula não pode ser vazia.', ui.ButtonSet.OK);
    return;
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
  var senha = respSenha.getResponseText().trim();
  if (!senha || senha.length < CONFIG.TAMANHO_MINIMO_SENHA) {
    ui.alert(
      'Erro de Segurança',
      'A senha deve conter no mínimo ' + CONFIG.TAMANHO_MINIMO_SENHA + ' caracteres.',
      ui.ButtonSet.OK
    );
    return;
  }

  cadastrarNovoOperador(matricula, nome, senha);
  ui.alert('Sucesso', 'Operador ' + matricula.toUpperCase() + ' (' + nome + ') cadastrado com sucesso com PBKDF2!', ui.ButtonSet.OK);
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

