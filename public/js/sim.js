/* RoboLab — motor da simulação do robô virtual.
 * Não depende do DOM: roda no navegador (window.RoboSim) e no Node (testes).
 *
 * Lógica (espelha a descrição do robô físico):
 *   1. Avança e mede a distância à frente com o sensor ultrassônico.
 *   2. Se houver obstáculo próximo, para.
 *   3. O servo gira o sensor para a esquerda e depois para a direita.
 *   4. Vira para o lado com mais espaço livre (empate: lado mais próximo do destino).
 *   5. Sem saída pelos lados: gira 180°.
 *   6. Volta a avançar.
 *
 * AJUSTE AQUI se a estratégia do carrinho real for diferente (função "varrer").
 */
(function (root) {
  'use strict';

  const DIRS = [
    { dx: 0, dy: -1, nome: 'norte' },
    { dx: 1, dy: 0, nome: 'leste' },
    { dx: 0, dy: 1, nome: 'sul' },
    { dx: -1, dy: 0, nome: 'oeste' }
  ];

  const CELL_CM = 20;        // lado de uma célula, em cm
  const MAX_CELULAS = 5;     // alcance do sensor, em células
  const LIMIAR_CM = 20;      // abaixo disso, é obstáculo
  const MAX_PASSOS = 600;    // proteção contra simulação infinita
  const MAX_REPETICOES = 3;  // mesma situação repetida => preso em ciclo
  const PROB_RUIDO = 0.12;   // chance de leitura falsa quando o ruído está ligado

  // Tempo simulado (segundos) de cada ação
  const TEMPO = { avanco: 0.5, varredura: 0.4, giro90: 0.4, giro180: 0.8, colisao: 0.3 };

  const PRESETS = [
    {
      id: 'preset-pilares',
      nome: 'Pilares',
      descricao: 'Campo aberto com pilares isolados.',
      configuracao: {
        linhas: [
          '...............',
          '...#.......#...',
          '...............',
          '.....#.....#...',
          '...............',
          'S......#......G',
          '...............',
          '...#.......#...',
          '...............',
          '.....#.....#...',
          '...............'
        ]
      }
    },
    {
      id: 'preset-serpentina',
      nome: 'Serpentina',
      descricao: 'Corredor estreito com curvas de 90°.',
      configuracao: {
        linhas: [
          'S..............',
          '##############.',
          '...............',
          '.##############',
          '...............',
          '##############.',
          '...............',
          '.##############',
          '...............',
          '##############.',
          '..............G'
        ]
      }
    },
    {
      id: 'preset-beco',
      nome: 'Armadilha em U',
      descricao: 'Beco em forma de U: o robô entra, não acha saída pelos lados e precisa girar 180°.',
      configuracao: {
        linhas: [
          '...............',
          '...............',
          '...............',
          '....#########..',
          '............#..',
          'S...........#.G',
          '............#..',
          '....#########..',
          '...............',
          '...............',
          '...............'
        ]
      }
    },
    {
      id: 'preset-isolado',
      nome: 'Destino isolado',
      descricao: 'O destino está cercado por paredes: o robô deve acabar bloqueado.',
      configuracao: {
        linhas: [
          '...............',
          '...............',
          '...............',
          '...........###.',
          'S..........#G#.',
          '...........###.',
          '...............',
          '...............',
          '...............',
          '...............',
          '...............'
        ]
      }
    },
    {
      id: 'preset-vazio',
      nome: 'Grade vazia',
      descricao: 'Comece do zero e monte seu próprio percurso.',
      configuracao: {
        linhas: [
          '...............',
          '...............',
          '...............',
          '...............',
          '...............',
          '.S...........G.',
          '...............',
          '...............',
          '...............',
          '...............',
          '...............'
        ]
      }
    }
  ];

  function lerConfig(config) {
    const linhas = config.linhas;
    const rows = linhas.length;
    const cols = linhas[0].length;
    const parede = [];
    let inicio = null;
    let destino = null;
    for (let y = 0; y < rows; y++) {
      parede.push([]);
      for (let x = 0; x < cols; x++) {
        const ch = linhas[y][x];
        parede[y].push(ch === '#');
        if (ch === 'S') inicio = { x, y };
        if (ch === 'G') destino = { x, y };
      }
    }
    if (!inicio || !destino) throw new Error('O labirinto precisa de um ponto inicial e de um destino.');
    return { cols, rows, parede, inicio, destino };
  }

  function criarSimulacao(config, opcoes) {
    opcoes = opcoes || {};
    const g = lerConfig(config);
    const rng = opcoes.rng || Math.random;
    const probRuido = opcoes.ruido ? PROB_RUIDO : 0;

    const ddx = g.destino.x - g.inicio.x;
    const ddy = g.destino.y - g.inicio.y;
    const dirInicial = Math.abs(ddx) >= Math.abs(ddy) ? (ddx >= 0 ? 1 : 3) : (ddy >= 0 ? 2 : 0);

    const s = {
      cols: g.cols,
      rows: g.rows,
      parede: g.parede,
      inicio: g.inicio,
      destino: g.destino,
      x: g.inicio.x,
      y: g.inicio.y,
      dir: dirInicial,
      modo: 'avancar',       // 'avancar' | 'varrer'
      fase: 0,               // fase da varredura: 0 esquerda, 1 direita, 2 decisão
      tempo: 0,
      passos: 0,
      colisoes: 0,
      status: 'pronto',      // 'pronto' | 'executando' | 'sucesso' | 'bloqueado'
      motivo: '',
      trilha: [{ x: g.inicio.x, y: g.inicio.y }],
      visitas: {},
      lidos: { esq: 0, dir: 0 },
      sensor: { frente: null, esquerda: null, direita: null },  // em cm
      mira: { dir: dirInicial, celulas: null },
      condicao: 'Aguardando início',
      decisao: '—',
      registro: []
    };

    function livre(x, y) {
      return x >= 0 && y >= 0 && x < s.cols && y < s.rows && !s.parede[y][x];
    }

    function celulasLivres(d) {
      let n = 0;
      let x = s.x;
      let y = s.y;
      while (n < MAX_CELULAS) {
        x += DIRS[d].dx;
        y += DIRS[d].dy;
        if (!livre(x, y)) break;
        n++;
      }
      return n;
    }

    function medir(d) {
      const real = celulasLivres(d);
      let lido = real;
      let falso = false;
      if (probRuido > 0 && real < MAX_CELULAS && rng() < probRuido) {
        lido = MAX_CELULAS;   // leitura falsa: o sensor "não viu" o obstáculo
        falso = true;
      }
      s.mira = { dir: d, celulas: lido };
      return { celulas: lido, cm: lido * CELL_CM + CELL_CM / 2, falso };
    }

    function reg(texto) {
      s.registro.push({ t: s.tempo, texto });
      if (s.registro.length > 80) s.registro.shift();
    }

    function finalizar(status, motivo) {
      s.status = status;
      s.motivo = motivo;
      s.mira = { dir: s.dir, celulas: null };
      s.condicao = status === 'sucesso' ? 'Destino alcançado' : 'Robô bloqueado';
      s.decisao = motivo;
      reg(status === 'sucesso' ? 'Destino alcançado!' : 'Bloqueado: ' + motivo);
    }

    function avancar() {
      const m = medir(s.dir);
      s.sensor.frente = m.cm;
      s.sensor.esquerda = null;
      s.sensor.direita = null;

      if (m.celulas === 0) {
        s.condicao = 'Obstáculo a ' + m.cm + ' cm (limite: ' + LIMIAR_CM + ' cm)';
        s.decisao = 'Parar e varrer com o servo';
        s.modo = 'varrer';
        s.fase = 0;
        reg('Obstáculo à frente (' + m.cm + ' cm). Parou.');
        const chave = s.x + ',' + s.y + ',' + s.dir;
        s.visitas[chave] = (s.visitas[chave] || 0) + 1;
        if (s.visitas[chave] > MAX_REPETICOES) {
          finalizar('bloqueado', 'ficou repetindo a mesma situação (preso em um ciclo)');
        }
        return;
      }

      const nx = s.x + DIRS[s.dir].dx;
      const ny = s.y + DIRS[s.dir].dy;
      if (!livre(nx, ny)) {
        // leitura falsa: o robô acreditou que o caminho estava livre
        s.colisoes++;
        s.tempo += TEMPO.colisao;
        s.condicao = 'Leitura falsa do sensor';
        s.decisao = 'Colisão! Recuar e medir de novo';
        reg('Colisão: o sensor falhou e o robô bateu.');
        return;
      }

      s.x = nx;
      s.y = ny;
      s.trilha.push({ x: nx, y: ny });
      s.tempo += TEMPO.avanco;
      s.condicao = 'Caminho livre (' + m.cm + ' cm à frente)';
      s.decisao = 'Avançar';
      if (nx === s.destino.x && ny === s.destino.y) finalizar('sucesso', 'destino alcançado');
    }

    function varrer() {
      if (s.fase === 0) {
        const m = medir((s.dir + 3) % 4);   // esquerda
        s.lidos.esq = m.celulas;
        s.sensor.esquerda = m.cm;
        s.tempo += TEMPO.varredura;
        s.condicao = 'Servo à esquerda: ' + m.cm + ' cm';
        s.decisao = 'Medir também à direita';
        reg('Esquerda: ' + m.cm + ' cm.');
        s.fase = 1;
        return;
      }
      if (s.fase === 1) {
        const m = medir((s.dir + 1) % 4);   // direita
        s.lidos.dir = m.celulas;
        s.sensor.direita = m.cm;
        s.tempo += TEMPO.varredura;
        s.condicao = 'Servo à direita: ' + m.cm + ' cm';
        s.decisao = 'Comparar os lados e escolher';
        reg('Direita: ' + m.cm + ' cm.');
        s.fase = 2;
        return;
      }

      const e = s.lidos.esq;
      const d = s.lidos.dir;
      let novaDir;
      let texto;
      let giro = TEMPO.giro90;

      if (e === 0 && d === 0) {
        novaDir = (s.dir + 2) % 4;
        texto = 'Sem saída pelos lados: girar 180°';
        giro = TEMPO.giro180;
      } else if (e > d) {
        novaDir = (s.dir + 3) % 4;
        texto = 'Mais espaço à esquerda: virar à esquerda';
      } else if (d > e) {
        novaDir = (s.dir + 1) % 4;
        texto = 'Mais espaço à direita: virar à direita';
      } else {
        const esqDir = (s.dir + 3) % 4;
        const dirDir = (s.dir + 1) % 4;
        const gx = s.destino.x - s.x;
        const gy = s.destino.y - s.y;
        const pontuacao = (k) => DIRS[k].dx * gx + DIRS[k].dy * gy;
        if (pontuacao(esqDir) > pontuacao(dirDir)) {
          novaDir = esqDir;
          texto = 'Lados iguais: esquerda fica mais perto do destino';
        } else {
          novaDir = dirDir;
          texto = 'Lados iguais: virar à direita';
        }
      }

      s.dir = novaDir;
      s.tempo += giro;
      s.modo = 'avancar';
      s.fase = 0;
      s.mira = { dir: s.dir, celulas: null };
      s.condicao = 'Esquerda ' + s.sensor.esquerda + ' cm, direita ' + s.sensor.direita + ' cm';
      s.decisao = texto;
      reg(texto + '.');
    }

    function passo() {
      if (s.status === 'sucesso' || s.status === 'bloqueado') return;
      s.status = 'executando';
      s.passos++;
      if (s.passos > MAX_PASSOS) {
        finalizar('bloqueado', 'limite de ações atingido');
        return;
      }
      if (s.modo === 'avancar') avancar();
      else varrer();
    }

    return { estado: s, passo };
  }

  const api = { criarSimulacao, lerConfig, PRESETS, DIRS, CELL_CM, MAX_CELULAS, LIMIAR_CM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RoboSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
