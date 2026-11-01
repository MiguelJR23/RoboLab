<?php
require __DIR__ . '/bootstrap.php';
exigir_login();
$pdo = banco_ou_erro($config);

$temVisitas = tabela_existe($pdo, 'visitas');
$temResultados = tabela_existe($pdo, 'resultados');

function um(PDO $pdo, string $sql, array $p = []): array
{
    $s = $pdo->prepare($sql);
    $s->execute($p);
    return $s->fetch() ?: [];
}

$v = ['total' => 0, 'sessoes' => 0, 'hoje' => 0, 'h24' => 0];
$porHora = array_fill(0, 24, 0);
if ($temVisitas) {
    $hoje = inicio_hoje_utc($config);
    $r = um($pdo, 'SELECT COUNT(*) AS total, COALESCE(SUM(acessos),0) AS sessoes FROM visitas');
    $v['total'] = (int) $r['total'];
    $v['sessoes'] = (int) $r['sessoes'];
    $v['hoje'] = (int) um($pdo, 'SELECT COUNT(*) AS n FROM visitas WHERE primeiro_acesso >= ?', [$hoje])['n'];
    $v['h24'] = (int) um($pdo, 'SELECT COUNT(*) AS n FROM visitas WHERE ultimo_acesso >= ?', [agora_utc('-24 hours')])['n'];
    $s = $pdo->prepare('SELECT primeiro_acesso FROM visitas WHERE primeiro_acesso >= ?');
    $s->execute([$hoje]);
    foreach ($s as $linha) {
        $porHora[(int) para_local($linha['primeiro_acesso'], $config)->format('G')]++;
    }
}

$j = ['partidas' => 0, 'pessoas' => 0, 'ok' => 0, 'tempo' => null, 'colisoes' => 0];
$cenarios = [];
$ultimas = [];
if ($temResultados) {
    $r = um($pdo, 'SELECT COUNT(*) AS partidas, COUNT(DISTINCT visitante_id) AS pessoas, COALESCE(SUM(concluido),0) AS ok,
                          AVG(CASE WHEN concluido = 1 THEN tempo END) AS tempo, COALESCE(SUM(colisoes),0) AS colisoes
                     FROM resultados');
    $j = ['partidas' => (int) $r['partidas'], 'pessoas' => (int) $r['pessoas'], 'ok' => (int) $r['ok'],
          'tempo' => $r['tempo'], 'colisoes' => (int) $r['colisoes']];
    $cenarios = $pdo->query('SELECT cenario_nome, COUNT(*) AS n, COALESCE(SUM(concluido),0) AS ok,
                                    AVG(CASE WHEN concluido = 1 THEN tempo END) AS tempo
                               FROM resultados GROUP BY cenario_nome ORDER BY n DESC LIMIT 10')->fetchAll();
    $ultimas = $pdo->query('SELECT cenario_nome, tentativa, tempo, colisoes, concluido, motivo, executado_em
                              FROM resultados ORDER BY id DESC LIMIT 30')->fetchAll();
}
$taxa = $j['partidas'] ? round($j['ok'] * 100 / $j['partidas']) : 0;
$maxHora = max(1, ...$porHora);
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Painel RoboLab</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<header class="topo">
  <h1>Painel RoboLab</h1>
  <nav>
    <a class="btn sec" href="placar.php">Placar da feira</a>
    <a class="btn sec" href="exportar.php">Baixar CSV</a>
    <form method="post" action="logout.php">
      <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
      <button class="btn sec" type="submit">Sair</button>
    </form>
  </nav>
</header>
<main class="pagina">
<?php if (!$temVisitas): ?>
  <p class="aviso">A tabela de acessos ainda não existe. Publique a versão nova do site no Render (ela cria a tabela sozinha ao iniciar) e recarregue esta página.</p>
<?php endif; ?>

  <h2>Acessos ao site</h2>
  <div class="cartoes">
    <div class="cartao"><b><?= num($v['total']) ?></b><span>aparelhos diferentes (total)</span></div>
    <div class="cartao"><b><?= num($v['hoje']) ?></b><span>novos hoje</span></div>
    <div class="cartao"><b><?= num($v['h24']) ?></b><span>ativos nas últimas 24 h</span></div>
    <div class="cartao"><b><?= num($v['sessoes']) ?></b><span>aberturas do site (total)</span></div>
  </div>
  <p class="suave">Conta aparelhos/navegadores, não pessoas: quem limpa os dados do navegador ou usa dois aparelhos conta duas vezes.</p>

  <h2>Novos aparelhos por hora (hoje)</h2>
  <div class="barras" role="img" aria-label="Novos aparelhos por hora hoje">
    <?php foreach ($porHora as $h => $n): ?>
      <i style="height:<?= (int) round($n * 100 / $maxHora) ?>%" title="<?= sprintf('%02d', $h) ?>h: <?= $n ?>"></i>
    <?php endforeach; ?>
  </div>
  <div class="eixo"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>

  <h2>Simulações</h2>
  <div class="cartoes">
    <div class="cartao"><b><?= num($j['pessoas']) ?></b><span>aparelhos que jogaram</span></div>
    <div class="cartao"><b><?= num($j['partidas']) ?></b><span>partidas</span></div>
    <div class="cartao"><b><?= $taxa ?>%</b><span>chegaram ao destino</span></div>
    <div class="cartao"><b><?= $j['tempo'] === null ? '—' : num($j['tempo'], 1) . ' s' ?></b><span>tempo médio (concluídas)</span></div>
    <div class="cartao"><b><?= num($j['colisoes']) ?></b><span>colisões somadas</span></div>
  </div>

  <h2>Por cenário</h2>
  <div class="tabela-rolavel"><table>
    <tr><th>Cenário</th><th>Partidas</th><th>Concluídas</th><th>Tempo médio</th></tr>
    <?php foreach ($cenarios as $c): ?>
      <tr><td><?= e($c['cenario_nome']) ?></td><td><?= num($c['n']) ?></td><td><?= num($c['ok']) ?></td>
          <td><?= $c['tempo'] === null ? '—' : num($c['tempo'], 1) . ' s' ?></td></tr>
    <?php endforeach; ?>
    <?php if (!$cenarios): ?><tr><td colspan="4" class="suave">Ainda não há partidas.</td></tr><?php endif; ?>
  </table></div>

  <h2>Últimas 30 partidas</h2>
  <div class="tabela-rolavel"><table>
    <tr><th>Quando</th><th>Cenário</th><th>#</th><th>Tempo</th><th>Colisões</th><th>Resultado</th></tr>
    <?php foreach ($ultimas as $u): ?>
      <tr><td><?= e(fmt_data($u['executado_em'], $config)) ?></td><td><?= e($u['cenario_nome']) ?></td>
          <td><?= (int) $u['tentativa'] ?></td><td><?= num($u['tempo'], 1) ?> s</td><td><?= (int) $u['colisoes'] ?></td>
          <td class="<?= $u['concluido'] ? 'ok' : 'nok' ?>"><?= $u['concluido'] ? 'Chegou' : e($u['motivo'] ?: 'Não chegou') ?></td></tr>
    <?php endforeach; ?>
    <?php if (!$ultimas): ?><tr><td colspan="6" class="suave">Ainda não há partidas.</td></tr><?php endif; ?>
  </table></div>
</main>
</body>
</html>