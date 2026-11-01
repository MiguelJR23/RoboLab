<?php
/* Cria um banco SQLite de DEMONSTRAÇÃO para testar o painel sem o Aiven.
 * Uso:  php admin/tests/criar_demo.php [arquivo.sqlite] [--sem-visitas]
 * Depois use em config.php:  'driver' => 'sqlite', 'arquivo' => '/caminho/arquivo.sqlite' */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$arquivo = $argv[1] ?? __DIR__ . '/demo.sqlite';
$semVisitas = in_array('--sem-visitas', $argv, true);
@unlink($arquivo);
$pdo = new PDO('sqlite:' . $arquivo, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$pdo->exec('CREATE TABLE resultados (id INTEGER PRIMARY KEY AUTOINCREMENT, visitante_id TEXT, cenario_id INTEGER, cenario_nome TEXT,
  tentativa INTEGER, tempo REAL, colisoes INTEGER, passos INTEGER, concluido INTEGER, motivo TEXT, ruido INTEGER, executado_em TEXT)');
if (!$semVisitas) {
    $pdo->exec('CREATE TABLE visitas (visitante_id TEXT PRIMARY KEY, primeiro_acesso TEXT, ultimo_acesso TEXT, acessos INTEGER)');
}

$agora = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$ins = $pdo->prepare('INSERT INTO resultados (visitante_id, cenario_id, cenario_nome, tentativa, tempo, colisoes, passos, concluido, motivo, ruido, executado_em)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?)');
$nomes = [[null, 'Corredor reto'], [null, 'Personalizado'], [null, 'Personalizado'], [7, '=HYPERLINK("http://x","clique")'], [null, 'Zigue-zague']];
for ($i = 0; $i < 40; $i++) {
    [$cid, $nome] = $nomes[$i % count($nomes)];
    $ok = $i % 4 !== 0;
    $ins->execute(['vis' . ($i % 9), $cid, $nome, intdiv($i, 5) + 1, 8 + ($i * 1.7) % 30, $i % 6, 20 + $i, $ok ? 1 : 0,
        $ok ? '' : '+Preso (teste)', $i % 3 === 0 ? 1 : 0, $agora->modify('-' . ($i * 7) . ' minutes')->format('Y-m-d H:i:s')]);
}
if (!$semVisitas) {
    $v = $pdo->prepare('INSERT INTO visitas VALUES (?,?,?,?)');
    for ($i = 0; $i < 25; $i++) {
        $p = $agora->modify('-' . ($i * 53) . ' minutes');
        $v->execute([sprintf('vis%02d', $i), $p->format('Y-m-d H:i:s'), $p->modify('+10 minutes')->format('Y-m-d H:i:s'), 1 + $i % 3]);
    }
}
echo "Criado: $arquivo\n";