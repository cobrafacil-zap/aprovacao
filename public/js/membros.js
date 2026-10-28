// Área de membros: receitas liberadas, busca/filtros, favoritos, histórico,
// lista de compras gerada e modo impressão de receita.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 401) { location.href = 'login.html'; throw new Error('login'); }
    return r.json();
  };
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body || {}) });

  let usuario = null;
  let receitas = [];
  let filtros = { q: '', categoria: '', tags: [] };

  // ================= BOOT =================
  (async () => {
    try {
      const eu = await api('/api/membros/eu');
      usuario = eu.usuario;
      $('#saudacao').textContent = `Olá, ${usuario.nome.split(' ')[0]}! 👋`;
      renderizarProxima(eu.proxima);
      await carregarReceitas();
      await carregarFavoritos();
      await carregarHistorico();
      await carregarLista();
    } catch {}
  })();

  $('#btn-sair').addEventListener('click', async () => {
    await post('/api/membros/sair');
    location.href = 'login.html';
  });

  // ================= PRÓXIMA RECEITA =================
  function renderizarProxima(prox) {
    if (!prox) {
      $('#proxima-nome').textContent = 'Biblioteca completa liberada! 🎉';
      $('#proxima-info').textContent = 'Assim que uma nova receita for agendada, ela aparece aqui.';
      $('#proxima-contador').textContent = '✓';
      return;
    }
    $('#proxima-nome').textContent = `Próxima receita: ${prox.nome}`;
    $('#proxima-info').textContent = `Será liberada automaticamente em ${new Date(prox.data).toLocaleDateString('pt-BR')} — você recebe um e-mail avisando.`;
    $('#proxima-contador').textContent = prox.dias <= 0 ? 'hoje!' : `${prox.dias} dia${prox.dias > 1 ? 's' : ''}`;
  }

  // ================= ABAS =================
  $('#abas-membros').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $$('#abas-membros .chip').forEach((b) => b.classList.toggle('ativo', b === btn));
    ['receitas', 'favoritos', 'lista', 'historico'].forEach((a) =>
      $(`#aba-${a}`).classList.toggle('oculto', btn.dataset.aba !== a)
    );
  });

  // ================= RECEITAS =================
  async function carregarReceitas() {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.tags.length) params.set('tags', filtros.tags.join(','));
    const d = await api(`/api/membros/receitas?${params}`);
    receitas = d.receitas;
    renderizarGrade('#grade-receitas', receitas, '#vazio-receitas');
    if (d.proxima) renderizarProxima(d.proxima);
  }

  function cardReceita(r) {
    return `
      <article class="receita-card" data-id="${r.id}">
        ${r.feita ? '<span class="feita-selo">✓ já feita</span>' : ''}
        <button class="favorito" data-fav="${r.id}" aria-label="Favoritar">${r.favorito ? '❤️' : '🤍'}</button>
        <img class="foto" src="${r.foto || '/assets/receitas/bowl-frango-quinoa.svg'}" alt="${r.nome}" />
        <div class="corpo">
          <h3>${r.nome}</h3>
          <div class="meta">⏱ ${r.tempo_preparo_min} min • 🍽 ${r.porcoes} porção(ões)${r.nutricao?.calorias ? ` • 🔥 ${r.nutricao.calorias} kcal` : ''}</div>
          <div class="tags">${(r.tags || []).slice(0, 3).map((t) => `<span class="tag">${t.replace(/-/g, ' ')}</span>`).join('')}</div>
        </div>
      </article>`;
  }

  function renderizarGrade(seletor, lista, seletorVazio) {
    const grade = $(seletor);
    grade.innerHTML = lista.map(cardReceita).join('');
    $(seletorVazio)?.classList.toggle('oculto', lista.length > 0);
    grade.querySelectorAll('.receita-card').forEach((c) =>
      c.addEventListener('click', (e) => {
        if (e.target.closest('[data-fav]')) return;
        abrirReceita(c.dataset.id);
      })
    );
    grade.querySelectorAll('[data-fav]').forEach((b) =>
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        await post(`/api/membros/favoritos/${b.dataset.fav}`);
        await carregarReceitas();
        await carregarFavoritos();
      })
    );
  }

  // Busca e filtros
  let buscaTimer;
  $('#busca').addEventListener('input', (e) => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { filtros.q = e.target.value.trim(); carregarReceitas(); }, 280);
  });
  $('#filtros-categoria').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $$('#filtros-categoria .chip').forEach((b) => b.classList.toggle('ativo', b === btn));
    filtros.categoria = btn.dataset.categoria;
    carregarReceitas();
  });
  $('#filtros-tag').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    btn.classList.toggle('ativo');
    filtros.tags = [...$$('#filtros-tag .chip.ativo')].map((b) => b.dataset.tag);
    carregarReceitas();
  });

  // ================= MODAL DA RECEITA =================
  async function abrirReceita(id) {
    const d = await api(`/api/membros/receitas/${id}`);
    const r = d.receita;
    const nutri = r.nutricao || {};

    $('#modal-conteudo').innerHTML = `
      <img class="foto-capa" src="${r.foto || '/assets/receitas/bowl-frango-quinoa.svg'}" alt="${r.nome}" />
      <div class="conteudo">
        <h2>${r.nome}</h2>
        <p class="cinza">${r.descricao || ''}</p>
        <div class="meta-flex">
          <span>⏱ ${r.tempo_preparo_min} min</span>
          <span>🍽 ${r.porcoes} porção(ões)</span>
          <span>📂 ${r.categoria.replace(/-/g, ' ')}</span>
          ${(r.tags || []).map((t) => `<span>🏷 ${t.replace(/-/g, ' ')}</span>`).join('')}
        </div>

        <h4>Ingredientes</h4>
        <ul class="ingredientes">
          ${(r.ingredientes || []).map((i) => `<li><strong>${i.qtd || ''} ${i.unidade || ''}</strong> ${i.item || i}</li>`).join('')}
        </ul>

        <h4>Modo de preparo</h4>
        <ol class="passos">${(r.passos || []).map((p) => `<li>${p}</li>`).join('')}</ol>

        ${nutri.calorias ? `
        <h4>Informação nutricional aproximada (por porção)</h4>
        <div class="nutricao">
          <div class="nutri"><strong>${nutri.calorias}</strong><span>kcal</span></div>
          <div class="nutri"><strong>${nutri.carboidratos_g ?? '—'}g</strong><span>carboidratos</span></div>
          <div class="nutri"><strong>${nutri.proteinas_g ?? '—'}g</strong><span>proteínas</span></div>
          <div class="nutri"><strong>${nutri.gorduras_g ?? '—'}g</strong><span>gorduras</span></div>
        </div>
        <div class="aviso mt-2">⚠️ Os valores nutricionais são <strong>estimativas aproximadas</strong> e podem variar
        conforme ingredientes, marcas e porções. Este conteúdo é informativo e não substitui o acompanhamento
        de nutricionista ou médico.</div>` : ''}

        ${r.dicas ? `<h4>Dicas</h4><p class="cinza">${r.dicas}</p>` : ''}

        <div class="modal-acoes">
          <button class="btn btn--azul" id="btn-feita">${r.feita ? '✓ Já feita (desmarcar)' : '✅ Já fiz essa'}</button>
          <button class="btn btn--contorno" id="btn-fav-modal">${r.favorito ? '❤️ Nos favoritos' : '🤍 Favoritar'}</button>
          <button class="btn btn--cta" id="btn-imprimir">🖨 Imprimir receita</button>
        </div>
      </div>`;

    $('#modal-receita').classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    $('#btn-feita').addEventListener('click', async () => {
      await post(`/api/membros/feitas/${r.id}`);
      $('#modal-receita').classList.add('oculto');
      document.body.style.overflow = '';
      await carregarReceitas(); await carregarHistorico(); await carregarFavoritos();
    });
    $('#btn-fav-modal').addEventListener('click', async () => {
      await post(`/api/membros/favoritos/${r.id}`);
      $('#modal-receita').classList.add('oculto');
      document.body.style.overflow = '';
      await carregarReceitas(); await carregarFavoritos();
    });
    $('#btn-imprimir').addEventListener('click', () => imprimirReceita(r));
  }

  function fecharModal() {
    $('#modal-receita').classList.add('oculto');
    $('#modal-lista').classList.add('oculto');
    document.body.style.overflow = '';
  }
  $('#fechar-modal').addEventListener('click', fecharModal);
  $('#fechar-modal-lista').addEventListener('click', fecharModal);
  $('#modal-receita').addEventListener('click', (e) => { if (e.target.id === 'modal-receita') fecharModal(); });

  // ================= MODO IMPRESSÃO =================
  function imprimirReceita(r) {
    const n = r.nutricao || {};
    $('#area-impressao').innerHTML = `
      <div class="imp-cabecalho">
        <div><h1>${r.nome}</h1><small>${r.descricao || ''}</small></div>
        <div style="text-align:right"><strong>OFERTA FIT BR</strong><br><small>⏱ ${r.tempo_preparo_min} min • 🍽 ${r.porcoes} porção(ões)</small></div>
      </div>
      <h2>Ingredientes</h2>
      <ul>${(r.ingredientes || []).map((i) => `<li>${i.qtd || ''} ${i.unidade || ''} ${i.item || i}</li>`).join('')}</ul>
      <h2>Modo de preparo</h2>
      <ol>${(r.passos || []).map((p) => `<li>${p}</li>`).join('')}</ol>
      ${n.calorias ? `<h2>Informação nutricional aproximada (por porção)</h2>
      <div class="imp-nutricao"><span><strong>${n.calorias}</strong> kcal</span><span><strong>${n.carboidratos_g ?? '—'}g</strong> carboidratos</span><span><strong>${n.proteinas_g ?? '—'}g</strong> proteínas</span><span><strong>${n.gorduras_g ?? '—'}g</strong> gorduras</span></div>` : ''}
      <div class="imp-rodape">Valores nutricionais são estimativas. Conteúdo informativo — não substitui acompanhamento de nutricionista ou médico. • Oferta Fit BR</div>`;
    window.print();
  }

  $('#btn-imprimir-lista').addEventListener('click', () => {
    $('#area-impressao').innerHTML = `
      <div class="imp-cabecalho"><div><h1>Lista de compras</h1><small>Oferta Fit BR</small></div></div>
      <ul>${(usuario?.lista || []).map((i) => `<li>${[i.qtd, i.unidade, i.item].filter(Boolean).join(' ')} ${i.marcado ? '✓' : ''}</li>`).join('')}</ul>
      <div class="imp-rodape">Oferta Fit BR — comer melhor sem complicar</div>`;
    window.print();
  });

  // ================= FAVORITOS =================
  async function carregarFavoritos() {
    const d = await api('/api/membros/favoritos');
    renderizarGrade('#grade-favoritos', d.receitas, '#vazio-favoritos');
  }

  // ================= HISTÓRICO =================
  async function carregarHistorico() {
    const d = await api('/api/membros/historico');
    const lista = $('#lista-historico');
    lista.innerHTML = d.historico.map((h) => `
      <div class="historico-item">
        <img src="${h.receita.foto || '/assets/receitas/bowl-frango-quinoa.svg'}" alt="${h.receita.nome}" />
        <div><strong>${h.receita.nome}</strong><p class="pequeno cinza">${h.receita.tempo_preparo_min} min • ${h.receita.categoria.replace(/-/g, ' ')}</p></div>
        <div class="data">feito em<br>${new Date(h.data).toLocaleDateString('pt-BR')}</div>
      </div>`).join('');
    $('#vazio-historico')?.classList.toggle('oculto', d.historico.length > 0);
  }

  // ================= LISTA DE COMPRAS =================
  $('#btn-lista').addEventListener('click', () => {
    $('#selecao-receitas').innerHTML = receitas.map((r) => `
      <label class="lista-item" style="border-bottom:1px solid var(--borda);cursor:pointer">
        <input type="checkbox" value="${r.id}" />
        <div><strong>${r.nome}</strong><span class="de-receita">${(r.ingredientes?.length || 0)} ingredientes</span></div>
      </label>`).join('');
    $('#modal-lista').classList.remove('oculto');
    document.body.style.overflow = 'hidden';
  });

  $('#btn-gerar-lista').addEventListener('click', async () => {
    const ids = [...$$('#selecao-receitas input:checked')].map((i) => i.value);
    if (!ids.length) return alert('Selecione ao menos uma receita.');
    await post('/api/membros/lista/gerar', { receitaIds: ids });
    fecharModal();
    await carregarLista();
    $$('#abas-membros .chip').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === 'lista'));
    ['receitas', 'favoritos', 'lista', 'historico'].forEach((a) => $(`#aba-${a}`).classList.toggle('oculto', a !== 'lista'));
  });

  async function carregarLista() {
    const d = await api('/api/membros/lista');
    usuario = { ...usuario, lista: d.itens };
    $('#itens-lista').innerHTML = d.itens.length
      ? d.itens.map((i, idx) => `
        <div class="lista-item ${i.marcado ? 'marcado' : ''}">
          <input type="checkbox" data-idx="${idx}" ${i.marcado ? 'checked' : ''} />
          <div>
            <span class="texto"><strong class="qtd">${[i.qtd, i.unidade].filter(Boolean).join(' ') || '—'}</strong> ${i.item}</span>
            <span class="de-receita">${(i.receitas || []).join(' • ')}</span>
          </div>
          <button class="remover" data-del="${idx}">✕</button>
        </div>`).join('')
      : `<div class="lista-item"><span class="cinza">Sua lista está vazia. Clique em “Gerar lista de compras” na aba Receitas.</span></div>`;

    $$('#itens-lista input[data-idx]').forEach((c) =>
      c.addEventListener('change', () => post('/api/membros/lista/marcar', { index: Number(c.dataset.idx), marcado: c.checked }).then(carregarLista))
    );
    $$('#itens-lista [data-del]').forEach((b) =>
      b.addEventListener('click', () => api(`/api/membros/lista/item/${b.dataset.del}`, { method: 'DELETE' }).then(carregarLista))
    );
  }

  $('#btn-add-item').addEventListener('click', async () => {
    const texto = $('#novo-item').value.trim();
    if (!texto) return;
    await post('/api/membros/lista/item', { texto });
    $('#novo-item').value = '';
    carregarLista();
  });
  $('#btn-limpar-lista').addEventListener('click', async () => {
    if (!confirm('Limpar toda a lista de compras?')) return;
    await api('/api/membros/lista', { method: 'DELETE' });
    carregarLista();
  });

  // Atalho: abre receita direto pelo link do e-mail (?receita=ID)
  const q = new URLSearchParams(location.search);
  if (q.get('receita')) setTimeout(() => abrirReceita(q.get('receita')), 600);
})();
