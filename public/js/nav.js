/* RoboLab — destaca no menu a seção que está na tela. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;

  const links = Array.from(document.querySelectorAll('.menu a'));
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const ativo = links.find((a) => a.getAttribute('href') === '#' + e.target.id);
      if (ativo) ativo.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  links.forEach((a) => {
    const alvo = document.querySelector(a.getAttribute('href'));
    if (alvo) io.observe(alvo);
  });
})();
