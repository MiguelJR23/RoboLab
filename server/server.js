'use strict';

require('dotenv').config();
const { criarApp } = require('./app');
const { criarPool, criarRepositorio, prepararBanco } = require('./db');

const porta = Number(process.env.PORT || 3000);
const pool = criarPool();
let bancoPronto = false;

// O site sobe mesmo sem o banco: sem ele, o front-end salva os dados no navegador de cada visitante.
const app = criarApp(criarRepositorio(pool), {
  saude: async () => {
    if (!bancoPronto) throw new Error('banco ainda não está pronto');
    await pool.query('SELECT 1');
  }
});

app.listen(porta, '0.0.0.0', () => {
  console.log(`RoboLab no ar na porta ${porta}`);
});

async function conectar() {
  try {
    await pool.query('SELECT 1');
    await prepararBanco(pool);
    bancoPronto = true;
    console.log('Banco de dados conectado e tabelas prontas.');
  } catch (err) {
    bancoPronto = false;
    console.error('Banco de dados indisponível (' + err.message + '). Nova tentativa em 15 s.');
    setTimeout(conectar, 15000);
  }
}
conectar();
