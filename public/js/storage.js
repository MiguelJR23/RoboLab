/* RoboLab — armazenamento de Cenários e Resultados.
 *
 * Usa a API REST (Express + MySQL). Se o servidor não responder — por exemplo,
 * quando o index.html é aberto direto do disco ou o backend está desligado —
 * cai automaticamente para o localStorage do navegador, para o site continuar
 * funcionando. Todas as funções são assíncronas e iguais nos dois modos.
 *
 * Os ids são sempre texto. Nunca misturamos dados dos dois modos: se a API
 * estiver no ar, tudo vai para o banco; se não, tudo fica no navegador.
 */
(function (root) {
  'use strict';

  const BASE = location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
  const TEMPO_LIMITE_MS = 2500;

  /* ================= modo local (localStorage) ================= */
  const CH_CENARIOS = 'robolab.cenarios';
  const CH_RESULTADOS = 'robolab.resultados';

  function ler(chave) {
    try {
      const v = JSON.parse(localStorage.getItem(chave));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
      /* armazenamento cheio ou bloqueado: o site continua funcionando sem salvar */
    }
  }

  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const Local = {
    async listarCenarios() { return ler(CH_CENARIOS); },
    async obterCenario(id) { return ler(CH_CENARIOS).find((c) => c.id === id) || null; },
    async criarCenario(dados) {
      const lista = ler(CH_CENARIOS);
      const cenario = {
        id: novoId(),
        nome: dados.nome,
        descricao: dados.descricao || '',
        configuracao: dados.configuracao,
        criadoEm: new Date().toISOString()
      };
      lista.push(cenario);
      gravar(CH_CENARIOS, lista);
      return cenario;
    },
    async atualizarCenario(id, dados) {
      const lista = ler(CH_CENARIOS);
      const i = lista.findIndex((c) => c.id === id);
      if (i < 0) return null;
      lista[i] = Object.assign({}, lista[i], dados, { id });
      gravar(CH_CENARIOS, lista);
      return lista[i];
    },
    async excluirCenario(id) {
      gravar(CH_CENARIOS, ler(CH_CENARIOS).filter((c) => c.id !== id));
      gravar(CH_RESULTADOS, ler(CH_RESULTADOS).filter((r) => r.cenarioId !== id));
    },
    async listarResultados(cenarioId) {
      const lista = ler(CH_RESULTADOS);
      return cenarioId === undefined ? lista : lista.filter((r) => r.cenarioId === cenarioId);
    },
    async obterResultado(id) { return ler(CH_RESULTADOS).find((r) => r.id === id) || null; },
    async registrarResultado(dados) {
      const lista = ler(CH_RESULTADOS);
      const resultado = Object.assign({ id: novoId(), data: new Date().toISOString() }, dados);
      lista.push(resultado);
      gravar(CH_RESULTADOS, lista);
      return resultado;
    },
    async atualizarResultado(id, dados) {
      const lista = ler(CH_RESULTADOS);
      const i = lista.findIndex((r) => r.id === id);
      if (i < 0) return null;
      lista[i] = Object.assign({}, lista[i], dados, { id });
      gravar(CH_RESULTADOS, lista);
      return lista[i];
    },
    async excluirResultado(id) {
      gravar(CH_RESULTADOS, ler(CH_RESULTADOS).filter((r) => r.id !== id));
    }
  };

  /* ================= modo API ================= */
  class ErroApi extends Error {
    constructor(status, mensagem) {
      super(mensagem);
      this.status = status;
    }
  }

  // Falha de rede ou resposta que não veio do nosso servidor => servidor indisponível.
  class Indisponivel extends Error {}

  // Identificador anônimo deste navegador (UUID v4). É ele que separa os dados de cada visitante.
  function uuidV4() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  let visitanteMemoria = null;
  function visitanteId() {
    try {
      let v = localStorage.getItem('robolab.visitante');
      if (!v || !/^[0-9a-f-]{36}$/i.test(v)) {
        v = uuidV4();
        localStorage.setItem('robolab.visitante', v);
      }
      return v;
    } catch (e) {
      // armazenamento bloqueado (ex.: aba anônima): vale só enquanto a página estiver aberta
      if (!visitanteMemoria) visitanteMemoria = uuidV4();
      return visitanteMemoria;
    }
  }

  async function chamar(metodo, caminho, corpo) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
    let resp;
    try {
      resp = await fetch(BASE + caminho, {
        method: metodo,
        headers: Object.assign(
          { 'X-Visitante': visitanteId() },
          corpo !== undefined ? { 'Content-Type': 'application/json' } : {}
        ),
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        signal: ctrl.signal
      });
    } catch (e) {
      throw new Indisponivel();
    } finally {
      clearTimeout(t);
    }
    if (resp.status === 204) return null;
    let json = null;
    try { json = await resp.json(); } catch (e) { throw new Indisponivel(); }
    if (!resp.ok) {
      if (resp.status >= 500) throw new Indisponivel();
      throw new ErroApi(resp.status, (json && json.erro) || 'Erro na API.');
    }
    return json;
  }

  const Api = {
    listarCenarios: () => chamar('GET', '/cenarios'),
    obterCenario: (id) => chamar('GET', '/cenarios/' + encodeURIComponent(id)).catch(naoEncontrado),
    criarCenario: (d) => chamar('POST', '/cenarios', d),
    atualizarCenario: (id, d) => chamar('PUT', '/cenarios/' + encodeURIComponent(id), d).catch(naoEncontrado),
    excluirCenario: (id) => chamar('DELETE', '/cenarios/' + encodeURIComponent(id)).catch(naoEncontrado).then(() => undefined),
    listarResultados: (cenarioId) => chamar('GET', '/resultados' + (cenarioId === undefined ? '' : '?cenarioId=' + encodeURIComponent(cenarioId))),
    obterResultado: (id) => chamar('GET', '/resultados/' + encodeURIComponent(id)).catch(naoEncontrado),
    registrarResultado: (d) => chamar('POST', '/resultados', d),
    atualizarResultado: (id, d) => chamar('PUT', '/resultados/' + encodeURIComponent(id), d).catch(naoEncontrado),
    excluirResultado: (id) => chamar('DELETE', '/resultados/' + encodeURIComponent(id)).catch(naoEncontrado).then(() => undefined)
  };

  function naoEncontrado(e) {
    if (e instanceof ErroApi && e.status === 404) return null;
    throw e;
  }

  /* ================= escolha do modo ================= */
  let modo = null;                // 'api' | 'local'
  let verificando = null;

  function detectar() {
    if (!verificando) {
      verificando = chamar('GET', '/saude')
        .then(() => { modo = 'api'; })
        .catch(() => { modo = 'local'; })
        .then(() => {
          document.dispatchEvent(new CustomEvent('robolab:modo', { detail: modo }));
        });
    }
    return verificando;
  }

  const Armazenamento = { modo: () => modo, pronto: detectar, ErroApi };

  Object.keys(Local).forEach((nome) => {
    Armazenamento[nome] = async function () {
      await detectar();
      const args = arguments;
      if (modo === 'api') {
        try {
          return await Api[nome].apply(null, args);
        } catch (e) {
          if (!(e instanceof Indisponivel)) throw e;
          // o servidor caiu no meio do uso: continua no navegador
          modo = 'local';
          document.dispatchEvent(new CustomEvent('robolab:modo', { detail: modo }));
        }
      }
      return Local[nome].apply(null, args);
    };
  });

  root.Armazenamento = Armazenamento;
})(window);
