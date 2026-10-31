/* RoboLab — seções explicativas: "Por dentro do robô" e "Como o robô decide?". */
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);

  /* ---------- Por dentro do robô ---------- */
  const COMPONENTES = [
    {
      id: 'esp32', nome: 'ESP32', curto: 'ESP32', qtd: '1 unidade',
      funcao: 'Microcontrolador que executa o programa em C++: lê o sensor, decide o que fazer e comanda motores, servo, LEDs e buzzer.',
      importancia: 'É o cérebro do robô. Sem ele não existe leitura, decisão nem movimento.'
    },
    {
      id: 'ultrassonico', nome: 'Sensor ultrassônico', curto: 'Sensor', qtd: '1 unidade',
      funcao: 'Emite um pulso de som e mede quanto tempo o eco leva para voltar, calculando a distância até o obstáculo à frente.',
      importancia: 'São os "olhos" do robô: todas as decisões de desvio partem dessa medida de distância.'
    },
    {
      id: 'ponteh', nome: 'Ponte H L298N', curto: 'Ponte H', qtd: '1 unidade',
      funcao: 'Recebe os sinais do ESP32 e controla o sentido e a velocidade dos dois motores DC.',
      importancia: 'O ESP32 não fornece corrente suficiente para acionar motores. A ponte H faz essa ligação e permite avançar, virar e dar ré.'
    },
    {
      id: 'motores', nome: 'Motores DC', curto: 'Motores', qtd: '2 unidades',
      funcao: 'Giram as duas rodas de tração. Com velocidades diferentes em cada lado, o robô faz curvas (tração diferencial).',
      importancia: 'Transformam a decisão do ESP32 em movimento real.'
    },
    {
      id: 'servo', nome: 'Servo motor', curto: 'Servo', qtd: '1 unidade',
      funcao: 'Gira o sensor ultrassônico para diferentes direções, como esquerda e direita.',
      importancia: 'Permite olhar para os lados sem girar o carrinho inteiro, para escolher o melhor caminho.'
    },
    {
      id: 'sinalizacao', nome: 'LEDs e buzzer', curto: 'LEDs e buzzer', qtd: '2 LEDs amarelos, 2 LEDs vermelhos, 4 resistores e 1 buzzer',
      funcao: 'Os LEDs amarelos indicam direções (setas) e os vermelhos indicam a ré. O buzzer faz o som da ré e a buzina. Os resistores limitam a corrente dos LEDs.',
      importancia: 'Mostram a quem está por perto o que o robô está fazendo.'
    },
    {
      id: 'estrutura', nome: 'Chassi e rodas', curto: 'Chassi e rodas', qtd: '1 chassi, 2 rodas e 1 roda boba',
      funcao: 'O chassi, de plástico ou acrílico, sustenta todos os componentes. As duas rodas são motorizadas e a roda boba gira livre, como a de um carrinho de supermercado.',
      importancia: 'Dá suporte às peças e estabilidade para o robô se movimentar.'
    },
    {
      id: 'energia', nome: 'Baterias e case', curto: 'Baterias', qtd: '2 baterias Li-ion de 3,7 V e 1 case',
      funcao: 'Fornecem a energia elétrica de todo o robô. O case acomoda e conecta as baterias.',
      importancia: 'Sem energia suficiente, motores e ESP32 não funcionam. Gerenciar a energia faz parte do projeto.'
    },
    {
      id: 'conexoes', nome: 'Protoboard e jumpers', curto: 'Protoboard', qtd: '1 protoboard de 170 pinos e vários jumpers',
      funcao: 'A protoboard distribui as conexões elétricas e os jumpers ligam um componente ao outro, sem solda.',
      importancia: 'Permitem montar e alterar o circuito com facilidade durante os testes.'
    }
  ];

  const svg = el('svgRobo');
  const lista = el('listaComp');

  function selecionar(id) {
    const c = COMPONENTES.find((x) => x.id === id);
    if (!c) return;
    el('infoNome').textContent = c.nome;
    el('infoQtd').textContent = c.qtd;
    el('infoFuncao').textContent = c.funcao;
    el('infoImportancia').textContent = c.importancia;
    svg.querySelectorAll('.comp').forEach((g) => g.classList.toggle('sel', g.dataset.comp === id));
    lista.querySelectorAll('button').forEach((b) => {
      const ativa = b.dataset.comp === id;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-pressed', String(ativa));
    });
  }

  COMPONENTES.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.comp = c.id;
    b.textContent = c.curto;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => selecionar(c.id));
    lista.append(b);
  });

  svg.querySelectorAll('.comp').forEach((g) => {
    g.addEventListener('click', () => selecionar(g.dataset.comp));
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        selecionar(g.dataset.comp);
      }
    });
  });

  selecionar('esp32');

  /* ---------- Como o robô decide? ---------- */
  const LIMIAR_CM = 20;
  const PASSOS = [
    'O robô avança pelo percurso.',
    'O sensor ultrassônico mede a distância à frente.',
    'O sistema verifica se há um obstáculo próximo.',
    'Caminho livre: o robô continua avançando.',
    'Obstáculo: o robô para e o servo olha para a esquerda e para a direita.',
    'O robô vira para o lado com mais espaço e volta a avançar.'
  ];
  const CAMINHO_LIVRE = [1, 2, 3, 4];
  const CAMINHO_OBSTACULO = [1, 2, 3, 5, 6];

  const listaPassos = el('passos');
  PASSOS.forEach((texto, i) => {
    const li = document.createElement('li');
    li.dataset.passo = String(i + 1);
    li.textContent = texto;
    listaPassos.append(li);
  });

  const campo = el('distancia');
  let reproduzindo = false;

  function caminhoAtual() {
    return Number(campo.value) < LIMIAR_CM ? CAMINHO_OBSTACULO : CAMINHO_LIVRE;
  }

  function atualizarDecisao() {
    const cm = Number(campo.value);
    const obstaculo = cm < LIMIAR_CM;
    el('distValor').textContent = cm + ' cm';
    el('decCondicao').textContent = obstaculo
      ? 'Obstáculo a ' + cm + ' cm (menos de ' + LIMIAR_CM + ' cm)'
      : 'Caminho livre (' + cm + ' cm à frente)';
    el('decDecisao').textContent = obstaculo
      ? 'Parar, olhar para os lados e desviar'
      : 'Continuar avançando';
    const caminho = caminhoAtual();
    listaPassos.querySelectorAll('li').forEach((li) => {
      li.classList.toggle('ativo', caminho.includes(Number(li.dataset.passo)));
      li.classList.remove('foco');
    });
  }

  campo.addEventListener('input', () => {
    if (reproduzindo) return;
    atualizarDecisao();
  });

  el('btnReproduzir').addEventListener('click', () => {
    if (reproduzindo) return;
    reproduzindo = true;
    const botao = el('btnReproduzir');
    botao.disabled = true;
    atualizarDecisao();
    const caminho = caminhoAtual();
    let i = 0;
    const timer = setInterval(() => {
      listaPassos.querySelectorAll('li').forEach((li) => {
        li.classList.toggle('foco', Number(li.dataset.passo) === caminho[i]);
      });
      i++;
      if (i > caminho.length) {
        clearInterval(timer);
        reproduzindo = false;
        botao.disabled = false;
        atualizarDecisao();
      }
    }, 850);
  });

  atualizarDecisao();
})();
