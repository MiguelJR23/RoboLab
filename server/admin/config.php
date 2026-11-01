<?php
return [
    'driver'  => 'mysql',            // 'mysql' (produção) ou 'sqlite' (só para testes locais)
    'host'    => 'mysql-39596b8b-r0b3rts2332-40ae.i.aivencloud.com',
    'port'    => 26571,               // use a porta que o Aiven mostrar
    'usuario' => 'avnadmin',
    'senha'   => 'AVNS_LdJIT0Mz-Mnx9loS6cb',
    'banco'   => 'defaultdb',
    'ca_file' => __DIR__ . '/../server/ca.pem',

    // Senha do painel. Gere o valor com:  php admin/gerar_senha.php

    'fuso' => 'America/Sao_Paulo',
];