/* Testa todas as rotas com um repositório em memória (sem MySQL). Rode: npm test */
'use strict';

const http = require('http');
const assert = require('assert');
const { criarApp } = require('../app');

function repoMemoria() {
  let cId = 0;
  let rId = 0;
  let cenarios = [];
  let resultados = [];
  const limpo = (o) => { if (!o) return null; const c = Object.assign({}, o); delete c._v; return c; };
  return {
    async listarCenarios(v) { return cenarios.filter((c) => c._v === v).map(limpo); },
    async obterCenario(id, v) { return limpo(cenarios.find((c) => c.id === id && c._v === v)); },
    async criarCenario(d, v) { const c = Object.assign({ id: String(++cId), criadoEm: new Date().toISOString(), _v: v }, d); cenarios.push(c); return limpo(c); },
    async atualizarCenario(id, d, v) { const i = cenarios.findIndex((c) => c.id === id && c._v === v); if (i < 0) return null; cenarios[i] = Object.assign({}, cenarios[i], d); return limpo(cenarios[i]); },
    async excluirCenario(id, v) { const n = cenarios.length; cenarios = cenarios.filter((c) => !(c.id === id && c._v === v)); resultados = resultados.filter((r) => r.cenarioId !== id); return cenarios.length < n; },
    async listarResultados(v, cid) { return resultados.filter((r) => r._v === v && (!cid || r.cenarioId === cid)).map(limpo); },
    async obterResultado(id, v) { return limpo(resultados.find((r) => r.id === id && r._v === v)); },
    async criarResultado(d, v) { const r = Object.assign({ id: String(++rId), data: new Date().toISOString(), _v: v }, d); resultados.push(r); return limpo(r); },
    async atualizarResultado(id, d, v) { const i = resultados.findIndex((r) => r.id === id && r._v === v); if (i < 0) return null; resultados[i] = Object.assign({}, resultados[i], d); return limpo(resultados[i]); },
    async excluirResultado(id, v) { const n = resultados.length; resultados = resultados.filter((r) => !(r.id === id && r._v === v)); return resultados.length < n; }
  };
}

const LAB = { linhas: ['S....', '.###.', '....G'] };
const RES = { cenarioNome: 'Pilares', tentativa: 1, tempo: 15.64, colisoes: 0, passos: 36, concluido: true, motivo: 'destino alcançado', ruido: false };
const ANA = '3f2b8c1e-5d4a-4b7e-9c1a-2e6f0a9d7b11';
const BRUNO = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

