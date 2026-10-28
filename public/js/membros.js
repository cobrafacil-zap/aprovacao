// Área de membros: GATE DE LOGIN obrigatório, estatísticas, receitas liberadas,
// busca/filtros/ordenação, favoritos, histórico, lista de compras com progresso,
// modo impressão de receita e perfil (nome/senha).
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ================= API + GATE DE ACESSO =================
  const api = async (url, opts = {}) => {
    let r;
    try {
      r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    } catch {
      falhaConexao();
      throw new Error('conexao');
    }
    if (r.status === 401) { negarAcesso('Faça login para continuar'); throw new Error('login'); }
    if (r.status === 403) { negarAcesso('Seu acesso ainda não foi ativado'); throw new Error('acesso'); }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      falhaConexao(dados.error || `Erro no servidor (HTTP ${r.status})`);
      throw new Error('servidor');
    }
    return dados;
  };
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body || {}) });
  const put = (url, body) => api(url, { method: 'PUT', body: JSON.stringify(body || {}) });

  function negarAcesso(mensagem) {
    const gate = $('#auth-gate');
    gate.classList.remove('liberado');
    $('#gate-texto').innerHTML = `<strong style="font-size:1.15rem;display:block;margin-bottom:6px">${mensagem}</strong>
      <span style="font-size:.9rem">Entre com o e-mail usado na compra.<br>Comprou e não ativou? Fale com o suporte.</span>`;
    gate.querySelector('.gate-spinner').style.display = 'none';
    const btn = $('#gate-entrar');
    btn.classList.remove('oculto');
    btn.textContent = 'Ir para o login';
  }

  function falhaConexao(mensagem) {
    const gate = $('#auth-gate');
    gate.classList.remove('liberado');
    $('#gate-texto').innerHTML = `<strong style="font-size:1.15rem;display:block;margin-bottom:6px">Não foi possível carregar sua conta</strong>
      <span style="font-size:.9rem">${mensagem || 'Verifique sua conexão e tente novamente.'}</span>`;
    gate.querySelector('.gate-spinner').style.display = 'none';
    const btn = $('#gate-entrar');
    btn.classList.remove('oculto');
    btn.textContent = 'Tentar novamente';
    btn.setAttribute('href', 'membros.html');
  }

  function liberarAcesso() {
    $('#auth-gate').classList.add('liberado');
    document.body.style.overflow = '';
  }
  document.body.style.overflow = 'hidden';

  // ================= TOAST =================
  let toastTimer;
  function toast(mensagem, tipo = 'sucesso') {
    const t = $('#toast');
    t.textContent = mensagem;
    t.className = `toast visivel ${tipo}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visivel'), 2600);
  }

  // ================= ESTADO =================
  let usuario = null;
  let receitas = [];
  let filtros = { q: '', categoria: '', tags: [], ordenar: 'recentes' };

  // ================= BOOT =================
  (async () => {
    try {
      const eu = await api('/api/membros/eu');
      usuario = eu.usuario;
      renderizarCabecalho();
      renderizarStats(eu);
      liberarAcesso();
      await carregarReceitas();
      await carregarFavoritos();
      await carregarHistorico();
      await carregarLista();
    } catch {
      /* o gate já cuida da mensagem */
    }
  })();

  function renderizarCabecalho() {
    $('#avatar-inicial').textContent = (usuario.nome || '?').trim()[0].toUpperCase();
    $('#perfil-nome').textContent = usuario.nome.split(' ')[0];
    $('#saudacao').textContent = `Olá, ${usuario.nome.split(' ')[0]}! 👋`;
  }

  function renderizarStats(eu) {
    $('#stat-liberadas').textContent = eu.receitas_liberadas;
    $('#stat-feitas').textContent = (eu.usuario.feitas || []).length;
    $('#stat-favoritos').textContent = (eu.usuario.favoritos || []).length;
    if (eu.proxima) {
      $('#stat-proxima').textContent = `${eu.proxima.dias}d`;
      $('#stat-proxima-rotulo').textContent = `para "${eu.proxima.nome}"`;
      $('#bv-sub').textContent = `A receita "${eu.proxima.nome}" libera em ${eu.proxima.dias} dia(s) — enquanto isso, que tal fazer uma das de hoje?`;
    } else {
      $('#stat-proxima').textContent = '✓';
      $('#stat-proxima-rotulo').textContent = 'biblioteca completa';
      $('#bv-sub').textContent = 'Toda a biblioteca já está liberada. Bom apetite!';
    }
  }

  $('#btn-sair').addEventListener('click', async () => {
    await post('/api/membros/sair');
    location.href = 'login.html';
  });

  // ================= ABAS / NAVEGAÇÃO =================
  function irParaAba(aba) {
    $$('#abas-membros .chip').forEach((c) => c.classList.toggle('ativo', c.dataset.aba === aba));
    ['receitas', 'favoritos', 'lista', 'historico'].forEach((a) =>
      $(`#aba-${a}`).classList.toggle('oculto', a !== aba)
    );
  }

  $('#abas-membros').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    irParaAba(btn.dataset.aba);
  });

  // ================= MENU DE NAVEGAÇÃO =================
  $('#btn-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#menu-painel').classList.toggle('oculto');
  });
  document.addEventListener('click', (e) => {
    const painel = $('#menu-painel');
    if (!painel.classList.contains('oculto') && !e.target.closest('#menu-painel') && !e.target.closest('#btn-menu')) {
      painel.classList.add('oculto');
    }
  });
  $$('#menu-painel [data-ir]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#menu-painel').classList.add('oculto');
      irParaAba(b.dataset.ir);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
  );
  $('#menu-perfil').addEventListener('click', () => {
    $('#menu-painel').classList.add('oculto');
    $('#btn-perfil').click();
  });

  // ================= RECEITAS =================
  async function carregarReceitas() {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.tags.length) params.set('tags', filtros.tags.join(','));
    const d = await api(`/api/membros/receitas?${params}`);
    receitas = ordenar(d.receitas);

    renderizarGrade('#grade-receitas', receitas, '#vazio-receitas');
    $('#contador-resultados').textContent =
      `${receitas.length} receita${receitas.length !== 1 ? 's' : ''} encontrada${receitas.length !== 1 ? 's' : ''}`;
    const filtrando = filtros.q || filtros.categoria || filtros.tags.length;
    $('#btn-limpar-filtros').classList.toggle('oculto', !filtrando);
    const totalFiltros = (filtros.categoria ? 1 : 0) + filtros.tags.length;
    const badge = $('#filtro-badge');
    badge.textContent = totalFiltros;
    badge.classList.toggle('oculto', totalFiltros === 0);
    $('#btn-toggle-filtros').classList.toggle('ativo', totalFiltros > 0);
    if (d.proxima) renderizarStats({ ...usuario, proxima: d.proxima, receitas_liberadas: receitas.length, usuario });
  }

  function ordenar(lista) {
    const l = [...lista];
    if (filtros.ordenar === 'az') return l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (filtros.ordenar === 'rapidas') return l.sort((a, b) => a.tempo_preparo_min - b.tempo_preparo_min);
    return l.sort((a, b) => new Date(b.data_liberacao) - new Date(a.data_liberacao));
  }

  // receita liberada nos últimos 7 dias ganha o selo "Nova da semana"
  const recemLiberada = (r) =>
    r.data_liberacao && Date.now() - new Date(r.data_liberacao).getTime() < 7 * 864e5;

  // kcal sempre que houver cálculo (as receitas são preenchidas do mesmo jeito)
  function kcalConfiavel(r) {
    const n = r.nutricao_aprox;
    return n && n.kcal_por_porcao > 0 ? n.kcal_por_porcao : null;
  }

  // Card PADRONIZADO: selos na foto, título com altura fixa, info sempre igual
  function cardReceita(r) {
    const nova = recemLiberada(r);
    const kcal = kcalConfiavel(r);
    return `
      <article class="receita-card" data-id="${r.id}">
        <div class="foto-wrap">
          ${nova ? '<span class="nova-selo">🆕 Nova da semana</span>' : ''}
          ${r.feita ? `<span class="feita-selo ${nova ? 'com-nova' : ''}">✓ já feita</span>` : ''}
          <button class="favorito" data-fav="${r.id}" aria-label="Favoritar">${r.favorito ? '❤️' : '🤍'}</button>
          <img class="foto" src="${r.foto || '/assets/receitas/bowl-frango-quinoa.jpg'}" alt="${r.nome}" />
          <span class="cat-badge">${(r.categoria || '').replace(/-/g, ' ')}</span>
        </div>
        <div class="corpo">
          <h3>${r.nome}</h3>
          <div class="tags-linha">${(r.tags || []).slice(0, 2).map((t) => `<span class="tag">${t.replace(/-/g, ' ')}</span>`).join('')}</div>
          <div class="meta">
            <span class="meta-chip">⏱ ${r.tempo_preparo_min ?? '—'} min</span>
            ${kcal ? `<span class="meta-chip kcal">🔥 ~${kcal} kcal</span>` : ''}
          </div>
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
        location.href = `receita.html?id=${c.dataset.id}`;
      })
    );
    grade.querySelectorAll('[data-fav]').forEach((b) =>
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        await post(`/api/membros/favoritos/${b.dataset.fav}`);
        toast('Favoritos atualizados ❤️');
        marcarPasso('favoritos');
        await carregarReceitas();
        await carregarFavoritos();
      })
    );
  }

  // Busca, ordenação e filtros
  let buscaTimer;
  $('#busca').addEventListener('input', (e) => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { filtros.q = e.target.value.trim(); carregarReceitas(); }, 280);
  });
  $('#ordenar').addEventListener('change', (e) => { filtros.ordenar = e.target.value; carregarReceitas(); });
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
  // Filtros recolhidos: abrem/fecham pelo botão "Filtros"
  $('#btn-toggle-filtros').addEventListener('click', () => {
    $('#painel-filtros').classList.toggle('oculto');
  });

  $('#btn-limpar-filtros').addEventListener('click', () => {
    filtros = { q: '', categoria: '', tags: [], ordenar: filtros.ordenar };
    $('#busca').value = '';
    $$('#filtros-categoria .chip').forEach((b) => b.classList.toggle('ativo', b.dataset.categoria === ''));
    $$('#filtros-tag .chip').forEach((b) => b.classList.remove('ativo'));
    carregarReceitas();
  });

  // Enviar a lista de compras por WhatsApp
  $('#btn-whatsapp').addEventListener('click', () => {
    const itens = usuario?.lista || [];
    if (!itens.length) return toast('Sua lista de compras está vazia', 'erro');
    const linhas = itens.map((i) => `${i.marcado ? '☑' : '☐'} ${[i.qtd, i.unidade, i.item].filter(Boolean).join(' ')}`);
    const texto = `🛒 *Lista de compras — Oferta Fit BR*\n\n${linhas.join('\n')}\n\n🥗 Feita na área de membros`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  });

  // ================= MODAL DA RECEITA =================
  let receitaAtual = null;
  let porcoesAtuais = 1;
  let checksFeitos = new Set();

  const formatarQtd = (n) => {
    if (Math.abs(n - Math.round(n)) < 0.005) return String(Math.round(n));
    return String(Math.round(n * 100) / 100).replace('.', ',');
  };
  // Escala a quantidade original pelo fator de porções (aceita "1/2", "0,5", "a gosto")
  const escalarQtd = (qtd, fator) => {
    const s = String(qtd ?? '').trim();
    if (!s) return '';
    const fracao = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracao) return formatarQtd((Number(fracao[1]) / Number(fracao[2])) * fator);
    const n = parseFloat(s.replace(',', '.'));
    return Number.isNaN(n) ? s : formatarQtd(n * fator);
  };
  const fatorAtual = () => porcoesAtuais / (receitaAtual?.porcoes || 1);

  async function abrirReceita(id) {
    const d = await api(`/api/membros/receitas/${id}`);
    const r = d.receita;
    receitaAtual = r;
    porcoesAtuais = r.porcoes || 1;
    checksFeitos = new Set();

    $('#modal-conteudo').innerHTML = `
      <img class="foto-capa" src="${r.foto || '/assets/receitas/bowl-frango-quinoa.jpg'}" alt="${r.nome}" />
      <div class="conteudo">
        <h2>${r.nome}</h2>
        <p class="cinza">${r.descricao || ''}</p>
        <div class="meta-flex">
          ${r.tempo_preparo_min ? `<span>⏱ ${r.tempo_preparo_min} min</span>` : ''}
          ${r.categoria ? `<span>📂 ${r.categoria.replace(/-/g, ' ')}</span>` : ''}
          ${(r.tags || []).map((t) => `<span>🏷 ${t.replace(/-/g, ' ')}</span>`).join('')}
        </div>

        <div class="ingredientes-topo">
          <h4>Ingredientes</h4>
          <div class="porcoes-stepper" aria-label="Ajustar porções">
            <button class="stepper-btn" id="menos-porcao" aria-label="Diminuir porções">−</button>
            <div class="stepper-valor"><strong id="porcoes-qtd">${porcoesAtuais}</strong><span>porções</span></div>
            <button class="stepper-btn" id="mais-porcao" aria-label="Aumentar porções">+</button>
          </div>
        </div>
        <ul class="ingredientes ingredientes-check" id="lista-ingredientes"></ul>
        <button class="btn btn--contorno btn--bloco" id="btn-add-lista-modal">🛒 Adicionar ingredientes à lista de compras</button>

        <h4>Modo de preparo <span class="dica-check">toque para marcar o que já foi feito</span></h4>
        <ol class="passos passos-check" id="lista-passos"></ol>

        <h4>Informações da receita</h4>
        <div class="nutricao">
          <div class="nutri"><strong>${r.tempo_preparo_min ?? '—'} min</strong><span>preparo</span></div>
          <div class="nutri"><strong>${r.porcoes ?? '—'}</strong><span>porção(ões)</span></div>
          <div class="nutri"><strong>${(r.ingredientes || []).length}</strong><span>ingredientes</span></div>
          <div class="nutri"><strong>${(r.passos || []).length}</strong><span>etapas</span></div>
        </div>
        ${(r.dificuldade || r.custo) ? `
        <div class="nutricao mt-1">
          ${r.dificuldade ? `<div class="nutri"><strong>${({facil:'Fácil',media:'Média',dificil:'Difícil'})[r.dificuldade] || r.dificuldade}</strong><span>dificuldade</span></div>` : ''}
          ${r.custo ? `<div class="nutri"><strong>${({baixo:'Baixo',medio:'Médio',alto:'Alto'})[r.custo] || r.custo}</strong><span>custo estimado</span></div>` : ''}
        </div>` : ''}


        ${r.dicas ? `<h4>Anote aí</h4><p class="cinza">${r.dicas}</p>` : ''}
      </div>`;

    renderIngredientes();
    renderPassos();

    $('#menos-porcao').addEventListener('click', () => {
      if (porcoesAtuais > 1) { porcoesAtuais--; renderIngredientes(); }
    });
    $('#mais-porcao').addEventListener('click', () => {
      if (porcoesAtuais < 50) { porcoesAtuais++; renderIngredientes(); }
    });

    $('#btn-add-lista-modal').addEventListener('click', async () => {
      const fator = fatorAtual();
      const itens = (r.ingredientes || []).map((i) => ({
        qtd: escalarQtd(i.qtd, fator),
        unidade: i.unidade || '',
        item: i.item || String(i),
      }));
      await post('/api/membros/lista/adicionar', { itens, receita: r.nome });
      toast(`Ingredientes (${porcoesAtuais} porção(ões)) na lista de compras! 🛒`);
      await carregarLista();
    });

    $('#modal-acoes').innerHTML = `
      <button class="btn btn--azul" id="btn-feita">${r.feita ? '✓ Já feita (desmarcar)' : '✅ Já fiz essa'}</button>
      <button class="btn btn--contorno" id="btn-fav-modal">${r.favorito ? '❤️ Nos favoritos' : '🤍 Favoritar'}</button>
      <button class="btn btn--cta" id="btn-imprimir">🖨 Imprimir</button>`;

    $('#modal-receita').classList.remove('oculto');
    document.body.style.overflow = 'hidden';
    marcarPasso('explorar');

    $('#btn-feita').addEventListener('click', async () => {
      await post(`/api/membros/feitas/${r.id}`);
      toast(r.feita ? 'Receita desmarcada' : 'Receita marcada como feita! 👨‍🍳');
      if (!r.feita) marcarPasso('feita');
      fecharModal();
      await carregarReceitas(); await carregarHistorico(); await carregarFavoritos();
    });
    $('#btn-fav-modal').addEventListener('click', async () => {
      await post(`/api/membros/favoritos/${r.id}`);
      toast('Favoritos atualizados ❤️');
      fecharModal();
      await carregarReceitas(); await carregarFavoritos();
    });
    $('#btn-imprimir').addEventListener('click', () => imprimirReceita(receitaAtual, fatorAtual()));
  }

  // Ingredientes com check clicável e quantidades recalculadas pelas porções
  function renderIngredientes() {
    const r = receitaAtual;
    const fator = fatorAtual();
    $('#porcoes-qtd').textContent = porcoesAtuais;
    $('#lista-ingredientes').innerHTML = (r.ingredientes || []).map((i, idx) => `
      <li class="ing-check ${checksFeitos.has(idx) ? 'marcado' : ''}" data-idx="${idx}">
        <span class="check-box">✓</span>
        <span class="ing-texto"><strong>${escalarQtd(i.qtd, fator)}${i.unidade ? ' ' + i.unidade : ''}</strong> ${i.item || i}</span>
      </li>`).join('');
    $$('#lista-ingredientes .ing-check').forEach((li) =>
      li.addEventListener('click', () => {
        const idx = Number(li.dataset.idx);
        checksFeitos.has(idx) ? checksFeitos.delete(idx) : checksFeitos.add(idx);
        li.classList.toggle('marcado');
      })
    );
  }

  // Passos numerados com check clicável (para acompanhar enquanto cozinha)
  function renderPassos() {
    const r = receitaAtual;
    $('#lista-passos').innerHTML = (r.passos || []).map((p, i) => `
      <li class="passo-check" data-idx="${i}">
        <span class="passo-n">${i + 1}</span>
        <span class="passo-texto">${p}</span>
      </li>`).join('');
    $$('#lista-passos .passo-check').forEach((li) =>
      li.addEventListener('click', () => li.classList.toggle('marcado'))
    );
  }

  function fecharModal() {
    $('#modal-receita').classList.add('oculto');
    $('#modal-lista').classList.add('oculto');
    $('#modal-perfil').classList.add('oculto');
    document.body.style.overflow = '';
  }
  $('#fechar-modal').addEventListener('click', fecharModal);
  $('#fechar-modal-lista').addEventListener('click', fecharModal);
  $('#fechar-modal-perfil').addEventListener('click', fecharModal);
  $('#modal-receita').addEventListener('click', (e) => { if (e.target.id === 'modal-receita') fecharModal(); });
  $('#modal-lista').addEventListener('click', (e) => { if (e.target.id === 'modal-lista') fecharModal(); });
  $('#modal-perfil').addEventListener('click', (e) => { if (e.target.id === 'modal-perfil') fecharModal(); });

  // ================= MODO IMPRESSÃO =================
  function imprimirReceita(r, fator = 1) {
    $('#area-impressao').innerHTML = `
      <div class="imp-cabecalho">
        <div><h1>${r.nome}</h1><small>${r.descricao || ''}</small></div>
        <div style="text-align:right"><strong>OFERTA FIT BR</strong><br><small>⏱ ${r.tempo_preparo_min} min • 🍽 ${Math.round((r.porcoes || 1) * fator)} porção(ões)</small></div>
      </div>
      <h2>Ingredientes</h2>
      <ul>${(r.ingredientes || []).map((i) => `<li>${escalarQtd(i.qtd, fator)} ${i.unidade || ''} ${i.item || i}</li>`).join('')}</ul>
      <h2>Modo de preparo</h2>
      <ol>${(r.passos || []).map((p) => `<li>${p}</li>`).join('')}</ol>
      <div class="imp-rodape">Conteúdo informativo — não substitui acompanhamento de nutricionista ou médico. • Oferta Fit BR</div>`;
    window.print();
  }

  $('#btn-imprimir-lista').addEventListener('click', () => {
    const itens = usuario?.lista || [];
    $('#area-impressao').innerHTML = `
      <div class="imp-cabecalho"><div><h1>Lista de compras</h1><small>Oferta Fit BR</small></div></div>
      <ul>${itens.map((i) => `<li>${[i.qtd, i.unidade, i.item].filter(Boolean).join(' ')} ${i.marcado ? '✓' : ''}</li>`).join('')}</ul>
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
        <img src="${h.receita.foto || '/assets/receitas/bowl-frango-quinoa.jpg'}" alt="${h.receita.nome}" />
        <div><strong>${h.receita.nome}</strong><p class="pequeno cinza">${h.receita.tempo_preparo_min} min • ${h.receita.categoria.replace(/-/g, ' ')}</p></div>
        <div class="data">feito em<br>${new Date(h.data).toLocaleDateString('pt-BR')}</div>
      </div>`).join('');
    $('#vazio-historico')?.classList.toggle('oculto', d.historico.length > 0);
    if (usuario) $('#stat-feitas').textContent = d.historico.length;
  }

  // ================= LISTA DE COMPRAS =================
  $('#btn-lista').addEventListener('click', () => {
    $('#selecao-receitas').innerHTML = receitas.map((r) => `
      <label class="lista-item" style="cursor:pointer">
        <input type="checkbox" value="${r.id}" />
        <div><strong>${r.nome}</strong><span class="de-receita">${(r.ingredientes?.length || 0)} ingredientes</span></div>
      </label>`).join('');
    $('#modal-lista').classList.remove('oculto');
    document.body.style.overflow = 'hidden';
  });

  $('#btn-gerar-lista').addEventListener('click', async () => {
    const ids = [...$$('#selecao-receitas input:checked')].map((i) => i.value);
    if (!ids.length) return toast('Selecione ao menos uma receita', 'erro');
    await post('/api/membros/lista/gerar', { receitaIds: ids });
    fecharModal();
    await carregarLista();
    toast('Lista de compras gerada! 🛒');
    marcarPasso('lista');
    irParaAba('lista');
  });

  async function carregarLista() {
    const d = await api('/api/membros/lista');
    usuario = { ...usuario, lista: d.itens };

    const total = d.itens.length;
    const feitos = d.itens.filter((i) => i.marcado).length;
    $('#progresso-texto').textContent = `${feitos} de ${total} itens`;
    $('#progresso-pct').textContent = total ? `${Math.round((feitos / total) * 100)}%` : '0%';
    $('#progresso-barra').style.width = total ? `${(feitos / total) * 100}%` : '0%';

    $('#itens-lista').innerHTML = total
      ? d.itens.map((i, idx) => `
        <div class="lista-item ${i.marcado ? 'marcado' : ''}">
          <input type="checkbox" data-idx="${idx}" ${i.marcado ? 'checked' : ''} />
          <div>
            <span class="texto"><strong class="qtd">${[i.qtd, i.unidade].filter(Boolean).join(' ') || '—'}</strong> ${i.item}</span>
            <span class="de-receita">${(i.receitas || []).join(' • ')}</span>
          </div>
          <button class="remover" data-del="${idx}">✕</button>
        </div>`).join('')
      : `<div class="lista-item"><span class="cinza">Sua lista está vazia. Clique em “Gerar lista” para começar.</span></div>`;

    $$('#itens-lista input[data-idx]').forEach((c) =>
      c.addEventListener('change', async () => {
        await post('/api/membros/lista/marcar', { index: Number(c.dataset.idx), marcado: c.checked });
        carregarLista();
      })
    );
    $$('#itens-lista [data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/api/membros/lista/item/${b.dataset.del}`, { method: 'DELETE' });
        carregarLista();
      })
    );
  }

  $('#btn-add-item').addEventListener('click', async () => {
    const texto = $('#novo-item').value.trim();
    if (!texto) return toast('Digite o item antes de adicionar', 'erro');
    await post('/api/membros/lista/item', { texto });
    $('#novo-item').value = '';
    toast('Item adicionado à lista');
    carregarLista();
  });
  $('#novo-item').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-add-item').click();
  });
  $('#btn-limpar-lista').addEventListener('click', async () => {
    if (!confirm('Limpar toda a lista de compras?')) return;
    await api('/api/membros/lista', { method: 'DELETE' });
    toast('Lista limpa');
    carregarLista();
  });

  // ================= PERFIL =================
  $('#btn-perfil').addEventListener('click', () => {
    $('#perfil-email').value = usuario.email;
    $('#perfil-nome-input').value = usuario.nome;
    $('#perfil-senha-atual').value = '';
    $('#perfil-senha-nova').value = '';
    $('#modal-perfil').classList.remove('oculto');
    document.body.style.overflow = 'hidden';
  });

  $('#form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('#perfil-nome-input').value.trim();
    const senhaNova = $('#perfil-senha-nova').value;
    const senhaAtual = $('#perfil-senha-atual').value;

    if (senhaNova && !senhaAtual) return toast('Informe a senha atual para trocar a senha', 'erro');

    try {
      const r = await put('/api/membros/perfil', { nome, senhaAtual, senhaNova: senhaNova || undefined });
      usuario.nome = r.usuario.nome;
      renderizarCabecalho();
      toast('Perfil atualizado! ✅');
      fecharModal();
    } catch (err) {
      if (err.message !== 'login' && err.message !== 'acesso') toast('Não foi possível salvar o perfil', 'erro');
    }
  });

  // ================= PRIMEIROS PASSOS (onboarding) =================
  const PP_KEY = 'of_primeiros_passos';
  const ppEstado = () => JSON.parse(localStorage.getItem(PP_KEY) || '{"feitos":{},"fechado":false}');
  function renderizarPrimeirosPassos() {
    const st = ppEstado();
    const card = $('#primeiros-passos');
    if (st.fechado) return card.classList.add('oculto');
    card.classList.remove('oculto');
    $$('#primeiros-passos input[data-pp]').forEach((c) => {
      c.checked = !!st.feitos[c.dataset.pp];
      c.onchange = () => {
        const s = ppEstado();
        s.feitos[c.dataset.pp] = c.checked;
        localStorage.setItem(PP_KEY, JSON.stringify(s));
        if (Object.values(s.feitos).filter(Boolean).length >= 4) {
          card.classList.add('oculto');
          toast('Parabéns! Você conheceu a área de membros 🎉');
        }
      };
    });
  }
  $('#pp-fechar').addEventListener('click', () => {
    const s = ppEstado();
    s.fechado = true;
    localStorage.setItem(PP_KEY, JSON.stringify(s));
    $('#primeiros-passos').classList.add('oculto');
  });
  const marcarPasso = (chave) => {
    const s = ppEstado();
    s.feitos[chave] = true;
    localStorage.setItem(PP_KEY, JSON.stringify(s));
    renderizarPrimeirosPassos();
  };
  renderizarPrimeirosPassos();

  // ================= CONVITE POR WHATSAPP =================
  $('#menu-convite').addEventListener('click', async () => {
    $('#menu-painel').classList.add('oculto');
    const texto = '🥗 Olha que bacana: receitas fit prontas em até 20 minutos, com receita nova toda semana e acesso vitalício por R$ 19,90. Dá uma olhada: ' + location.origin + '/index.html';
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  });

  // Atalho: link do e-mail (?receita=ID) → página da receita
  const q = new URLSearchParams(location.search);
  if (q.get('receita')) location.replace(`receita.html?id=${q.get('receita')}`);
})();
