/* Rotas da API REST. Recebe um "repositório" (db.js em produção, memória nos testes).
 * Cada visitante é identificado por um UUID aleatório (cabeçalho X-Visitante) gerado pelo navegador dele
 * e só enxerga os próprios cenários e resultados. */
'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');

const PUBLICO = path.join(__dirname, '..', 'public');
const MAX_CENARIOS = 30;      // por visitante
const MAX_RESULTADOS = 300;   // por visitante
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/* ---------- validação ---------- */
const ehInteiro = (v) => typeof v === 'number' && Number.isInteger(v);

function textoObrigatorio(v, campo, max) {
  if (typeof v !== 'string' || !v.trim()) throw new ErroHttp(400, `"${campo}" é obrigatório.`);
  if (v.trim().length > max) throw new ErroHttp(400, `"${campo}" deve ter no máximo ${max} caracteres.`);
  return v.trim();
}

function textoOpcional(v, campo, max) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > max) throw new ErroHttp(400, `"${campo}" deve ser um texto de até ${max} caracteres.`);
  return v;
}

function validarConfiguracao(c) {
  const linhas = c && c.linhas;
  if (!Array.isArray(linhas) || linhas.length < 3 || linhas.length > 30) {
    throw new ErroHttp(400, '"configuracao.linhas" deve ter de 3 a 30 linhas.');
  }
  const largura = linhas[0] && linhas[0].length;
  let inicios = 0;
  let destinos = 0;
  linhas.forEach((l) => {
    if (typeof l !== 'string' || l.length !== largura || largura < 3 || largura > 30 || !/^[.#SG]+$/.test(l)) {
      throw new ErroHttp(400, 'Cada linha deve ter o mesmo tamanho (3 a 30) e usar só os caracteres . # S G.');
    }
    inicios += (l.match(/S/g) || []).length;
    destinos += (l.match(/G/g) || []).length;
  });
  if (inicios !== 1 || destinos !== 1) throw new ErroHttp(400, 'O labirinto precisa de exatamente um início (S) e um destino (G).');
  return { linhas };
}

function validarCenario(b) {
  b = b || {};
  return {
    nome: textoObrigatorio(b.nome, 'nome', 40),
    descricao: textoOpcional(b.descricao, 'descricao', 255),
    configuracao: validarConfiguracao(b.configuracao)
  };
}

function validarResultado(b) {
  b = b || {};
  if (typeof b.tempo !== 'number' || !Number.isFinite(b.tempo) || b.tempo < 0 || b.tempo > 100000) {
    throw new ErroHttp(400, '"tempo" deve ser um número entre 0 e 100000.');
  }
  if (!ehInteiro(b.colisoes) || b.colisoes < 0) throw new ErroHttp(400, '"colisoes" deve ser um inteiro maior ou igual a 0.');
  if (!ehInteiro(b.tentativa) || b.tentativa < 1) throw new ErroHttp(400, '"tentativa" deve ser um inteiro maior ou igual a 1.');
  const passos = b.passos === undefined ? 0 : b.passos;
  if (!ehInteiro(passos) || passos < 0) throw new ErroHttp(400, '"passos" deve ser um inteiro maior ou igual a 0.');
  if (typeof b.concluido !== 'boolean') throw new ErroHttp(400, '"concluido" deve ser verdadeiro ou falso.');
  if (b.ruido !== undefined && typeof b.ruido !== 'boolean') throw new ErroHttp(400, '"ruido" deve ser verdadeiro ou falso.');

  let cenarioId = null;
  if (b.cenarioId !== undefined && b.cenarioId !== null) {
    if (!/^\d{1,10}$/.test(String(b.cenarioId))) throw new ErroHttp(400, '"cenarioId" inválido.');
    cenarioId = String(b.cenarioId);
  }
  return {
    cenarioId,
    cenarioNome: textoObrigatorio(b.cenarioNome, 'cenarioNome', 40),
    tentativa: b.tentativa,
    tempo: Math.round(b.tempo * 10) / 10,
    colisoes: b.colisoes,
    passos,
    concluido: b.concluido,
    motivo: textoOpcional(b.motivo, 'motivo', 120),
    ruido: Boolean(b.ruido)
  };
}

function idDaRota(req) {
  if (!/^\d{1,10}$/.test(req.params.id)) throw new ErroHttp(400, 'ID inválido.');
  return req.params.id;
}

const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function exigirVisitante(req, res, next) {
  const v = req.get('X-Visitante');
  if (!v || !UUID_V4.test(v)) return next(new ErroHttp(400, 'Cabeçalho X-Visitante ausente ou inválido.'));
  req.visitante = v.toLowerCase();
  next();
}

/* ---------- app ---------- */
function criarApp(repo, opcoes) {
  opcoes = opcoes || {};
  const app = express();
  app.disable('x-powered-by');
  // atrás do proxy do Render, o IP real do visitante vem no cabeçalho X-Forwarded-For
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

  // CSP padrão do helmet, sem o upgrade-insecure-requests (para funcionar também em http://localhost)
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } }
  }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));

  // Limite generoso: muitos visitantes podem compartilhar o mesmo Wi-Fi (mesmo IP) na feira.
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: opcoes.limitePorMinuto || Number(process.env.RATE_LIMIT || 600),
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente de novo em instantes.' }
  }));

  // CORS simples: permite abrir o index.html direto do disco apontando para esta API
  const origem = opcoes.corsOrigin || '*';
  app.use('/api', (req, res, next) => {
    res.set('Access-Control-Allow-Origin', origem);
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Visitante');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/saude', rota(async (req, res) => {
    if (opcoes.saude) {
      try { await opcoes.saude(); } catch (e) { throw new ErroHttp(503, 'Banco de dados indisponível.'); }
    }
    res.json({ ok: true });
  }));

  app.use(['/api/cenarios', '/api/resultados', '/api/visita'], exigirVisitante);

  /* Acessos: o site avisa uma vez por sessão. Só grava; a contagem não é exposta pela API
     (quem lê os números é o painel PHP, direto no banco). */
  app.post('/api/visita', rota(async (req, res) => {
    await repo.registrarVisita(req.visitante);
    res.sendStatus(204);
  }));

  /* Cenários */
  app.get('/api/cenarios', rota(async (req, res) => res.json(await repo.listarCenarios(req.visitante))));

  app.get('/api/cenarios/:id', rota(async (req, res) => {
    const c = await repo.obterCenario(idDaRota(req), req.visitante);
    if (!c) throw new ErroHttp(404, 'Cenário não encontrado.');
    res.json(c);
  }));

  app.post('/api/cenarios', rota(async (req, res) => {
    const dados = validarCenario(req.body);
    if ((await repo.listarCenarios(req.visitante)).length >= MAX_CENARIOS) {
      throw new ErroHttp(409, `Limite de ${MAX_CENARIOS} cenários salvos atingido. Exclua algum para salvar outro.`);
    }
    res.status(201).json(await repo.criarCenario(dados, req.visitante));
  }));

  app.put('/api/cenarios/:id', rota(async (req, res) => {
    const id = idDaRota(req);
    const atual = await repo.obterCenario(id, req.visitante);
    if (!atual) throw new ErroHttp(404, 'Cenário não encontrado.');
    const dados = validarCenario(Object.assign({}, atual, req.body));
    res.json(await repo.atualizarCenario(id, dados, req.visitante));
  }));

  app.delete('/api/cenarios/:id', rota(async (req, res) => {
    if (!(await repo.excluirCenario(idDaRota(req), req.visitante))) throw new ErroHttp(404, 'Cenário não encontrado.');
    res.sendStatus(204);
  }));

  /* Resultados */
  app.get('/api/resultados', rota(async (req, res) => {
    let filtro;
    if (req.query.cenarioId !== undefined) {
      if (!/^\d{1,10}$/.test(String(req.query.cenarioId))) throw new ErroHttp(400, '"cenarioId" inválido.');
      filtro = String(req.query.cenarioId);
    }
    res.json(await repo.listarResultados(req.visitante, filtro));
  }));

  app.get('/api/resultados/:id', rota(async (req, res) => {
    const r = await repo.obterResultado(idDaRota(req), req.visitante);
    if (!r) throw new ErroHttp(404, 'Resultado não encontrado.');
    res.json(r);
  }));

  async function exigirCenario(cenarioId, visitante) {
    if (cenarioId !== null && !(await repo.obterCenario(cenarioId, visitante))) {
      throw new ErroHttp(400, 'O cenário informado em "cenarioId" não existe.');
    }
  }

  app.post('/api/resultados', rota(async (req, res) => {
    const dados = validarResultado(req.body);
    await exigirCenario(dados.cenarioId, req.visitante);
    if ((await repo.listarResultados(req.visitante)).length >= MAX_RESULTADOS) {
      throw new ErroHttp(409, `Limite de ${MAX_RESULTADOS} resultados atingido. Exclua alguns para registrar outros.`);
    }
    res.status(201).json(await repo.criarResultado(dados, req.visitante));
  }));

  app.put('/api/resultados/:id', rota(async (req, res) => {
    const id = idDaRota(req);
    const atual = await repo.obterResultado(id, req.visitante);
    if (!atual) throw new ErroHttp(404, 'Resultado não encontrado.');
    const dados = validarResultado(Object.assign({}, atual, req.body));
    await exigirCenario(dados.cenarioId, req.visitante);
    res.json(await repo.atualizarResultado(id, dados, req.visitante));
  }));

  app.delete('/api/resultados/:id', rota(async (req, res) => {
    if (!(await repo.excluirResultado(idDaRota(req), req.visitante))) throw new ErroHttp(404, 'Resultado não encontrado.');
    res.sendStatus(204);
  }));

  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  /* Site estático: apenas a pasta public/ (a pasta server/ nunca é servida) */
  app.use(express.static(PUBLICO, { maxAge: '10m' }));

  /* Erros */
  app.use((err, req, res, next) => {
    if (err instanceof ErroHttp) return res.status(err.status).json({ erro: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Corpo da requisição grande demais.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = { criarApp };
