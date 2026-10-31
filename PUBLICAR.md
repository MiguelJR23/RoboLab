# Como colocar o RoboLab no ar (guia para a feira)

Um site só com HTML, CSS e JS vai para qualquer hospedagem. O RoboLab tem mais duas peças: um **servidor Node** (que entrega o site e a API) e um **banco MySQL**. Cada peça fica em um serviço gratuito:

| Peça | Serviço | O que faz |
|---|---|---|
| Código | **GitHub** | guarda o projeto; o Render lê daqui |
| Servidor | **Render** | roda o `server/` e entrega o site no endereço público |
| Banco | **Aiven** | guarda cenários e resultados (MySQL) |

No fim você terá **um único endereço** (algo como `https://robolab-feira.onrender.com`), que é o que vai no QR Code.

> **Aviso honesto:** o servidor, a API e o QR Code foram testados aqui. O que **não** foi possível testar é a conexão real com Render e Aiven, porque eu não tenho conta neles. Os nomes de botões e menus abaixo podem estar um pouco diferentes na tela de vocês. Se algo falhar, veja a seção "Problemas comuns" no fim. **Façam todo este passo a passo pelo menos 3 dias antes da feira.**

---

## 1. Colocar o projeto no GitHub

1. Crie uma conta em github.com (se ainda não tem) e clique em **New repository**. Nome sugerido: `robolab`. Pode ser público.
2. Na pasta `robolab` (a que tem `public/`, `server/` e este arquivo), abra o terminal e rode:

```
git init
git add .
git commit -m "RoboLab"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/robolab.git
git push -u origin main
```

O arquivo `.gitignore` já impede que `node_modules` e `.env` (senhas) subam. **Nunca coloque senhas dentro do código nem no GitHub.**

---

## 2. Criar o banco no Aiven

1. Crie uma conta em aiven.io (não pede cartão).
2. Crie um serviço **MySQL** e escolha o plano **Free**. Escolha a região mais próxima (por exemplo, América do Sul ou EUA leste) e espere o status ficar **Running** (pode levar alguns minutos).
3. Na página do serviço, anote:
   - **Host**, **Port** (não é 3306, é um número diferente), **User** (normalmente `avnadmin`), **Password** e **Database name** (normalmente `defaultdb`).
4. Baixe o **CA certificate** (botão "Download" ao lado de "CA certificate"). Vem um arquivo `ca.pem`.
5. Coloque esse arquivo em **`server/ca.pem`** dentro do projeto e envie ao GitHub:

```
git add server/ca.pem
git commit -m "Certificado do banco"
git push
```

O certificado é público, não é segredo. A **senha** é que não pode ir para o GitHub.

**Você não precisa criar tabelas.** O servidor cria `cenarios` e `resultados` sozinho na primeira vez que conecta.

---

## 3. Criar o servidor no Render

1. Crie uma conta em render.com e entre com o GitHub.
2. Clique em **New +** → **Web Service** → escolha o repositório `robolab`.
3. Preencha:

| Campo | Valor |
|---|---|
| Name | `robolab-feira` (define o endereço; se estiver ocupado, escolha outro) |
| Language | Node |
| Branch | `main` |
| Root Directory | **deixe vazio** |
| Build Command | `cd server && npm install` |
| Start Command | `cd server && node server.js` |
| Instance Type | Free |

4. Em **Environment Variables**, adicione uma por uma (os valores vêm do Aiven, passo 2):

| Nome | Valor |
|---|---|
| `DB_HOST` | o Host do Aiven |
| `DB_PORT` | a Port do Aiven |
| `DB_USER` | o User do Aiven |
| `DB_PASSWORD` | a Password do Aiven |
| `DB_NAME` | o Database name (ex.: `defaultdb`) |
| `DB_CA_FILE` | `ca.pem` |
| `NODE_VERSION` | `22` |

5. Clique em **Create Web Service** e espere o deploy terminar (alguns minutos).

---

## 4. Testar

Abra o endereço do Render (aparece no topo da página do serviço).

