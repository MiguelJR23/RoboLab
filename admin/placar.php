<?php
/* Placar para mostrar numa TV/notebook na feira. Atualiza sozinho a cada 20 s.
 * Só usa percursos desenhados pelos visitantes ("Personalizado" ou cenário salvo): os cenários prontos dão sempre o
 * mesmo tempo (o robô é determinístico), então um ranking neles não faria sentido. Nomes digitados pelos visitantes
 * NÃO aparecem na tela, para não exibir texto livre em público. */
require __DIR__ . '/bootstrap.php';
exigir_login();
$pdo = banco_ou_erro($config);

$acessos = 0; $partidas = 0; $chegaram = 0;
$lentos = []; $presos = [];
if (tabela_existe($pdo, 'visitas')) {
    $acessos = (int) $pdo->query('SELECT COUNT(*) FROM visitas')->fetchColumn();
}
if (tabela_existe($pdo, 'resultados')) {
    $r = $pdo->query('SELECT COUNT(*) AS n, COALESCE(SUM(concluido),0) AS ok FROM resultados')->fetch();
    $partidas = (int) $r['n'];
    $chegaram = (int) $r['ok'];
    $custom = "(cenario_id IS NOT NULL OR cenario_nome = 'Personalizado')";
    $lentos = $pdo->query("SELECT tempo, colisoes FROM resultados WHERE concluido = 1 AND $custom ORDER BY tempo DESC LIMIT 5")->fetchAll();
    $presos = $pdo->query("SELECT colisoes, tempo FROM resultados WHERE concluido = 0 AND $custom ORDER BY colisoes DESC, tempo DESC LIMIT 5")->fetchAll();
}
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="20">
<title>Placar RoboLab</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body class="tv">
<h1>RoboLab — Placar da feira</h1>
<div class="grande">
  <div class="cartao"><b><?= num($acessos) ?></b><span>aparelhos visitaram o site</span></div>
  <div class="cartao"><b><?= num($partidas) ?></b><span>partidas jogadas</span></div>
  <div class="cartao"><b><?= num($chegaram) ?></b><span>vezes que o robô chegou ao destino</span></div>
</div>
<div class="duas">
  <section>
    <h2>Percursos que mais atrasaram o robô</h2>
    <ol>
      <?php foreach ($lentos as $l): ?><li><span><?= (int) $l['colisoes'] ?> colisões</span><b><?= num($l['tempo'], 1) ?> s</b></li><?php endforeach; ?>
      <?php if (!$lentos): ?><li class="suave"><span>Desenhe um percurso e rode a simulação!</span></li><?php endif; ?>
    </ol>
  </section>
  <section>
    <h2>Percursos que prenderam o robô</h2>
    <ol>
      <?php foreach ($presos as $p): ?><li><span><?= (int) $p['colisoes'] ?> colisões</span><b><?= num($p['tempo'], 1) ?> s</b></li><?php endforeach; ?>
      <?php if (!$presos): ?><li class="suave"><span>Ninguém prendeu o robô… ainda.</span></li><?php endif; ?>
    </ol>
  </section>
</div>
</body>
</html>