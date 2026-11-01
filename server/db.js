/* Repositório MySQL: único arquivo que contém SQL.
 * Todas as consultas são filtradas por visitante_id: cada visitante só vê e altera os próprios dados. */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function configSsl() {
  // Aiven e outros bancos em nuvem exigem conexão segura.
  // DB_CA_FILE: caminho do certificado (ca.pem) do provedor, relativo à pasta server/ ou absoluto.
  // DB_CA: o próprio texto do certificado. DB_SSL=true: usa os certificados do sistema.
  const valorArquivo = process.env.DB_CA_FILE;
  if (valorArquivo) {
    if (/-----BEGIN/.test(valorArquivo)) {
      return { ca: valorArquivo.replace(/\\n/g, '\n'), rejectUnauthorized: true };
    }
    try {
      return { ca: fs.readFileSync(path.resolve(__dirname, valorArquivo), 'utf8'), rejectUnauthorized: true };
    } catch (e) {
      // Não derruba o servidor: o site sobe e o aviso aparece no log.
      console.error('Não foi possível ler o certificado em DB_CA_FILE ("' + valorArquivo.slice(0, 40) + '"): ' + e.message);
      console.error('Use apenas o nome do arquivo (ca.pem) e confira se server/ca.pem está no GitHub.');
    }
  }
  const ca = process.env.DB_CA;
  if (ca) return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  if (['true', '1'].includes(String(process.env.DB_SSL).toLowerCase())) return { rejectUnauthorized: true };
  return undefined;
}

function criarPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'robolab',
    ssl: configSsl(),
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 10000,
    enableKeepAlive: true,
    idleTimeout: 30000,
    timezone: 'Z'
  });
}

/* Cria as tabelas se ainda não existirem (lê o schema.sql). */
async function prepararBanco(pool) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const comandos = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const c of comandos) await pool.query(c);
}

function lerJson(v) {
  return typeof v === 'string' ? JSON.parse(v) : v;
}

function paraCenario(l) {
  return {
    id: String(l.id),
    nome: l.nome,
    descricao: l.descricao,
    configuracao: lerJson(l.configuracao),
    criadoEm: new Date(l.criado_em).toISOString()
  };
}

function paraResultado(l) {
  return {
    id: String(l.id),
    cenarioId: l.cenario_id === null ? null : String(l.cenario_id),
    cenarioNome: l.cenario_nome,
    tentativa: l.tentativa,
    tempo: Number(l.tempo),
    colisoes: l.colisoes,
    passos: l.passos,
    concluido: Boolean(l.concluido),
    motivo: l.motivo,
    ruido: Boolean(l.ruido),
    data: new Date(l.executado_em).toISOString()
  };
}

function criarRepositorio(pool) {
  return {
    async listarCenarios(v) {
      const [linhas] = await pool.query('SELECT * FROM cenarios WHERE visitante_id = ? ORDER BY id', [v]);
      return linhas.map(paraCenario);
    },

    async obterCenario(id, v) {
      const [linhas] = await pool.query('SELECT * FROM cenarios WHERE id = ? AND visitante_id = ?', [id, v]);
      return linhas.length ? paraCenario(linhas[0]) : null;
    },

    async criarCenario(d, v) {
      const [r] = await pool.query(
        'INSERT INTO cenarios (visitante_id, nome, descricao, configuracao, criado_em) VALUES (?, ?, ?, ?, ?)',
        [v, d.nome, d.descricao, JSON.stringify(d.configuracao), new Date()]
      );
      return this.obterCenario(r.insertId, v);
    },

    async atualizarCenario(id, d, v) {
      const [r] = await pool.query(
        'UPDATE cenarios SET nome = ?, descricao = ?, configuracao = ? WHERE id = ? AND visitante_id = ?',
        [d.nome, d.descricao, JSON.stringify(d.configuracao), id, v]
      );
      return r.affectedRows ? this.obterCenario(id, v) : null;
    },

    async excluirCenario(id, v) {
      // os resultados do cenário são apagados pela chave estrangeira (ON DELETE CASCADE)
      const [r] = await pool.query('DELETE FROM cenarios WHERE id = ? AND visitante_id = ?', [id, v]);
      return r.affectedRows > 0;
    },

    async listarResultados(v, cenarioId) {
      const [linhas] = cenarioId
        ? await pool.query('SELECT * FROM resultados WHERE visitante_id = ? AND cenario_id = ? ORDER BY id', [v, cenarioId])
        : await pool.query('SELECT * FROM resultados WHERE visitante_id = ? ORDER BY id', [v]);
      return linhas.map(paraResultado);
    },

    async obterResultado(id, v) {
      const [linhas] = await pool.query('SELECT * FROM resultados WHERE id = ? AND visitante_id = ?', [id, v]);
      return linhas.length ? paraResultado(linhas[0]) : null;
    },

    async criarResultado(d, v) {
      const [r] = await pool.query(
        `INSERT INTO resultados
           (visitante_id, cenario_id, cenario_nome, tentativa, tempo, colisoes, passos, concluido, motivo, ruido, executado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v, d.cenarioId, d.cenarioNome, d.tentativa, d.tempo, d.colisoes, d.passos,
          d.concluido ? 1 : 0, d.motivo, d.ruido ? 1 : 0, new Date()]
      );
      return this.obterResultado(r.insertId, v);
    },

    async atualizarResultado(id, d, v) {
      const [r] = await pool.query(
        `UPDATE resultados
            SET cenario_id = ?, cenario_nome = ?, tentativa = ?, tempo = ?, colisoes = ?,
                passos = ?, concluido = ?, motivo = ?, ruido = ?
          WHERE id = ? AND visitante_id = ?`,
        [d.cenarioId, d.cenarioNome, d.tentativa, d.tempo, d.colisoes, d.passos,
          d.concluido ? 1 : 0, d.motivo, d.ruido ? 1 : 0, id, v]
      );
      return r.affectedRows ? this.obterResultado(id, v) : null;
    },

        async excluirResultado(id, v) {
      const [r] = await pool.query('DELETE FROM resultados WHERE id = ? AND visitante_id = ?', [id, v]);
      return r.affectedRows > 0;
    },

    // Conta um acesso: cria o registro do aparelho ou atualiza o último acesso e soma 1.
    async registrarVisita(v) {
      const agora = new Date();
      await pool.query(
        `INSERT INTO visitas (visitante_id, primeiro_acesso, ultimo_acesso, acessos)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE ultimo_acesso = ?, acessos = acessos + 1`,
        [v, agora, agora, agora]
      );
    }
  };
}

module.exports = { criarPool, criarRepositorio, prepararBanco };
