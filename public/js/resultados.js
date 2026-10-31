/* RoboLab — resumo e gráficos dos resultados (Chart.js, arquivo local). */
(function () {
  'use strict';

  const Banco = window.Armazenamento;
  const el = (id) => document.getElementById(id);

  const VERDE = '#34d399';
  const VERMELHO = '#f87171';
  const ROXO = '#8b5cf6';
  const LARANJA = '#fb923c';

  let gTempo = null;
  let gSucesso = null;
  let gColisoes = null;

  if (window.Chart) {
    Chart.defaults.color = '#9c92b8';
    Chart.defaults.borderColor = '#2f2547';
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  }

  function seg(v) { return v.toFixed(1).replace('.', ',') + ' s'; }

  function agruparPorCenario(resultados) {
    const mapa = new Map();
    resultados.forEach((r) => {
      if (!mapa.has(r.cenarioNome)) mapa.set(r.cenarioNome, { nome: r.cenarioNome, total: 0, ok: 0, colisoes: 0 });
      const g = mapa.get(r.cenarioNome);
      g.total++;
      if (r.concluido) g.ok++;
      g.colisoes += r.colisoes;
    });
    return Array.from(mapa.values());
  }

  function opcoes(extra) {
    return Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }, extra || {});
  }

  function grafico(atual, id, tipo, dados, extra) {
    if (atual) {
      atual.data = dados;
      atual.update();
      return atual;
    }
    return new Chart(el(id), { type: tipo, data: dados, options: opcoes(extra) });
  }

  async function renderizar() {
    const resultados = await Banco.listarResultados();
    const vazio = resultados.length === 0;

    el('semResultados').hidden = !vazio;
    el('graficos').hidden = vazio;

    const concluidos = resultados.filter((r) => r.concluido);
    el('rTotal').textContent = String(resultados.length);
    el('rTaxa').textContent = vazio ? '—' : Math.round((concluidos.length / resultados.length) * 100) + '%';
    el('rTempo').textContent = concluidos.length
      ? seg(concluidos.reduce((s, r) => s + r.tempo, 0) / concluidos.length)
      : '—';
    el('rColisoes').textContent = String(resultados.reduce((s, r) => s + r.colisoes, 0));

    if (vazio || !window.Chart) return;

    const recentes = resultados.slice(-20);
    gTempo = grafico(gTempo, 'gTempo', 'bar', {
      labels: recentes.map((r) => r.cenarioNome + ' #' + r.tentativa),
      datasets: [{
        label: 'Tempo (s)',
        data: recentes.map((r) => r.tempo),
        backgroundColor: recentes.map((r) => (r.concluido ? VERDE : VERMELHO)),
        borderRadius: 6
      }]
    });

    const grupos = agruparPorCenario(resultados);
    gSucesso = grafico(gSucesso, 'gSucesso', 'bar', {
      labels: grupos.map((g) => g.nome),
      datasets: [{
        label: 'Sucesso (%)',
        data: grupos.map((g) => Math.round((g.ok / g.total) * 100)),
        backgroundColor: ROXO,
        borderRadius: 6
      }]
    }, { scales: { y: { beginAtZero: true, max: 100 } } });

    gColisoes = grafico(gColisoes, 'gColisoes', 'bar', {
      labels: grupos.map((g) => g.nome),
      datasets: [{
        label: 'Colisões por tentativa',
        data: grupos.map((g) => Number((g.colisoes / g.total).toFixed(2))),
        backgroundColor: LARANJA,
        borderRadius: 6
      }]
    });
  }

  function mostrarModo(modo) {
    const p = el('modoArmazenamento');
    p.classList.toggle('local', modo === 'local');
    // Com o servidor no ar não há nada a avisar; sem ele, os dados ficam só neste aparelho.
    p.textContent = modo === 'local' ? 'Seus resultados estão salvos só neste aparelho.' : '';
  }
  document.addEventListener('robolab:modo', (ev) => mostrarModo(ev.detail));
  if (Banco.modo()) mostrarModo(Banco.modo());

  document.addEventListener('robolab:resultados', renderizar);
  renderizar();
})();