async function main() {
  let bancoOk = true;
  const servidor = http.createServer(criarApp(repoMemoria(), {
    saude: async () => { if (!bancoOk) throw new Error('fora'); },
    limitePorMinuto: 1000
  }));
  await new Promise((ok) => servidor.listen(0, ok));
  const base = 'http://127.0.0.1:' + servidor.address().port;

  async function chamar(metodo, url, corpo, extra) {
    extra = extra || {};
    const headers = Object.assign({}, extra.semVisitante ? {} : { 'X-Visitante': extra.visitante || ANA });
    if (corpo !== undefined || extra.bruto !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + url, {
      method: metodo,
      headers,
      body: extra.bruto !== undefined ? extra.bruto : corpo !== undefined ? JSON.stringify(corpo) : undefined
    });
    const texto = await r.text();
    let json = null;
    try { json = JSON.parse(texto); } catch (e) { /* sem corpo */ }
    return { status: r.status, json, texto, headers: r.headers };
  }

  let n = 0;
  const ok = (nome) => { n++; console.log('  ok  ' + nome); };

  // --- cenários ---
  let r = await chamar('GET', '/api/cenarios');
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.json, []); ok('GET /api/cenarios (vazio)');

  r = await chamar('POST', '/api/cenarios', { nome: '  Meu labirinto ', configuracao: LAB });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.json.nome, 'Meu labirinto'); assert.strictEqual(r.json.id, '1'); assert.strictEqual(r.json.descricao, '');
  ok('POST /api/cenarios cria e limpa o nome');

  r = await chamar('GET', '/api/cenarios/1');
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.json.configuracao, LAB); ok('GET /api/cenarios/:id');

  r = await chamar('PUT', '/api/cenarios/1', { nome: 'Renomeado' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.nome, 'Renomeado'); assert.deepStrictEqual(r.json.configuracao, LAB);
  ok('PUT /api/cenarios/:id (atualização parcial mantém o resto)');

  for (const [rotulo, corpo] of [
    ['sem nome', { configuracao: LAB }],
    ['nome longo', { nome: 'x'.repeat(41), configuracao: LAB }],
    ['sem configuração', { nome: 'a' }],
    ['sem destino', { nome: 'a', configuracao: { linhas: ['S....', '.###.', '.....'] } }],
    ['dois inícios', { nome: 'a', configuracao: { linhas: ['S...S', '.###.', '....G'] } }],
    ['linhas desiguais', { nome: 'a', configuracao: { linhas: ['S....', '.###', '....G'] } }],
    ['caractere inválido', { nome: 'a', configuracao: { linhas: ['S..x.', '.###.', '....G'] } }]
  ]) {
    r = await chamar('POST', '/api/cenarios', corpo);
    assert.strictEqual(r.status, 400, 'esperava 400 para ' + rotulo);
  }
  ok('POST /api/cenarios rejeita 7 entradas inválidas com 400');

  r = await chamar('POST', '/api/cenarios', undefined, { bruto: '{quebrado' });
  assert.strictEqual(r.status, 400); assert.strictEqual(r.json.erro, 'JSON inválido.'); ok('JSON malformado -> 400');

  r = await chamar('GET', '/api/cenarios/99'); assert.strictEqual(r.status, 404);
  r = await chamar('PUT', '/api/cenarios/99', { nome: 'a' }); assert.strictEqual(r.status, 404);
  r = await chamar('DELETE', '/api/cenarios/99'); assert.strictEqual(r.status, 404);
  r = await chamar('GET', '/api/cenarios/abc'); assert.strictEqual(r.status, 400);
  ok('404 para cenário inexistente e 400 para id inválido');

  // --- resultados ---
  r = await chamar('POST', '/api/resultados', Object.assign({ cenarioId: '1' }, RES));
  assert.strictEqual(r.status, 201); assert.strictEqual(r.json.tempo, 15.6); assert.strictEqual(r.json.cenarioId, '1');
  ok('POST /api/resultados vinculado a cenário (tempo arredondado para 0,1)');

  r = await chamar('POST', '/api/resultados', RES);
  assert.strictEqual(r.status, 201); assert.strictEqual(r.json.cenarioId, null); ok('POST /api/resultados de cenário predefinido (cenarioId nulo)');

  r = await chamar('POST', '/api/resultados', Object.assign({ cenarioId: '77' }, RES));
  assert.strictEqual(r.status, 400); ok('POST /api/resultados com cenário inexistente -> 400');

  for (const [rotulo, mudanca] of [
    ['tempo negativo', { tempo: -1 }], ['tempo texto', { tempo: '5' }], ['colisões decimais', { colisoes: 1.5 }],
    ['tentativa 0', { tentativa: 0 }], ['concluido texto', { concluido: 'sim' }], ['sem nome', { cenarioNome: '' }], ['cenarioId inválido', { cenarioId: 'x' }]
  ]) {
    r = await chamar('POST', '/api/resultados', Object.assign({}, RES, mudanca));
    assert.strictEqual(r.status, 400, 'esperava 400 para ' + rotulo);
  }
  ok('POST /api/resultados rejeita 7 entradas inválidas com 400');

  r = await chamar('GET', '/api/resultados'); assert.strictEqual(r.json.length, 2);
  r = await chamar('GET', '/api/resultados?cenarioId=1'); assert.strictEqual(r.json.length, 1);
  r = await chamar('GET', '/api/resultados?cenarioId=zzz'); assert.strictEqual(r.status, 400);
  ok('GET /api/resultados com e sem filtro por cenário');

  r = await chamar('GET', '/api/resultados/1'); assert.strictEqual(r.status, 200);
  r = await chamar('PUT', '/api/resultados/1', { colisoes: 3, concluido: false });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.colisoes, 3); assert.strictEqual(r.json.concluido, false); assert.strictEqual(r.json.cenarioNome, 'Pilares');
  ok('GET e PUT /api/resultados/:id (atualização parcial)');

  // --- isolamento entre visitantes ---
  r = await chamar('GET', '/api/cenarios', undefined, { visitante: BRUNO }); assert.deepStrictEqual(r.json, []);
  r = await chamar('GET', '/api/resultados', undefined, { visitante: BRUNO }); assert.deepStrictEqual(r.json, []);
  r = await chamar('GET', '/api/cenarios/1', undefined, { visitante: BRUNO }); assert.strictEqual(r.status, 404);
  r = await chamar('GET', '/api/resultados/1', undefined, { visitante: BRUNO }); assert.strictEqual(r.status, 404);
  r = await chamar('PUT', '/api/cenarios/1', { nome: 'invadido' }, { visitante: BRUNO }); assert.strictEqual(r.status, 404);
  r = await chamar('DELETE', '/api/cenarios/1', undefined, { visitante: BRUNO }); assert.strictEqual(r.status, 404);
  r = await chamar('DELETE', '/api/resultados/1', undefined, { visitante: BRUNO }); assert.strictEqual(r.status, 404);
  r = await chamar('POST', '/api/resultados', Object.assign({ cenarioId: '1' }, RES), { visitante: BRUNO }); assert.strictEqual(r.status, 400);
  r = await chamar('GET', '/api/cenarios/1'); assert.strictEqual(r.json.nome, 'Renomeado');
  ok('um visitante não vê, altera, apaga nem vincula dados de outro');

  r = await chamar('GET', '/api/cenarios', undefined, { semVisitante: true }); assert.strictEqual(r.status, 400);
  r = await chamar('GET', '/api/resultados', undefined, { visitante: 'nao-e-uuid' }); assert.strictEqual(r.status, 400);
  r = await chamar('GET', '/api/resultados', undefined, { visitante: '3f2b8c1e-5d4a-1b7e-9c1a-2e6f0a9d7b11' }); assert.strictEqual(r.status, 400);
  ok('sem X-Visitante válido (UUID v4) -> 400');

  r = await chamar('DELETE', '/api/resultados/2'); assert.strictEqual(r.status, 204);
  r = await chamar('GET', '/api/resultados/2'); assert.strictEqual(r.status, 404);
  ok('DELETE /api/resultados/:id');

  r = await chamar('DELETE', '/api/cenarios/1'); assert.strictEqual(r.status, 204);
  r = await chamar('GET', '/api/resultados'); assert.strictEqual(r.json.length, 0);
  ok('DELETE /api/cenarios/:id apaga também os resultados dele');

  // --- limite por visitante ---
  for (let i = 0; i < 30; i++) {
    r = await chamar('POST', '/api/cenarios', { nome: 'c' + i, configuracao: LAB }, { visitante: BRUNO });
    assert.strictEqual(r.status, 201);
  }
  r = await chamar('POST', '/api/cenarios', { nome: 'extra', configuracao: LAB }, { visitante: BRUNO });
  assert.strictEqual(r.status, 409);
  r = await chamar('POST', '/api/cenarios', { nome: 'extra', configuracao: LAB });
  assert.strictEqual(r.status, 201);
  ok('limite de 30 cenários por visitante (409) sem afetar os outros');

  // --- saúde, segurança e geral ---
  r = await chamar('GET', '/api/saude', undefined, { semVisitante: true }); assert.strictEqual(r.status, 200);
  bancoOk = false;
  r = await chamar('GET', '/api/saude', undefined, { semVisitante: true }); assert.strictEqual(r.status, 503);
  bancoOk = true;
  ok('/api/saude responde 200 e 503 quando o banco cai (sem exigir visitante)');

  r = await chamar('GET', '/');
  assert.ok(r.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.ok(!r.headers.get('content-security-policy').includes('upgrade-insecure-requests'));
  assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(r.headers.get('x-powered-by'), null);
  ok('cabeçalhos de segurança (CSP, nosniff) e sem x-powered-by');

  r = await chamar('GET', '/api/inexistente'); assert.strictEqual(r.status, 404);
  r = await chamar('OPTIONS', '/api/cenarios', undefined, { semVisitante: true });
  assert.strictEqual(r.status, 204); assert.strictEqual(r.headers.get('access-control-allow-origin'), '*');
  assert.ok(r.headers.get('access-control-allow-headers').includes('X-Visitante'));
  ok('rota desconhecida -> 404 e preflight CORS -> 204 (libera X-Visitante)');

  r = await chamar('GET', '/'); assert.strictEqual(r.status, 200); assert.ok(r.texto.includes('RoboLab'));
  r = await chamar('GET', '/js/sim.js'); assert.strictEqual(r.status, 200);
  r = await chamar('GET', '/server/.env'); assert.strictEqual(r.status, 404);
  r = await chamar('GET', '/server/db.js'); assert.strictEqual(r.status, 404);
  r = await chamar('GET', '/js/../server/db.js'); assert.notStrictEqual(r.status, 200);
  ok('site estático servido; pasta server/ não é exposta');

  const gz = await fetch(base + '/js/vendor/chart.umd.min.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.strictEqual(gz.headers.get('content-encoding'), 'gzip');
  ok('arquivos grandes saem comprimidos (gzip)');

  servidor.close();

  // --- limite de requisições ---
  const limitado = http.createServer(criarApp(repoMemoria(), { limitePorMinuto: 5 }));
  await new Promise((okk) => limitado.listen(0, okk));
  const b2 = 'http://127.0.0.1:' + limitado.address().port;
  let ultimo = 0;
  for (let i = 0; i < 8; i++) ultimo = (await fetch(b2 + '/api/saude')).status;
  assert.strictEqual(ultimo, 429);
  limitado.close();
  ok('excesso de requisições na API -> 429');

  console.log(`\n${n} grupos de testes passaram.`);
}

main().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
