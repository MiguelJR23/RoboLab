<?php
/* Código comum do painel: configuração, sessão segura, conexão (somente leitura) e funções auxiliares. */
declare(strict_types=1);

if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    exit('Crie admin/config.php a partir de config.example.php (veja admin/LEIA-ME.md).');
}
$config = require __DIR__ . '/config.php';

date_default_timezone_set('UTC');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'");
header('Cache-Control: no-store');

session_name('robolab_admin');
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict',
    'secure' => !empty($_SERVER['HTTPS']),
]);
session_start();

/** Escapa texto para HTML (usar em TUDO que vem do banco ou do usuário). */
function e($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function csrf_valido(?string $enviado): bool
{
    return is_string($enviado) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $enviado);
}

function logado(): bool
{
    return !empty($_SESSION['admin']);
}

function exigir_login(): void
{
    if (!logado()) { header('Location: login.php'); exit; }
}

/** Conexão PDO. No MySQL a sessão é aberta como READ ONLY: o painel não consegue alterar nada. */
function conectar(array $c): PDO
{
    $opcoes = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if (($c['driver'] ?? 'mysql') === 'sqlite') {
        return new PDO('sqlite:' . $c['arquivo'], null, null, $opcoes);
    }
    if (!empty($c['ca_file']) && is_file($c['ca_file'])) {
        $opcoes[PDO::MYSQL_ATTR_SSL_CA] = $c['ca_file'];
    }
    $opcoes[PDO::ATTR_TIMEOUT] = 10;
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int) $c['port'], $c['banco']);
    $pdo = new PDO($dsn, $c['usuario'], $c['senha'], $opcoes);
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->exec('SET SESSION TRANSACTION READ ONLY');
    return $pdo;
}

function tabela_existe(PDO $pdo, string $nome): bool
{
    try {
        $pdo->query('SELECT 1 FROM ' . preg_replace('/[^a-z_]/', '', $nome) . ' LIMIT 1');
        return true;
    } catch (PDOException $e) {
        return false;
    }
}

/** Texto "AAAA-MM-DD HH:MM:SS" em UTC (como está no banco) -> objeto de data no fuso do painel. */
function para_local(?string $utc, array $c): ?DateTimeImmutable
{
    if (!$utc) return null;
    return (new DateTimeImmutable($utc, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone($c['fuso'] ?? 'America/Sao_Paulo'));
}

function fmt_data(?string $utc, array $c): string
{
    $d = para_local($utc, $c);
    return $d ? $d->format('d/m H:i') : '—';
}

/** Início do dia de hoje no fuso do painel, convertido para UTC no formato do banco. */
function inicio_hoje_utc(array $c): string
{
    $agora = new DateTimeImmutable('now', new DateTimeZone($c['fuso'] ?? 'America/Sao_Paulo'));
    return $agora->setTime(0, 0)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

function agora_utc(string $mod = ''): string
{
    $d = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    return ($mod ? $d->modify($mod) : $d)->format('Y-m-d H:i:s');
}

function num($v, int $casas = 0): string
{
    return number_format((float) $v, $casas, ',', '.');
}

/** Evita "injeção de fórmula" ao abrir o CSV no Excel: texto que começa com = + - @ ganha um apóstrofo. */
function csv_seguro($v): string
{
    $s = (string) $v;
    return ($s !== '' && strpbrk($s[0], "=+-@\t\r") !== false) ? "'" . $s : $s;
}

/** Abre o banco ou mostra uma página de erro amigável (sem vazar senha). */
function banco_ou_erro(array $c): PDO
{
    try {
        return conectar($c);
    } catch (Throwable $ex) {
        http_response_code(503);
        echo '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="estilo.css"><body class="centro">'
           . '<main class="caixa"><h1>Sem conexão com o banco</h1>'
           . '<p>O Aiven pode estar desligado por inatividade (ligue-o no painel do Aiven) ou os dados em <code>config.php</code> estão incorretos.</p>'
           . '<p><a class="btn" href="">Tentar de novo</a></p></main>';
        exit;
    }
}