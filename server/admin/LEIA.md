# Painel do grupo (PHP)

Painel **só para o grupo** (não aparece no site público). Mostra quantos aparelhos acessaram o RoboLab, quantas partidas foram jogadas, o desempenho por cenário, um **placar para a TV da feira** e permite **baixar tudo em CSV**.

Ele lê o mesmo banco do Aiven que o site usa. A conexão é **somente leitura** — o painel não consegue alterar nem apagar dados.

## Como usar (no seu computador)

Precisa do PHP 8.1+ com a extensão `pdo_mysql` (no XAMPP já vem).

1. Copie `config.example.php` para `config.php` (na mesma pasta).
2. Preencha host, porta, usuário, senha e nome do banco com os mesmos dados do Aiven que você pôs no Render. O certificado `server/ca.pem` já é usado automaticamente.
3. Gere a senha do painel: `php admin/gerar_senha.php` e cole a linha mostrada em `config.php`.
4. Inicie: `php -S localhost:8080 -t admin` e abra <http://localhost:8080>.
   (No XAMPP, também dá para colocar a pasta `admin` dentro de `htdocs`.)

## Páginas

- `index.php` — resumo: aparelhos, novos hoje, ativos em 24 h, partidas, taxa de sucesso, tempo médio, por cenário, últimas 30 partidas.
- `placar.php` — tela grande para a feira (atualiza a cada 20 s). Usa só percursos desenhados pelos visitantes; nomes digitados por eles não aparecem.
- `exportar.php` — CSV (Excel em português).

## Cuidados

- `config.php` guarda a senha do banco: **nunca** envie ao GitHub (já está no `.gitignore`).
- O contador conta **aparelhos/navegadores**, não pessoas.
- Se o Aiven estiver desligado por inatividade, o painel avisa; ligue o serviço no Aiven.
- Para testar sem o Aiven: `php admin/tests/criar_demo.php` cria um banco SQLite de demonstração (use `'driver' => 'sqlite', 'arquivo' => '...'` no `config.php`).