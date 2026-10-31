# RoboLab — site do Robô Desviador de Obstáculos

Site interativo com explicação do robô, a lógica de decisão, o Desafio do Labirinto (robô virtual) e resultados com gráficos. API REST em Node.js + Express e banco MySQL.

**Equipe:** Cauã Ribeiro, Marcos Bueno, Miguel Januario e Rafael Nunes.

---

## Acesse o site

**Link:** https://robolab-xf81.onrender.com

> `![QR Code do RoboLab](docs/qr.png)`

Aponte a câmera do celular para o QR Code para abrir o site.

> O site fica em uma hospedagem gratuita que "dorme" quando ninguém acessa. Se a primeira abertura demorar cerca de 1 minuto, é normal: o servidor está acordando.

---

```
RoboLab/
  public/       o site (HTML, CSS, JS, Chart.js local)
  server/       API (Express), banco (schema.sql), testes e gerador de QR Code
  PUBLICAR.md   como colocar no ar (GitHub + Render + Aiven) e gerar o QR Code
```

## Rodar só o site (sem servidor nem banco)

Abra `public/index.html` no navegador. Sem servidor, cenários e resultados ficam salvos no próprio navegador, e a seção Resultados avisa isso.

## Rodar no seu computador com a API e o banco

1. Crie um banco vazio chamado `robolab` (no XAMPP: phpMyAdmin → Novo, ou `CREATE DATABASE robolab CHARACTER SET utf8mb4;`).
2. Copie `server/.env.example` para `server/.env` e ajuste usuário e senha (no XAMPP padrão: usuário `root`, senha vazia).
3. Instale e inicie:

   ```
   cd server
   npm install
   npm start
   ```

4. Abra http://localhost:3000. As tabelas são criadas automaticamente na primeira conexão (`server/schema.sql`).

Para colocar na internet e gerar o QR Code, siga o **PUBLICAR.md**.

## Testes

```
cd server
npm test
```

Testa todas as rotas com um repositório em memória (não precisa de MySQL) e confere se cada consulta SQL é válida e filtrada por visitante. Não substitui um teste com o banco real.

## Como os dados são separados

Cada navegador gera um identificador aleatório (UUID) e o envia no cabeçalho `X-Visitante`. A API só devolve e altera os cenários e resultados daquele identificador. Não há login: quem limpar os dados do navegador perde o acesso ao próprio histórico. Limites por visitante: 30 cenários e 300 resultados.

## Rotas da API

Todas, exceto `/api/saude`, exigem o cabeçalho `X-Visitante`.

| Método | Rota                     | Finalidade           |
|--------|--------------------------|----------------------|
| GET    | /api/saude               | Verifica servidor e banco |
| GET    | /api/cenarios            | Listar cenários      |
| GET    | /api/cenarios/:id        | Consultar um cenário |
| POST   | /api/cenarios            | Criar um cenário     |
| PUT    | /api/cenarios/:id        | Atualizar um cenário |
| DELETE | /api/cenarios/:id        | Excluir um cenário (apaga os resultados dele) |
| GET    | /api/resultados          | Listar resultados (filtro opcional `?cenarioId=`) |
| GET    | /api/resultados/:id      | Consultar um resultado |
| POST   | /api/resultados          | Registrar um resultado |
| PUT    | /api/resultados/:id      | Atualizar um resultado |
| DELETE | /api/resultados/:id      | Excluir um resultado |

Os cenários predefinidos existem só no site. Resultados feitos neles ficam sem vínculo (`cenarioId` nulo) e guardam o nome do cenário.

## Observações

- Se o servidor ou o banco ficarem fora do ar, o site passa para o modo "só neste aparelho". O que for gravado nesse período não é enviado ao banco depois.
- A estratégia de desvio do robô virtual está em `public/js/sim.js` (função `varrer`). É uma versão simplificada, pensada para a demonstração.
- No celular em pé a grade do labirinto é girada 90° para as células ficarem maiores; o robô se comporta igual.