1. Abra `https://SEU-ENDERECO.onrender.com/api/saude`. Deve aparecer `{"ok":true}`.
   - Se aparecer `503` ou "Banco de dados indisponível", o servidor está no ar mas **não conectou no banco**. Veja "Problemas comuns".
2. Abra o site no **celular**, vá em Desafio, rode uma simulação até o fim e confira se o resultado aparece em Resultados.
3. Feche e abra o site de novo: o resultado deve continuar lá.
4. Abra em **outro celular**: ele **não** deve ver o histórico do primeiro. (Cada aparelho tem o seu.)
5. Se no fim da seção Resultados aparecer "Seus resultados estão salvos só neste aparelho", o site está funcionando, mas **sem** o banco.

---

## 5. Gerar o QR Code

Na pasta `server/`:

```
npm install
npm run qr -- https://SEU-ENDERECO.onrender.com
```

Isso cria `qr-robolab.png` e `qr-robolab.svg` na pasta principal do projeto.

- Imprima com **no mínimo 5 × 5 cm**, fundo branco, sem rodar nem esticar.
- **Escreva o endereço em letras grandes embaixo** do QR, para quem não conseguir ler.
- Teste a leitura em pelo menos **2 celulares diferentes**, um com Wi-Fi e outro com dados móveis.

---

## 6. No dia da feira (leia isto)

- **O Render gratuito dorme** depois de 15 minutos sem ninguém acessar, e o primeiro acesso depois disso leva cerca de **1 minuto** para carregar. Abra o site no seu celular uns **10 a 15 minutos antes** da feira começar e deixe uma aba aberta. Se ficar um período sem visitantes, acesse de novo antes da próxima rodada.
- **O Aiven gratuito pode desligar o banco** por inatividade. Entre no painel do Aiven no dia anterior e confirme que o serviço está **Running**. Se estiver desligado, é só ligar de volta por lá.
- **Se o banco cair**, o site continua funcionando: as simulações rodam e o histórico fica salvo no próprio celular de cada visitante.
- A internet do local pode ser ruim. Leve o endereço anotado e, se der, **uma cópia do site rodando no seu notebook** (`cd server && npm install && npm start`, abrir `http://localhost:3000`) como plano B para demonstrar sem internet.
- O Render avisa que o plano gratuito não é para produção. Para uma feira escolar serve, mas não é para ficar no ar por meses.

---

## Problemas comuns

**O site abre, mas diz "salvos só neste aparelho".** O servidor não conseguiu falar com o banco. No Render, abra **Logs** e procure a mensagem "Banco de dados indisponível (...)". O que ela diz indica o problema:

| Mensagem no log | O que fazer |
|---|---|
| `ECONNREFUSED` ou `ETIMEDOUT` | Host ou Port errados, ou o serviço do Aiven está desligado (ligue no painel). |
| `Access denied for user` | User ou Password errados. Copie de novo do Aiven, sem espaço no começo ou no fim. |
| `self-signed certificate` / `unable to verify` | O `ca.pem` não está no projeto, está com outro nome, ou `DB_CA_FILE` não é `ca.pem`. |
| `ENOENT ... ca.pem` | O arquivo `server/ca.pem` não foi enviado ao GitHub (`git add server/ca.pem`, commit e push). |
| `Unknown database` | `DB_NAME` errado. Use o nome exato mostrado no Aiven. |

O servidor tenta reconectar sozinho a cada 15 segundos, então corrigir a variável e esperar já resolve. Depois de mudar variáveis no Render, ele reinicia sozinho.

**Mudei algo no código e não apareceu.** Faça `git add .`, `git commit` e `git push`. O Render publica de novo sozinho.

**O endereço dá "Not Found".** Confira se o **Root Directory** está vazio e se o Start Command é exatamente `cd server && node server.js`.

**Quero testar o banco do Aiven pelo meu computador.** Copie `server/.env.example` para `server/.env`, preencha com os dados do Aiven (descomentando as linhas da nuvem) e rode `cd server && npm start`.
