/* Verifica o SQL do db.js sem precisar de um MySQL: cada consulta tem que ser sintaticamente válida
 * (parser MySQL) e ter tantos "?" quanto parâmetros. Não substitui um teste em banco real. */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Parser } = require('node-sql-parser');
const { criarRepositorio } = require('../db');

const parser = new Parser();
const V = '3f2b8c1e-5d4a-4b7e-9c1a-2e6f0a9d7b11';
const vistas = [];

function checar(sql, params) {
  const marcas = (sql.match(/\?/g) || []).length;
  assert.strictEqual(marcas, params.length, 'parâmetros diferentes dos "?" em: ' + sql);
  parser.astify(sql.replace(/\?/g, '1'), { database: 'MySQL' });
  vistas.push(sql.replace(/\s+/g, ' ').trim());
}

const linha = {
  id: 1, visitante_id: V, nome: 'x', descricao: '', configuracao: '{"linhas":["S.G"]}', criado_em: new Date(),
  cenario_id: null, cenario_nome: 'x', tentativa: 1, tempo: '1.0', colisoes: 0, passos: 1, concluido: 1, motivo: '', ruido: 0, executado_em: new Date()
};

const pool = {
  async query(sql, params) {
    checar(sql, params || []);
    if (/^\s*SELECT/i.test(sql)) return [[linha]];
    if (/^\s*INSERT/i.test(sql)) return [{ insertId: 1 }];
    return [{ affectedRows: 1 }];
  }
};

(async () => {
  const repo = criarRepositorio(pool);
  const d = { nome: 'x', descricao: '', configuracao: { linhas: ['S.G'] } };
  const r = { cenarioId: null, cenarioNome: 'x', tentativa: 1, tempo: 1, colisoes: 0, passos: 1, concluido: true, motivo: '', ruido: false };
  await repo.listarCenarios(V); await repo.obterCenario('1', V); await repo.criarCenario(d, V);
  await repo.atualizarCenario('1', d, V); await repo.excluirCenario('1', V);
  await repo.listarResultados(V); await repo.listarResultados(V, '1'); await repo.obterResultado('1', V);
  await repo.criarResultado(r, V); await repo.atualizarResultado('1', r, V); await repo.excluirResultado('1', V);

  // toda consulta que lê ou altera dados precisa filtrar por visitante
  vistas.forEach((s) => assert.ok(/visitante_id/.test(s), 'consulta sem filtro de visitante: ' + s));

  // o schema.sql também precisa ser válido
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
  assert.strictEqual(sql.length, 2);
  sql.forEach((c) => parser.astify(c, { database: 'MySQL' }));

  console.log('  ok  ' + vistas.length + ' consultas SQL e o schema.sql são válidos para o parser MySQL e filtram por visitante');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
