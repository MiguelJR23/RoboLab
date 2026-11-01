<?php
/* Uso (no terminal):  php admin/gerar_senha.php
 * Pede a senha, mostra o hash para colar em config.php (campo senha_admin_hash). A senha em si não é guardada. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

fwrite(STDOUT, "Escolha a senha do painel (mín. 8 caracteres): ");
$senha = trim((string) fgets(STDIN));
if (strlen($senha) < 8) { fwrite(STDERR, "Senha curta demais.\n"); exit(1); }
fwrite(STDOUT, "\nCole esta linha em admin/config.php:\n\n'senha_admin_hash' => '" . password_hash($senha, PASSWORD_DEFAULT) . "',\n");