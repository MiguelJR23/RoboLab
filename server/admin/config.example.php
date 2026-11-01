<?php
/* Copie este arquivo para config.php e preencha. O config.php NUNCA vai para o GitHub (está no .gitignore).
 *
 * Os dados de conexão são os mesmos do Aiven que o servidor já usa no Render:
 *   Host -> host | Port -> port | User -> usuario | Password -> senha | Database name -> banco
 *   CA certificate -> o arquivo server/ca.pem do projeto (ca_file abaixo já aponta para ele)
 */
return [
    'driver'  => 'mysql',            // 'mysql' (produção) ou 'sqlite' (só para testes locais)
    'host'    => 'mysql-39596b8b-r0b3rts2332-40ae.i.aivencloud.com',
    'port'    => 26571,               // use a porta que o Aiven mostrar
    'usuario' => 'avnadmin',
    'senha'   => 'AVNS_LdJIT0Mz-Mnx9loS6cb',
    'banco'   => 'defaultdb',
    'ca_file' => __DIR__ . '/../server/ca.pem',

    // Senha do painel. Gere o valor com:  php admin/gerar_senha.php
    'senha_admin_hash' => 'COLOQUE_AQUI_O_HASH_GERADO',

    'fuso' => 'America/Sao_Paulo',
];