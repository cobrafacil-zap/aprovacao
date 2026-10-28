// Página de vendas: prévia das receitas (prints), botão fixo mobile e preços dinâmicos.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---------- Prévia do produto (prints reais das receitas) ----------
  async function carregarPrevia() {
    try {
      const r = await fetch('/api/receitas/preview');
      const d = await r.json();
      const grade = $('#previa-receitas');
      if (!grade || !d.itens?.length) return;
      grade.innerHTML = d.itens.map((rec) => `
        <article class="print-card">
          <img src="${rec.foto || 'assets/receitas/bowl-frango-quinoa.jpg'}" alt="${rec.nome}" />
          <div class="corpo">
            <h3>${rec.nome}</h3>
            <div class="meta">⏱ ${rec.tempo_preparo_min} min • 🍽 ${rec.porcoes} porção(ões) • ${rec.categoria.replace('-', ' ')}</div>
            <div class="tags">${(rec.tags || []).slice(0, 3).map((t) => `<span class="tag">${t.replace('-', ' ')}</span>`).join('')}</div>
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
      $$('.hero-cta .btn--cta, .cta-final .btn--cta').forEach((b) => {
        b.textContent = `Quero acesso vitalício por ${fmt(p.preco)}`;
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
    a.addEventListener('click', () => window.OFTrack?.enviar('cta_click', { valor: 19.9 }));
  });

  carregarPrevia();
  carregarPreco();
})();
