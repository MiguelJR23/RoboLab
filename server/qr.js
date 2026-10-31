/* Gera o QR Code do site.  Uso:  npm run qr -- https://seu-site.onrender.com
 * Cria qr-robolab.png (para colar em slides) e qr-robolab.svg (para imprimir em qualquer tamanho),
 * na pasta principal do projeto. */
'use strict';

const fs = require('fs');
const path = require('path');

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.error('Falta instalar as dependências. Rode "npm install" dentro da pasta server/ e tente de novo.');
  process.exit(1);
}

const endereco = process.argv[2];
if (!endereco || !/^https:\/\/[^\s]+\.[^\s]+$/i.test(endereco)) {
  console.error('Informe o endereço completo do site, começando com https://');
  console.error('Exemplo:  npm run qr -- https://robolab-feira.onrender.com');
  process.exit(1);
}

const pasta = path.join(__dirname, '..');
const opcoes = {
  errorCorrectionLevel: 'H',  // aguenta sujeira e dobras no papel impresso
  margin: 4,                  // margem branca ao redor (necessária para o celular reconhecer)
  color: { dark: '#000000', light: '#ffffff' }
};

(async () => {
  await QRCode.toFile(path.join(pasta, 'qr-robolab.png'), endereco, Object.assign({ width: 1200 }, opcoes));
  fs.writeFileSync(path.join(pasta, 'qr-robolab.svg'), await QRCode.toString(endereco, Object.assign({ type: 'svg' }, opcoes)));
  console.log('QR Code criado para: ' + endereco);
  console.log('  ' + path.join(pasta, 'qr-robolab.png'));
  console.log('  ' + path.join(pasta, 'qr-robolab.svg'));
  console.log('Imprima com pelo menos 5 x 5 cm, fundo branco e letras pretas, e teste em dois celulares antes da feira.');
})().catch((e) => { console.error('Não foi possível gerar o QR Code:', e.message); process.exit(1); });
