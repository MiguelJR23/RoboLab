<?php
require __DIR__ . '/bootstrap.php';

if (logado()) { header('Location: index.php'); exit; }

$erro = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $bloqueado = ($_SESSION['bloqueio_ate'] ?? 0) > time();
    if (!csrf_valido($_POST['csrf'] ?? null)) {
        $erro = 'Sessão expirada. Tente de novo.';
    } elseif ($bloqueado) {
        $erro = 'Muitas tentativas. Aguarde um minuto.';
    } else {
        $hash = (string) ($config['senha_admin_hash'] ?? '');
        if ($hash !== '' && password_verify((string) ($_POST['senha'] ?? ''), $hash)) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            $_SESSION['falhas'] = 0;
            header('Location: index.php');
            exit;
        }
        usleep(700000);
        $_SESSION['falhas'] = ($_SESSION['falhas'] ?? 0) + 1;
        if ($_SESSION['falhas'] >= 5) { $_SESSION['bloqueio_ate'] = time() + 60; $_SESSION['falhas'] = 0; }
        $erro = 'Senha incorreta.';
    }
}
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Painel RoboLab — entrar</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body class="centro">
<main class="caixa">
  <h1>Painel RoboLab</h1>
  <p class="suave">Área restrita ao grupo.</p>
  <?php if ($erro): ?><p class="erro" role="alert"><?= e($erro) ?></p><?php endif; ?>
  <form method="post" autocomplete="off">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
    <label for="senha">Senha</label>
    <input id="senha" name="senha" type="password" required autofocus>
    <button class="btn" type="submit">Entrar</button>
  </form>
</main>
</body>
</html>