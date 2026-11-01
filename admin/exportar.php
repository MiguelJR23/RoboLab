<?php
/* Baixa as partidas e os acessos em CSV (abre no Excel). Não inclui o identificador do visitante. */
require __DIR__ . '/bootstrap.php';
exigir_login();
$pdo = banco_ou_erro($config);

header_remove('Cache-Control');
header('Cache-Control: no-store');
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="robolab-' . date('Y-m-d') . '.csv"');

$f = fopen('php://output', 'w');
fwrite($f, "\xEF\xBB\xBF");               // BOM: o Excel reconhece os acentos
$sep = ';';                                // Excel em português usa ponto e vírgula

if (tabela_existe($pdo, 'resultados')) {
    fputcsv($f, ['PARTIDAS'], $sep);
    fputcsv($f, ['Quando', 'Cenário', 'Tentativa', 'Tempo (s)', 'Colisões', 'Passos', 'Chegou', 'Motivo', 'Com ruído'], $sep);
    foreach ($pdo->query('SELECT cenario_nome, tentativa, tempo, colisoes, passos, concluido, motivo, ruido, executado_em FROM resultados ORDER BY id') as $r) {
        $d = para_local($r['executado_em'], $config);
        fputcsv($f, [
            $d ? $d->format('d/m/Y H:i:s') : '', csv_seguro($r['cenario_nome']), $r['tentativa'],
            str_replace('.', ',', (string) $r['tempo']), $r['colisoes'], $r['passos'],
            $r['concluido'] ? 'sim' : 'não', csv_seguro($r['motivo']), $r['ruido'] ? 'sim' : 'não',
        ], $sep);
    }
}
if (tabela_existe($pdo, 'visitas')) {
    fputcsv($f, [], $sep);
    fputcsv($f, ['ACESSOS (um por aparelho)'], $sep);
    fputcsv($f, ['Primeiro acesso', 'Último acesso', 'Aberturas'], $sep);
    foreach ($pdo->query('SELECT primeiro_acesso, ultimo_acesso, acessos FROM visitas ORDER BY primeiro_acesso') as $r) {
        fputcsv($f, [
            para_local($r['primeiro_acesso'], $config)->format('d/m/Y H:i:s'),
            para_local($r['ultimo_acesso'], $config)->format('d/m/Y H:i:s'),
            $r['acessos'],
        ], $sep);
    }
}
fclose($f);