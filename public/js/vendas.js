// Página de vendas: prévia das receitas (prints), botão fixo mobile e preços dinâmicos.
(() => {
  const $ = (s) => document.querySelector(s);

  // escape obrigatório para qualquer texto que entra em HTML (XSS)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const $$ = (s) => document.querySelectorAll(s);
  let precoAtual = 19.9;

  // ---------- Prévia do produto (prints reais das receitas) ----------
  async function carregarPrevia() {
    try {
      const r = await fetch('/api/receitas/preview');
      const d = await r.json();
      const grade = $('#previa-receitas');
      if (!grade || !d.itens?.length) return;
      grade.innerHTML = d.itens.map((rec) => `
        <article class="print-card">
          <img src="${esc(rec.foto || 'assets/receitas/bowl-frango-quinoa.jpg')}" alt="${esc(rec.nome)}" />
          <div class="corpo">
            <h3>${esc(rec.nome)}</h3>
            <div class="meta">⏱ ${rec.tempo_preparo_min} min • 🍽 ${rec.porcoes} porção(ões)${rec.nutricao_aprox?.kcal_por_porcao ? ` • 🔥 ~${rec.nutricao_aprox.kcal_por_porcao} kcal` : ''}</div>
            <div class="tags">${(rec.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t.replace('-', ' '))}</span>`).join('')}</div>
          </div>
        </article>`).join('');
    } catch {}
  }

  // ---------- Preço vindo da API (mantém LP e checkout em sincronia) ----------
  async function carregarPreco() {
    try {
      const r = await fetch('/api/produto');
      const p = await r.json();
      const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
      const agora = document.querySelector('.preco-card .agora');
      if (agora) agora.innerHTML = `<small>R$</small> ${Number(p.preco).toFixed(2).replace('.', ',')}`;
      const de = document.querySelector('.preco-card .de');
      if (de) de.textContent = `De ${fmt(p.precoAntigo)} por`;
      const topo = document.querySelector('#preco-topo');
      if (topo) topo.textContent = fmt(p.preco);
      const unica = document.querySelector('#preco-compra-unica');
      if (unica) unica.textContent = fmt(p.preco);
      $$('.hero-cta .btn--cta, .cta-final .btn--cta').forEach((b) => {
        b.textContent = `Quero acesso vitalício por ${fmt(p.preco)}`;
      });
      $$('.compra-fixa .preco strong').forEach((b) => { b.textContent = fmt(p.preco); });
      precoAtual = Number(p.preco) || precoAtual;
      // qualquer "R$ 19,90" escrito no texto segue o preço configurado
      const alvo = /R\$\s?19,90/g;
      const caminhador = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nos = [];
      while (caminhador.nextNode()) nos.push(caminhador.currentNode);
      nos.forEach((n) => {
        if (alvo.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(alvo, fmt(p.preco));
      });
    } catch {}
  }

  // ---------- Botão de compra fixo no mobile ----------
  const barra = $('#compra-fixa');
  if (barra) {
    const heroFim = document.querySelector('header.topo');
    const mostrar = () => {
      const limite = heroFim ? heroFim.offsetTop + heroFim.offsetHeight - 80 : 400;
      barra.classList.toggle('visivel', window.scrollY > limite);
    };
    window.addEventListener('scroll', mostrar, { passive: true });
    mostrar();
  }

  // ---------- Tracking de cliques nos CTAs ----------
  $$('a[href="checkout.html"]').forEach((a) => {
    a.addEventListener('click', () => window.OFTrack?.enviar('cta_click', { valor: precoAtual }));
  });

  carregarPrevia();
  carregarPreco();
})();
