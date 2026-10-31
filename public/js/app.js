/* RoboLab — interface do Desafio do Labirinto. */
(function () {
  'use strict';

  const { criarSimulacao, PRESETS } = window.RoboSim;
  const Banco = window.Armazenamento;

  const TAM = 48; // tamanho de uma célula no canvas, em pixels
  const ATRASOS = [900, 600, 420, 300, 220, 160, 110, 70, 40, 20]; // ms por ação, velocidade 1..10

  const el = (id) => document.getElementById(id);
  const canvas = el('labirinto');
  const ctx = canvas.getContext('2d');

  let grade = [];
  let cenario = { id: null, nome: 'Personalizado' };
  let salvos = [];
  let sim = null;
  let timer = null;
  let ferramenta = 'parede';
  let pressionado = false;
  let proximaTentativa = 1;

  /* ---------- grade <-> configuração ---------- */
  // No celular em pé a grade é girada 90° (vira "alta" em vez de "larga"), o que deixa as células
  // bem maiores para o toque. O robô se comporta igual: só o desenho muda.
  function retrato() { return window.matchMedia('(max-width: 640px)').matches; }

  function girar90(config) {
    const l = config.linhas;
    const nl = l.length;
    const nc = l[0].length;
    const novas = [];
    for (let c = 0; c < nc; c++) {
      let linha = '';
      for (let r = nl - 1; r >= 0; r--) linha += l[r][c];
      novas.push(linha);
    }
    return { linhas: novas };
  }

  function adaptarPreset(p) {
    return retrato() ? Object.assign({}, p, { configuracao: girar90(p.configuracao) }) : p;
  }

  function gradeDeConfig(cfg) { return cfg.linhas.map((l) => l.split('')); }
  function configDeGrade() { return { linhas: grade.map((l) => l.join('')) }; }
  function colunas() { return grade[0].length; }
  function linhas() { return grade.length; }

  function ajustarCanvas() {
    canvas.width = colunas() * TAM;
    canvas.height = linhas() * TAM;
  }

  /* ---------- desenho ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function desenharParede(x, y) {
    ctx.fillStyle = '#7c3aed';
    rr(x * TAM + 2, y * TAM + 2, TAM - 4, TAM - 4, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(x * TAM + 6, y * TAM + 6, TAM - 12, 8, 4);
    ctx.fill();
  }

  function desenharInicio(x, y) {
    ctx.fillStyle = 'rgba(52,211,153,0.18)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    rr(x * TAM + 4, y * TAM + 4, TAM - 8, TAM - 8, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I', x * TAM + TAM / 2, y * TAM + TAM / 2 + 1);
  }

  function desenharDestino(x, y) {
    const cx = x * TAM + TAM / 2;
    const cy = y * TAM + TAM / 2;
    ctx.fillStyle = 'rgba(251,146,60,0.18)';
    rr(x * TAM + 4, y * TAM + 4, TAM - 8, TAM - 8, 10);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, TAM * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, TAM * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c'; ctx.fill();
  }

  function desenharRobo(e) {
    const cx = (e.x + 0.5) * TAM;
    const cy = (e.y + 0.5) * TAM;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.dir * Math.PI / 2);   // desenhado olhando para cima (norte)
    ctx.fillStyle = '#0b0912';
    ctx.fillRect(-0.34 * TAM, -0.2 * TAM, 0.1 * TAM, 0.4 * TAM);
    ctx.fillRect(0.24 * TAM, -0.2 * TAM, 0.1 * TAM, 0.4 * TAM);
    ctx.fillStyle = '#fb923c';
    rr(-0.25 * TAM, -0.3 * TAM, 0.5 * TAM, 0.6 * TAM, 6);
    ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.arc(0, -0.3 * TAM, 0.09 * TAM, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function desenharFeixe(e) {
    if (!sim || e.status !== 'executando' || e.mira.celulas === null) return;
    const cx = (e.x + 0.5) * TAM;
    const cy = (e.y + 0.5) * TAM;
    const comp = (e.mira.celulas + 0.5) * TAM;
    const larg = comp * 0.2 + 6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.mira.dir * Math.PI / 2);
    ctx.fillStyle = 'rgba(196,181,253,0.30)';
    ctx.beginPath();
    ctx.moveTo(0, -0.3 * TAM);
    ctx.lineTo(-larg, -comp);
    ctx.lineTo(larg, -comp);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function desenhar() {
    const cols = colunas();
    const rows = linhas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#14111f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // robô de prévia quando não há simulação em curso
    const e = (sim || criarSimulacao(configDeGrade())).estado;

    if (sim) {
      ctx.fillStyle = 'rgba(251,146,60,0.10)';
      e.trilha.forEach((p) => ctx.fillRect(p.x * TAM, p.y * TAM, TAM, TAM));
    }

    ctx.strokeStyle = '#2a2440';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * TAM + 0.5, 0); ctx.lineTo(x * TAM + 0.5, rows * TAM); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * TAM + 0.5); ctx.lineTo(cols * TAM, y * TAM + 0.5); }
    ctx.stroke();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = grade[y][x];
        if (ch === '#') desenharParede(x, y);
        else if (ch === 'S') desenharInicio(x, y);
        else if (ch === 'G') desenharDestino(x, y);
      }
    }

    if (sim && e.trilha.length > 1) {
      ctx.strokeStyle = 'rgba(251,146,60,0.55)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      e.trilha.forEach((p, i) => {
        const px = (p.x + 0.5) * TAM;
        const py = (p.y + 0.5) * TAM;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    desenharFeixe(e);
    desenharRobo(e);
  }

  /* ---------- painel ---------- */
  function cm(v) { return v === null || v === undefined ? '—' : v + ' cm'; }
  function seg(v) { return v.toFixed(1).replace('.', ',') + ' s'; }

  function mostrarMensagem(texto, tipo) {
    const m = el('mensagem');
    m.textContent = texto || '';
    m.className = 'mensagem' + (tipo ? ' ' + tipo : '');
  }

  function atualizarPainel() {
    const e = sim ? sim.estado : null;
    el('sFrente').textContent = e ? cm(e.sensor.frente) : '—';
    el('sEsquerda').textContent = e ? cm(e.sensor.esquerda) : '—';
    el('sDireita').textContent = e ? cm(e.sensor.direita) : '—';
    el('sCondicao').textContent = e ? e.condicao : 'Aguardando início';
    el('sDecisao').textContent = e ? e.decisao : '—';
    el('legenda').textContent = e && e.status !== 'pronto' ? e.decisao : '';
    el('eTempo').textContent = e ? seg(e.tempo) : seg(0);
    el('ePassos').textContent = e ? e.passos : 0;
    el('eColisoes').textContent = e ? e.colisoes : 0;
    el('eTentativa').textContent = proximaTentativa;

    const st = el('eStatus');
    st.className = 'status';
    if (!e || e.status === 'pronto') {
      st.textContent = 'Pronto';
      mostrarMensagem('');
    } else if (e.status === 'executando') {
      st.textContent = timer ? 'Em movimento' : 'Pausado';
      mostrarMensagem('');
    } else if (e.status === 'sucesso') {
      st.textContent = 'Destino alcançado';
      st.classList.add('ok');
      mostrarMensagem('Destino alcançado em ' + seg(e.tempo) + '!', 'ok');
    } else {
      st.textContent = 'Bloqueado';
      st.classList.add('falha');
      mostrarMensagem('O robô ficou bloqueado: ' + e.motivo + '.', 'falha');
    }

    const lista = el('listaRegistro');
    lista.textContent = '';
    if (e) {
      e.registro.slice(-12).reverse().forEach((r) => {
        const li = document.createElement('li');
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = seg(r.t);
        li.append(t, document.createTextNode(r.texto));
        lista.append(li);
      });
    }
    atualizarBotoes();
  }

  function terminou() {
    return !!sim && (sim.estado.status === 'sucesso' || sim.estado.status === 'bloqueado');
  }

  function atualizarBotoes() {
    const b = el('btnIniciar');
    if (timer) b.textContent = 'Pausar';
    else if (sim && sim.estado.status === 'executando') b.textContent = 'Continuar';
    else if (terminou()) b.textContent = 'Tentar de novo';
    else b.textContent = 'Iniciar';
    el('btnPasso').disabled = !!timer || terminou();
    el('btnExcluir').hidden = !(cenario.id && salvos.some((c) => c.id === cenario.id));
  }

  /* ---------- histórico ---------- */
  async function atualizarHistorico() {
    const todos = await Banco.listarResultados();
    // Conta pelo nome: cenários predefinidos e percursos não salvos não têm id no banco.
    proximaTentativa = todos.filter((r) => r.cenarioNome === cenario.nome).length + 1;
    el('eTentativa').textContent = proximaTentativa;

    const corpo = el('corpoHistorico');
    corpo.textContent = '';
    todos.slice().reverse().slice(0, 30).forEach((r) => {
      const tr = document.createElement('tr');
      const celulas = [
        ['Cenário', r.cenarioNome, 'titulo'],
        ['Tentativa', '#' + r.tentativa, ''],
        ['Tempo', seg(r.tempo), ''],
        ['Colisões', String(r.colisoes), ''],
        ['Ruído', r.ruido ? 'ligado' : 'desligado', '']
      ];
      celulas.forEach(([rotulo, t, classe]) => {
        const td = document.createElement('td');
        td.textContent = t;
        td.dataset.rotulo = rotulo;
        if (classe) td.className = classe;
        tr.append(td);
      });
      const res = document.createElement('td');
      res.textContent = r.concluido ? 'Concluído' : 'Falhou';
      res.className = r.concluido ? 'ok' : 'falha';
      res.dataset.rotulo = 'Resultado';
      tr.append(res);
      const acao = document.createElement('td');
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Excluir';
      del.addEventListener('click', async () => {
        await Banco.excluirResultado(r.id);
        atualizarHistorico();
      });
      acao.append(del);
      tr.append(acao);
      corpo.append(tr);
    });
    document.dispatchEvent(new CustomEvent('robolab:resultados'));
  }

  async function registrarResultado() {
    const e = sim.estado;
    try {
      await Banco.registrarResultado({
        // só cenários salvos existem no banco; predefinidos e "Personalizado" vão sem vínculo
        cenarioId: salvos.some((c) => c.id === cenario.id) ? cenario.id : null,
        cenarioNome: cenario.nome,
        tempo: Number(e.tempo.toFixed(1)),
        colisoes: e.colisoes,
        tentativa: proximaTentativa,
        passos: e.passos,
        concluido: e.status === 'sucesso',
        motivo: e.motivo,
        ruido: el('ruido').checked
      });
    } catch (err) {
      // o resultado desta tentativa não foi guardado (ex.: limite do servidor); o jogo segue normalmente
    }
    atualizarHistorico();
  }

  /* ---------- execução ---------- */
  function atraso() { return ATRASOS[Number(el('velocidade').value) - 1]; }

  function novaSimulacao() {
    sim = criarSimulacao(configDeGrade(), { ruido: el('ruido').checked });
  }

  function parar() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function tique() {
    sim.passo();
    desenhar();
    if (terminou()) {
      parar();
      atualizarPainel();
      registrarResultado();
    } else {
      atualizarPainel();
    }
  }

  function alternar() {
    if (timer) { parar(); atualizarPainel(); return; }
    if (!sim || terminou()) novaSimulacao();
    timer = setInterval(tique, atraso());
    atualizarPainel();
  }

  function umPasso() {
    if (timer || terminou()) return;
    if (!sim) novaSimulacao();
    tique();
  }

  function reiniciar() {
    parar();
    sim = null;
    desenhar();
    atualizarPainel();
  }

  /* ---------- edição da grade ---------- */
  function celulaDoEvento(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((ev.clientX - r.left) / r.width) * colunas()),
      y: Math.floor(((ev.clientY - r.top) / r.height) * linhas())
    };
  }

  function marcarComoPersonalizado() {
    if (cenario.id !== null || cenario.nome !== 'Personalizado') {
      cenario = { id: null, nome: 'Personalizado' };
      montarSeletor();
      atualizarHistorico();
    }
  }

  // Com a ferramenta Parede, tocar em uma parede existente a remove (e arrastar a partir dela apaga).
  function ferramentaEfetiva(x, y) {
    if (x < 0 || y < 0 || x >= colunas() || y >= linhas()) return ferramenta;
    return ferramenta === 'parede' && grade[y][x] === '#' ? 'apagar' : ferramenta;
  }

  function aplicar(x, y, ferr) {
    if (x < 0 || y < 0 || x >= colunas() || y >= linhas()) return;
    if (sim && sim.estado.status === 'executando') {
      mostrarMensagem('Pause e use "Reiniciar" para editar o percurso.', '');
      return;
    }
    const atual = grade[y][x];
    let mudou = false;

    if (ferr === 'parede' && atual === '.') { grade[y][x] = '#'; mudou = true; }
    else if (ferr === 'apagar' && atual === '#') { grade[y][x] = '.'; mudou = true; }
    else if ((ferr === 'inicio' || ferr === 'destino') && atual !== 'S' && atual !== 'G') {
      const marca = ferr === 'inicio' ? 'S' : 'G';
      grade.forEach((linha) => linha.forEach((c, i) => { if (c === marca) linha[i] = '.'; }));
      grade[y][x] = marca;
      mudou = true;
    }

    if (mudou) {
      sim = null;
      marcarComoPersonalizado();
      desenhar();
      atualizarPainel();
    }
  }

  /* Mouse e caneta: clicar e arrastar pinta.
   * Dedo: um toque marca a célula e arrastar rola a página (a grade não prende a rolagem).
   * Para desenhar arrastando no celular, o botão "Desenhar arrastando" liga o modo desenho. */
  let ferrGesto = 'parede';
  let modoDesenho = false;
  const toque = { ativo: false, x: 0, y: 0, moveu: false };

  canvas.addEventListener('pointerdown', (ev) => {
    const c = celulaDoEvento(ev);
    if (ev.pointerType !== 'touch' || modoDesenho) {
      pressionado = true;
      canvas.setPointerCapture(ev.pointerId);
      ferrGesto = ferramentaEfetiva(c.x, c.y);
      aplicar(c.x, c.y, ferrGesto);
    } else {
      toque.ativo = true;
      toque.moveu = false;
      toque.x = ev.clientX;
      toque.y = ev.clientY;
    }
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (toque.ativo) {
      if (Math.hypot(ev.clientX - toque.x, ev.clientY - toque.y) > 8) toque.moveu = true;
      return;
    }
    if (!pressionado || (ferrGesto !== 'parede' && ferrGesto !== 'apagar')) return;
    const c = celulaDoEvento(ev);
    aplicar(c.x, c.y, ferrGesto);
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (toque.ativo && !toque.moveu) {
      const c = celulaDoEvento(ev);
      aplicar(c.x, c.y, ferramentaEfetiva(c.x, c.y));
    }
    toque.ativo = false;
    pressionado = false;
  });

  canvas.addEventListener('pointercancel', () => {   // o navegador assumiu o gesto (rolagem)
    toque.ativo = false;
    pressionado = false;
  });

  el('btnDesenho').addEventListener('click', () => {
    modoDesenho = !modoDesenho;
    const b = el('btnDesenho');
    b.classList.toggle('ativa', modoDesenho);
    b.setAttribute('aria-pressed', String(modoDesenho));
    b.textContent = modoDesenho ? 'Desenho ligado: arraste na grade' : 'Desenhar arrastando';
    canvas.classList.toggle('desenhando', modoDesenho);
  });

  document.querySelectorAll('.ferr').forEach((b) => {
    b.addEventListener('click', () => {
      ferramenta = b.dataset.ferramenta;
      document.querySelectorAll('.ferr').forEach((o) => {
        const ativa = o === b;
        o.classList.toggle('ativa', ativa);
        o.setAttribute('aria-pressed', String(ativa));
      });
    });
  });

  el('btnLimpar').addEventListener('click', () => {
    if (sim && sim.estado.status === 'executando') { mostrarMensagem('Use "Reiniciar" antes de limpar.', ''); return; }
    grade.forEach((linha) => linha.forEach((c, i) => { if (c === '#') linha[i] = '.'; }));
    sim = null;
    marcarComoPersonalizado();
    desenhar();
    atualizarPainel();
  });

  /* ---------- cenários ---------- */
  function montarSeletor() {
    const sel = el('seletorCenario');
    sel.textContent = '';
    if (cenario.id === null) sel.append(new Option('Personalizado (não salvo)', 'custom'));

    const g1 = document.createElement('optgroup');
    g1.label = 'Predefinidos';
    PRESETS.forEach((p) => g1.append(new Option(p.nome, p.id)));
    sel.append(g1);

    if (salvos.length) {
      const g2 = document.createElement('optgroup');
      g2.label = 'Meus cenários';
      salvos.forEach((c) => g2.append(new Option(c.nome, c.id)));
      sel.append(g2);
    }
    sel.value = cenario.id === null ? 'custom' : cenario.id;
    atualizarBotoes();
  }

  async function carregarSalvos() { salvos = await Banco.listarCenarios(); }

  async function carregarCenario(c) {
    parar();
    sim = null;
    grade = gradeDeConfig(c.configuracao);
    cenario = { id: c.id, nome: c.nome };
    ajustarCanvas();
    montarSeletor();
    el('nomeCenario').value = '';
    desenhar();
    await atualizarHistorico();
    atualizarPainel();
  }

  el('seletorCenario').addEventListener('change', (ev) => {
    const id = ev.target.value;
    if (id === 'custom') return;
    const p = PRESETS.find((x) => x.id === id);
    const c = p ? adaptarPreset(p) : salvos.find((s) => s.id === id);
    if (c) carregarCenario(c);
  });

  el('btnSalvar').addEventListener('click', async () => {
    const nome = el('nomeCenario').value.trim();
    if (!nome) { mostrarMensagem('Dê um nome ao percurso antes de salvar.', ''); el('nomeCenario').focus(); return; }
    try {
      const criado = await Banco.criarCenario({ nome, configuracao: configDeGrade() });
      await carregarSalvos();
      await carregarCenario(criado);
      mostrarMensagem('Cenário "' + nome + '" salvo.', 'ok');
    } catch (e) {
      mostrarMensagem(e instanceof Banco.ErroApi ? e.message : 'Não foi possível salvar agora. Tente de novo.', 'falha');
    }
  });

  el('btnExcluir').addEventListener('click', async () => {
    if (!cenario.id || !confirm('Excluir o cenário "' + cenario.nome + '" e os resultados dele?')) return;
    try {
      await Banco.excluirCenario(cenario.id);
      await carregarSalvos();
      await carregarCenario(adaptarPreset(PRESETS[0]));
    } catch (e) {
      mostrarMensagem('Não foi possível excluir agora. Tente de novo.', 'falha');
    }
  });

  /* ---------- controles ---------- */
  el('btnIniciar').addEventListener('click', alternar);
  el('btnPasso').addEventListener('click', umPasso);
  el('btnReiniciar').addEventListener('click', reiniciar);
  el('velocidade').addEventListener('input', () => {
    if (timer) { clearInterval(timer); timer = setInterval(tique, atraso()); }
  });
  el('ruido').addEventListener('change', () => {
    if (!sim || sim.estado.status === 'pronto' || terminou()) sim = null;
    desenhar();
    atualizarPainel();
  });

  /* ---------- início ---------- */
  (async function iniciar() {
    await carregarSalvos();
    await carregarCenario(adaptarPreset(PRESETS[0]));
  })();
})();
